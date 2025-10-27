const jwt = require('jsonwebtoken');
const axios = require('axios');

/**
 * JWT Authentication Middleware for Microservices
 * This can be imported and used by other services
 */
class AuthMiddleware {
    constructor(authServiceUrl = 'http://auth-service:5000') {
        this.authServiceUrl = authServiceUrl;
        this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
    }

    /**
     * Middleware to authenticate JWT tokens
     */
    authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const cookieToken = req.cookies?.auth_token;
        
        // Try to get token from Authorization header or cookie
        const token = (authHeader && authHeader.split(' ')[1]) || cookieToken;

        if (!token) {
            return res.status(401).json({ 
                error: 'Access token required',
                message: 'Please authenticate to access this resource'
            });
        }

        try {
            // Verify token locally (faster)
            const decoded = jwt.verify(token, this.jwtSecret);
            req.user = decoded;
            next();
        } catch (error) {
            // If local verification fails, try validating with auth service
            this.validateTokenWithAuthService(token, req, res, next);
        }
    };

    /**
     * Validate token with auth service (fallback)
     */
    async validateTokenWithAuthService(token, req, res, next) {
        try {
            const response = await axios.post(`${this.authServiceUrl}/validate-token`, 
                { token },
                { timeout: 5000 }
            );

            if (response.data.valid) {
                req.user = response.data.user;
                next();
            } else {
                res.status(403).json({ 
                    error: 'Invalid token',
                    message: 'Please re-authenticate'
                });
            }
        } catch (error) {
            console.error('Token validation error:', error.message);
            res.status(503).json({ 
                error: 'Authentication service unavailable',
                message: 'Please try again later'
            });
        }
    }

    /**
     * Middleware to check if user has specific role or permission
     */
    requireRole = (role) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (req.user.role !== role) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        };
    };

    /**
     * Optional authentication - doesn't fail if token is missing
     */
    optionalAuth = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const cookieToken = req.cookies?.auth_token;
        const token = (authHeader && authHeader.split(' ')[1]) || cookieToken;

        if (!token) {
            req.user = null;
            return next();
        }

        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            req.user = decoded;
            next();
        } catch (error) {
            req.user = null;
            next();
        }
    };
}

module.exports = AuthMiddleware;