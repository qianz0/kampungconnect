require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const cookieParser = require('cookie-parser');

// Import our custom modules
const JWTUtils = require('./jwt-utils');
const OIDCProviders = require('./oidc-providers');
const DatabaseService = require('./database-service');
const PasswordService = require('./password-service');

const app = express();
const jwtUtils = new JWTUtils();
const oidcProviders = new OIDCProviders();
const dbService = new DatabaseService();
const passwordService = new PasswordService();

// Middleware setup
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.JWT_SECRET || 'session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        service: "auth-service",
        status: "running",
        oidc_provider: process.env.OIDC_PROVIDER || 'not configured'
    });
});

// OIDC Authentication Routes for all configured providers
const authRoutes = oidcProviders.getAuthRoutes();
const availableProviders = oidcProviders.getAvailableProviders();

// Set up routes for each configured provider
availableProviders.forEach(provider => {
    const routes = authRoutes[provider];
    
    if (routes) {
        console.log(`Setting up ${provider} routes:`, routes.auth, routes.callback);

        // Initiate OIDC authentication for this provider
        app.get(routes.auth, (req, res, next) => {
            // For Azure, check if prompt parameter is provided for account selection
            if (provider === 'azure' && req.query.prompt) {
                passport.authenticate(provider, {
                    scope: routes.scope,
                    prompt: req.query.prompt // Pass through the prompt parameter
                })(req, res, next);
            } else {
                passport.authenticate(provider, {
                    scope: routes.scope
                })(req, res, next);
            }
        });

        // OIDC callback handler for this provider
        app.get(routes.callback,
            (req, res, next) => {
                passport.authenticate(provider, (err, user, info) => {
                    if (err) {
                        console.error(`❌ ${provider} authentication error:`, err);
                        
                        // Handle specific Azure AD errors
                        if (provider === 'azure' && err.message) {
                            if (err.message.includes('AADSTS50020')) {
                                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/login.html?error=azure_user_not_found&message=${encodeURIComponent('Your account is not authorized for this application. Please contact the administrator or try a different account.')}`);
                            } else if (err.message.includes('AADSTS')) {
                                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/login.html?error=azure_error&message=${encodeURIComponent('Azure authentication failed. Please try again or contact support.')}`);
                            }
                        }
                        
                        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/login.html?error=auth_failed&provider=${provider}`);
                    }
                    
                    if (!user) {
                        console.log(`❌ ${provider} authentication failed: no user returned`);
                        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/login.html?error=auth_failed&provider=${provider}`);
                    }
                    
                    req.user = user;
                    next();
                })(req, res, next);
            },
            async (req, res) => {
                try {
                    // Store user in database
                    const dbUser = await dbService.findOrCreateUser(req.user);

                    // Generate JWT token
                    const tokenPayload = {
                        id: dbUser.id,
                        email: dbUser.email,
                        firstName: dbUser.firstName,
                        lastName: dbUser.lastName,
                        provider: dbUser.provider,
                        role: dbUser.role
                    };

                    const token = jwtUtils.generateToken(tokenPayload);

                    // Set token in cookie
                    res.cookie('auth_token', token, {
                        httpOnly: false, // Allow frontend to read the token
                        secure: false, // Set to true in production with HTTPS
                        maxAge: 24 * 60 * 60 * 1000 // 24 hours
                    });

                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                    
                    // Check if user needs to select a role
                    if (!dbUser.role || dbUser.role === 'undefined' || dbUser.role === '') {
                        console.log(`User ${dbUser.email} needs to select a role, redirecting to role selection`);
                        res.redirect(`${frontendUrl}/role-selection.html?first_login=true`);
                    } else {
                        console.log(`User ${dbUser.email} has role ${dbUser.role}, redirecting to dashboard`);
                        res.redirect(`${frontendUrl}/dashboard.html?authenticated=true`);
                    }

                } catch (error) {
                    console.error(`${provider} authentication callback error:`, error);
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                    res.redirect(`${frontendUrl}/login.html?error=server_error`);
                }
            }
        );
    }
});

// Email/Password Authentication Routes

// Register new user with email and password
app.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, role, location } = req.body;

        // Input validation
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                error: 'Email, password, first name, and last name are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Please provide a valid email address'
            });
        }

        // Validate password strength
        const passwordValidation = passwordService.validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                error: 'Password validation failed',
                messages: passwordValidation.messages
            });
        }

        // Hash password
        const passwordHash = await passwordService.hashPassword(password);

        // Create user in database
        const newUser = await dbService.createEmailUser({
            email: email.toLowerCase(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            passwordHash,
            role: role || 'senior',
            location: location?.trim() || null
        });

        // Generate JWT token
        const tokenPayload = {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            provider: 'email',
            role: newUser.role
        };

        const token = jwtUtils.generateToken(tokenPayload);

        // Set token in cookie
        res.cookie('auth_token', token, {
            httpOnly: false,
            secure: false, // Set to true in production with HTTPS
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                provider: 'email',
                location: newUser.location
            }
        });

    } catch (error) {
        console.error('Registration error:', error);

        if (error.message === 'User with this email already exists') {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// Login with email and password
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Find user by email
        const user = await dbService.findUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Check if user is email/password user (not OIDC)
        if (user.provider !== 'email' || !user.password_hash) {
            return res.status(400).json({
                error: 'This email is associated with social login. Please use the appropriate login method.'
            });
        }

        // Verify password
        const isPasswordValid = await passwordService.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            provider: user.provider,
            role: user.role
        };

        const token = jwtUtils.generateToken(tokenPayload);

        // Set token in cookie
        res.cookie('auth_token', token, {
            httpOnly: false,
            secure: false, // Set to true in production with HTTPS
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                provider: user.provider,
                location: user.location
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Change password (for email users)
app.post('/change-password', jwtUtils.authenticateToken.bind(jwtUtils), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Input validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Current password and new password are required'
            });
        }

        // Get user from database
        const user = await dbService.getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is email/password user
        if (user.provider !== 'email' || !user.password_hash) {
            return res.status(400).json({
                error: 'Password change not available for social login users'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await passwordService.verifyPassword(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({
                error: 'Current password is incorrect'
            });
        }

        // Validate new password strength
        const passwordValidation = passwordService.validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                error: 'New password validation failed',
                messages: passwordValidation.messages
            });
        }

        // Hash new password
        const newPasswordHash = await passwordService.hashPassword(newPassword);

        // Update password in database
        await dbService.updateUserPassword(userId, newPasswordHash);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Password change failed. Please try again.' });
    }
});

// Update user role (for OIDC users after role selection)
app.post('/update-role', jwtUtils.authenticateToken.bind(jwtUtils), async (req, res) => {
    try {
        const { role, location } = req.body;
        const userId = req.user.id;

        // Validate role
        const validRoles = ['senior', 'volunteer', 'caregiver'];
        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({
                error: 'Invalid role. Must be one of: senior, volunteer, caregiver'
            });
        }

        // Update user role and location
        const updatedUser = await dbService.updateUserRole(userId, role, location);
        
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate new JWT token with updated role
        const tokenPayload = {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            provider: updatedUser.provider,
            role: updatedUser.role
        };

        const token = jwtUtils.generateToken(tokenPayload);

        // Set updated token in cookie
        res.cookie('auth_token', token, {
            httpOnly: false,
            secure: false, // Set to true in production with HTTPS
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
            success: true,
            message: 'Role updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                role: updatedUser.role,
                provider: updatedUser.provider,
                location: updatedUser.location
            }
        });

    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role. Please try again.' });
    }
});

// Get current authenticated user
app.get('/me', jwtUtils.authenticateToken.bind(jwtUtils), async (req, res) => {
    try {
        const user = await dbService.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return user data without sensitive information
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            picture: user.picture,
            provider: user.provider,
            role: user.role,
            location: user.location
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout endpoint
app.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out successfully' });
});

// Token validation endpoint (for other services)
app.post('/validate-token', (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }

    try {
        const decoded = jwtUtils.verifyToken(token);
        res.json({ valid: true, user: decoded });
    } catch (error) {
        res.status(401).json({ valid: false, error: 'Invalid token' });
    }
});

// Get available authentication methods
app.get('/auth-config', (req, res) => {
    const authRoutes = oidcProviders.getAuthRoutes();
    const availableProviders = oidcProviders.getAvailableProviders();

    res.json({
        // OIDC configuration for multiple providers
        oidc: {
            providers: availableProviders,
            routes: authRoutes,
            available: availableProviders.length > 0
        },

        // Email/Password configuration
        emailPassword: {
            enabled: true,
            endpoints: {
                register: '/register',
                login: '/login',
                changePassword: '/change-password'
            }
        },

        // Authentication methods available
        methods: [
            ...availableProviders.map(provider => `oidc_${provider}`),
            'email_password'
        ]
    });
});

// Diagnostic endpoint for Azure configuration
app.get('/azure-debug', (req, res) => {
    res.json({
        azure_configured: oidcProviders.isAzureConfigured(),
        azure_config: {
            client_id: process.env.AZURE_CLIENT_ID ? 'configured' : 'missing',
            client_secret: process.env.AZURE_CLIENT_SECRET ? 'configured' : 'missing',
            tenant_id: process.env.AZURE_TENANT_ID ? 'configured' : 'missing',
            redirect_uri: process.env.AZURE_REDIRECT_URI || 'not set',
            metadata_url: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`
        },
        server_info: {
            port: process.env.PORT || 5000,
            frontend_url: process.env.FRONTEND_URL || 'http://localhost:8080',
            auth_service_url: 'http://localhost:5001'
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Auth service error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
    try {
        await dbService.initialize();

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`🚀 Auth service running on port ${PORT}`);
            console.log(`📧 Email/Password authentication: enabled`);
            
            const availableProviders = oidcProviders.getAvailableProviders();
            if (availableProviders.length > 0) {
                console.log(`🔐 OIDC Providers available: ${availableProviders.join(', ')}`);
                availableProviders.forEach(provider => {
                    const routes = authRoutes[provider];
                    if (routes) {
                        console.log(`   ${provider}: http://localhost:${PORT}${routes.auth}`);
                    }
                });
            } else {
                console.log(`⚠️  No OIDC providers configured`);
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down auth service...');
    await dbService.close();
    process.exit(0);
});

startServer();