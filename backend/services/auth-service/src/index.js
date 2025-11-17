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
const OTPService = require('./otp-service');

const app = express();
const jwtUtils = new JWTUtils();
const oidcProviders = new OIDCProviders();
const dbService = new DatabaseService();
const passwordService = new PasswordService();
const otpService = new OTPService();

// Middleware setup
// Allow multiple origins for local development and production
const allowedOrigins = [
    'http://localhost:8080',
    'http://frontend:80',
    'http://localhost:80',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log(`CORS: Blocked origin ${origin}`);
            callback(null, true); // Allow for now, but log it
        }
    },
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
            // For Azure and Google, check if prompt parameter is provided for account selection
            if ((provider === 'azure' || provider === 'google') && req.query.prompt) {
                passport.authenticate(provider, {
                    scope: routes.scope,
                    prompt: req.query.prompt // Pass through the prompt parameter (select_account, consent, etc.)
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

                    // Check if user account is active
                    if (!dbUser.is_active) {
                        console.log(`❌ Login blocked: User account is suspended (${dbUser.email})`);
                        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                        return res.redirect(`${frontendUrl}/login.html?error=account_suspended&message=${encodeURIComponent('Your account has been suspended. Please contact the administrator.')}`);
                    }

                    // Update last login timestamp (returns previous login time)
                    const previousLogin = await dbService.updateLastLogin(dbUser.id);

                    // Generate JWT token
                    const tokenPayload = {
                        id: dbUser.id,
                        email: dbUser.email,
                        firstname: dbUser.firstname,
                        lastname: dbUser.lastname,
                        provider: dbUser.provider,
                        role: dbUser.role,
                        lastLogin: previousLogin
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
                    } 
                    else if (dbUser.role === 'admin') {
                        console.log(`Admin user ${dbUser.email} logged in, redirecting to admin dashboard`);
                        res.redirect(`${frontendUrl}/admin.html?authenticated=true`);
                    }
                    else {
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

// Register new user with email and password (Step 1: Create pending user and send OTP)
app.post('/register', async (req, res) => {
    try {
        const { email, password, firstname, lastname, role, location } = req.body;

        // Input validation
        if (!email || !password || !firstname || !lastname) {
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

        // Check if user already exists in main users table
        const existingUser = await dbService.findUserByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const passwordHash = await passwordService.hashPassword(password);

        // Store as pending user
        await dbService.createPendingUser({
            email: email.toLowerCase(),
            firstname: firstname.trim(),
            lastname: lastname.trim(),
            passwordHash,
            role: role || 'senior',
            location: location?.trim() || null
        });

        // Generate and send OTP
        const otp = otpService.generateOTP();
        otpService.storeOTP(email.toLowerCase(), otp, 'signup');
        
        await otpService.sendOTP(email.toLowerCase(), otp, 'signup', {
            firstname: firstname.trim(),
            lastname: lastname.trim()
        });

        res.status(200).json({
            success: true,
            message: 'Verification code sent to your email. Please check your inbox.',
            requiresVerification: true
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message || 'Registration failed. Please try again.' });
    }
});

// Verify email and complete registration (Step 2: Verify OTP and create actual user)
app.post('/verify-email', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                error: 'Email and verification code are required'
            });
        }

        // Verify OTP
        const verification = otpService.verifyOTP(email.toLowerCase(), otp, 'signup');
        if (!verification.valid) {
            return res.status(400).json({ error: verification.error });
        }

        // Get pending user data
        const pendingUser = await dbService.getPendingUser(email.toLowerCase());
        if (!pendingUser) {
            return res.status(400).json({ error: 'Registration session expired. Please register again.' });
        }

        // Create actual user in database
        const newUser = await dbService.createEmailUser({
            email: pendingUser.email,
            firstname: pendingUser.firstname,
            lastname: pendingUser.lastname,
            passwordHash: pendingUser.password_hash,
            role: pendingUser.role,
            location: pendingUser.location
        });

        // Delete pending user
        await dbService.deletePendingUser(email.toLowerCase());

        // Verify email in database
        await dbService.verifyUserEmail(newUser.id);

        // Check if user account is active (in case it was suspended between registration and verification)
        if (!newUser.is_active) {
            return res.status(403).json({
                error: 'Your account has been suspended. Please contact the administrator.'
            });
        }

        // Update last login timestamp (returns previous login time, which is null for new users)
        const previousLogin = await dbService.updateLastLogin(newUser.id);

        // Generate JWT token
        const tokenPayload = {
            id: newUser.id,
            email: newUser.email,
            firstname: newUser.firstname,
            lastname: newUser.lastname,
            provider: 'email',
            role: newUser.role,
            lastLogin: previousLogin
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
            message: 'Email verified! Registration complete.',
            user: {
                id: newUser.id,
                email: newUser.email,
                firstname: newUser.firstname,
                lastname: newUser.lastname,
                role: newUser.role,
                provider: 'email',
                location: newUser.location
            }
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: error.message || 'Verification failed. Please try again.' });
    }
});

// Resend OTP for signup
app.post('/resend-otp', async (req, res) => {
    try {
        const { email, type } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const otpType = type || 'signup';

        // For signup, check if pending user exists
        if (otpType === 'signup') {
            const pendingUser = await dbService.getPendingUser(email.toLowerCase());
            if (!pendingUser) {
                return res.status(400).json({ error: 'No pending registration found. Please start registration again.' });
            }

            const result = await otpService.resendOTP(email.toLowerCase(), otpType, {
                firstname: pendingUser.firstname,
                lastname: pendingUser.lastname
            });

            if (!result.success) {
                return res.status(400).json({ error: result.error });
            }

            res.json({ success: true, message: result.message });
        } else if (otpType === 'password_reset') {
            // For password reset, check if user exists
            const user = await dbService.findUserByEmailForReset(email.toLowerCase());
            if (!user) {
                return res.status(400).json({ error: 'No account found with this email.' });
            }

            const result = await otpService.resendOTP(email.toLowerCase(), otpType, {
                firstname: user.firstname,
                lastname: user.lastname
            });

            if (!result.success) {
                return res.status(400).json({ error: result.error });
            }

            res.json({ success: true, message: result.message });
        } else {
            return res.status(400).json({ error: 'Invalid OTP type' });
        }

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Failed to resend verification code.' });
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

        // Check if user account is active (double-check since findUserByEmail already filters by is_active)
        if (!user.is_active) {
            return res.status(403).json({
                error: 'Your account has been suspended. Please contact the administrator.'
            });
        }

        // Check if user has a password set (some OAuth-only users might not have a password)
        if (!user.password_hash) {
            return res.status(400).json({
                error: 'This account does not have a password set. Please login using your social account (Google/Microsoft).'
            });
        }

        // Verify password
        const isPasswordValid = await passwordService.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Update last login timestamp (returns previous login time)
        const previousLogin = await dbService.updateLastLogin(user.id);

        // Generate JWT token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            provider: user.provider,
            role: user.role,
            lastLogin: previousLogin
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
                firstname: user.firstname,
                lastname: user.lastname,
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

// Request password reset (Step 1: Send OTP)
app.post('/request-password-reset', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user exists and is email/password user
        const user = await dbService.findUserByEmailForReset(email.toLowerCase());
        if (!user) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account exists with this email, you will receive a password reset code.'
            });
        }

        // Generate and send OTP
        const otp = otpService.generateOTP();
        otpService.storeOTP(email.toLowerCase(), otp, 'password_reset');
        
        await otpService.sendOTP(email.toLowerCase(), otp, 'password_reset', {
            firstname: user.firstname,
            lastname: user.lastname
        });

        res.json({
            success: true,
            message: 'If an account exists with this email, you will receive a password reset code.'
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ error: 'Failed to process password reset request.' });
    }
});

// Verify OTP for password reset (Step 2: Verify OTP)
app.post('/verify-reset-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                error: 'Email and verification code are required'
            });
        }

        // Verify OTP
        const verification = otpService.verifyOTP(email.toLowerCase(), otp, 'password_reset');
        if (!verification.valid) {
            return res.status(400).json({ error: verification.error });
        }

        // Generate a temporary reset token (valid for 10 minutes)
        const resetToken = jwtUtils.generateToken(
            { email: email.toLowerCase(), purpose: 'password_reset' },
            '10m'
        );

        res.json({
            success: true,
            message: 'Verification successful. You can now reset your password.',
            resetToken
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
});

// Reset password (Step 3: Set new password)
app.post('/reset-password', async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({
                error: 'Reset token and new password are required'
            });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwtUtils.verifyToken(resetToken);
        } catch (error) {
            return res.status(401).json({ error: 'Invalid or expired reset token' });
        }

        if (decoded.purpose !== 'password_reset') {
            return res.status(401).json({ error: 'Invalid reset token' });
        }

        // Validate new password strength
        const passwordValidation = passwordService.validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                error: 'Password validation failed',
                messages: passwordValidation.messages
            });
        }

        // Find user
        const user = await dbService.findUserByEmailForReset(decoded.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash new password
        const newPasswordHash = await passwordService.hashPassword(newPassword);

        // Update password
        await dbService.updateUserPassword(user.id, newPasswordHash);

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Password reset failed. Please try again.' });
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
            firstname: updatedUser.firstname,
            lastname: updatedUser.lastname,
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
                firstname: updatedUser.firstname,
                lastname: updatedUser.lastname,
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

// Update user profile (name and location)
app.post('/update-profile', jwtUtils.authenticateToken.bind(jwtUtils), async (req, res) => {
    try {
        const { firstname, lastname, location } = req.body;
        const userId = req.user.id;

        // Input validation
        if (!firstname || !lastname) {
            return res.status(400).json({
                error: 'First name and last name are required'
            });
        }

        // Update user profile
        const updatedUser = await dbService.updateUserProfile(userId, {
            firstname: firstname.trim(),
            lastname: lastname.trim(),
            location: location?.trim() || null
        });
        
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate new JWT token with updated profile
        const tokenPayload = {
            id: updatedUser.id,
            email: updatedUser.email,
            firstname: updatedUser.firstname,
            lastname: updatedUser.lastname,
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
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                firstname: updatedUser.firstname,
                lastname: updatedUser.lastname,
                role: updatedUser.role,
                provider: updatedUser.provider,
                location: updatedUser.location,
                picture: updatedUser.picture,
                email_verified: updatedUser.email_verified,
                created_at: updatedUser.created_at
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile. Please try again.' });
    }
});

// Get current authenticated user
app.get('/me', jwtUtils.authenticateToken.bind(jwtUtils), async (req, res) => {
    try {
        const user = await dbService.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate fallback profile picture if none exists
        let picture = user.picture;
        if (!picture || picture === 'null' || picture.trim() === '') {
            const displayName = user.firstname && user.lastname 
                ? `${user.firstname} ${user.lastname}`.trim()
                : user.email || 'User';
            picture = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6c757d&color=fff&size=200`;
        }

        // Return user data without sensitive information
        res.json({
            id: user.id,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            picture: picture,
            provider: user.provider,
            role: user.role,
            location: user.location,
            email_verified: user.email_verified,
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_login: user.last_login
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get khakis (seniors) - all or by location
app.get('/khakis', jwtUtils.authenticateToken.bind(jwtUtils), async (req, res) => {
    try {
        // Only seniors can view other seniors
        if (req.user.role !== 'senior') {
            return res.status(403).json({ error: 'Only seniors can view khakis' });
        }

        const { nearby } = req.query;
        const currentUser = await dbService.getUserById(req.user.id);

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        let query;
        let params;

        if (nearby === 'true') {
            // Get seniors in the same postal code area/sector (first 2 digits)
            // This allows matching within the same neighborhood/estate
            query = `
                SELECT 
                    id, email, firstname, lastname, picture, 
                    location, rating, created_at
                FROM users 
                WHERE role = 'senior' 
                    AND id != $1 
                    AND is_active = true
                    AND location IS NOT NULL
                    AND SUBSTRING(location FROM 1 FOR 2) = SUBSTRING($2::text FROM 1 FOR 2)
                ORDER BY rating DESC, created_at DESC
            `;
            params = [currentUser.id, currentUser.location];
        } else {
            // Get all seniors (excluding current user)
            query = `
                SELECT 
                    id, email, firstname, lastname, picture, 
                    location, rating, created_at
                FROM users 
                WHERE role = 'senior' 
                    AND id != $1 
                    AND is_active = true
                ORDER BY rating DESC, created_at DESC
            `;
            params = [currentUser.id];
        }

        const result = await dbService.pool.query(query, params);

        // Process results to add fallback profile pictures
        const khakis = result.rows.map(khaki => {
            let picture = khaki.picture;
            if (!picture || picture === 'null' || picture.trim() === '') {
                const displayName = khaki.firstname && khaki.lastname 
                    ? `${khaki.firstname} ${khaki.lastname}`.trim()
                    : khaki.email || 'User';
                picture = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6c757d&color=fff&size=200`;
            }

            return {
                ...khaki,
                picture
            };
        });

        res.json({
            khakis,
            count: khakis.length,
            currentUserLocation: currentUser.location,
            filter: nearby === 'true' ? 'nearby' : 'all'
        });

    } catch (error) {
        console.error('Get khakis error:', error);
        res.status(500).json({ error: 'Failed to fetch khakis' });
    }
});

// Get specific user profile (for viewing other seniors)
app.get('/users/:userId', jwtUtils.authenticateToken.bind(jwtUtils), async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Only seniors can view other user profiles
        if (req.user.role !== 'senior') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const user = await dbService.pool.query(
            `SELECT 
                id, email, firstname, lastname, picture, 
                location, rating, role, created_at, last_login
            FROM users 
            WHERE id = $1 AND is_active = true`,
            [userId]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        let userProfile = user.rows[0];

        // Add fallback profile picture
        if (!userProfile.picture || userProfile.picture === 'null' || userProfile.picture.trim() === '') {
            const displayName = userProfile.firstname && userProfile.lastname 
                ? `${userProfile.firstname} ${userProfile.lastname}`.trim()
                : userProfile.email || 'User';
            userProfile.picture = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6c757d&color=fff&size=200`;
        }

        res.json({ user: userProfile });

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Logout endpoint
app.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out successfully' });
});

// Token validation endpoint (for other services)
app.post('/validate-token', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }

    try {
        const decoded = jwtUtils.verifyToken(token);
        
        // Verify user still exists and is active
        const user = await dbService.getUserById(decoded.id);
        if (!user) {
            return res.status(401).json({ valid: false, error: 'User not found' });
        }
        
        if (!user.is_active) {
            return res.status(403).json({ 
                valid: false, 
                error: 'Account suspended',
                message: 'Your account has been suspended. Please contact the administrator.'
            });
        }
        
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
            console.log(`🔐 OTP verification: ${otpService.isConfigured ? 'enabled (NodeMailer)' : 'enabled (console logging)'}`);
            
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

        // Start periodic cleanup tasks
        startCleanupTasks();

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start periodic cleanup tasks
function startCleanupTasks() {
    // Cleanup expired OTPs every 5 minutes
    setInterval(() => {
        otpService.cleanupExpiredOTPs();
    }, 5 * 60 * 1000);

    // Cleanup expired pending users every hour
    setInterval(async () => {
        try {
            await dbService.cleanupExpiredPendingUsers();
        } catch (error) {
            console.error('Error cleaning up pending users:', error);
        }
    }, 60 * 60 * 1000);

    console.log('🧹 Cleanup tasks scheduled');
}

// Graceful shutdown

let shuttingDown = false;

process.on('SIGTERM', async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log('⚙️ Graceful shutdown initiated...');
    try {
        await dbService.close();
        console.log('✅ \Database connection closed');
    } catch (err) {
        console.error('Error during shutdown:', err);
    }

    // Don't exit immediately — let Kubernetes handle termination
    // Keep process alive until K8s actually kills it
});

startServer();