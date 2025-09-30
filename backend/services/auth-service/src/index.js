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

// OIDC Authentication Routes
const authRoutes = oidcProviders.getAuthRoutes();

if (authRoutes) {
    const provider = process.env.OIDC_PROVIDER;
    
    // Initiate OIDC authentication
    app.get(authRoutes.auth, passport.authenticate(provider, {
        scope: authRoutes.scope
    }));

    // OIDC callback handler
    app.get(authRoutes.callback, 
        passport.authenticate(provider, { failureRedirect: '/login?error=auth_failed' }),
        async (req, res) => {
            try {
                // Store user in database
                const dbUser = await dbService.findOrCreateUser(req.user);
                
                // Generate JWT token
                const tokenPayload = {
                    id: dbUser.id,
                    email: dbUser.email,
                    name: dbUser.name,
                    provider: dbUser.provider
                };
                
                const token = jwtUtils.generateToken(tokenPayload);
                
                // Set token in cookie and redirect to frontend
                res.cookie('auth_token', token, {
                    httpOnly: false, // Allow frontend to read the token
                    secure: false, // Set to true in production with HTTPS
                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                });
                
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                res.redirect(`${frontendUrl}/dashboard.html?authenticated=true`);
                
            } catch (error) {
                console.error('Authentication callback error:', error);
                res.redirect('/login?error=server_error');
            }
        }
    );
}

// Email/Password Authentication Routes

// Register new user with email and password
app.post('/register', async (req, res) => {
    try {
        const { email, password, name, role, location } = req.body;

        // Input validation
        if (!email || !password || !name) {
            return res.status(400).json({ 
                error: 'Email, password, and name are required' 
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
            name: name.trim(),
            passwordHash,
            role: role || 'senior',
            location: location?.trim() || null
        });

        // Generate JWT token
        const tokenPayload = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
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
                name: newUser.name,
                role: newUser.role,
                provider: 'email'
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
            name: user.name,
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
                name: user.name,
                role: user.role,
                provider: user.provider
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
            name: user.name,
            picture: user.picture,
            provider: user.provider
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
    const provider = process.env.OIDC_PROVIDER;
    const authRoutes = oidcProviders.getAuthRoutes();
    
    res.json({
        // OIDC configuration
        oidc: {
            provider: provider,
            auth_url: authRoutes ? authRoutes.auth : null,
            available: !!provider
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
            ...(provider ? [`oidc_${provider}`] : []),
            'email_password'
        ]
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
            console.log(`Auth service running on port ${PORT}`);
            console.log(`OIDC Provider: ${process.env.OIDC_PROVIDER || 'Not configured'}`);
            if (authRoutes) {
                console.log(`Auth URL: http://localhost:${PORT}${authRoutes.auth}`);
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