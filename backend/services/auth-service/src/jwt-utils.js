const jwt = require('jsonwebtoken');

/**
 * JWT Utilities for token generation and verification
 */
class JWTUtils {
    constructor() {
        this.secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
        this.expiresIn = process.env.JWT_EXPIRATION || '24h';
    }

    /**
     * Generate JWT token for authenticated user
     */
    generateToken(userPayload) {
        return jwt.sign(userPayload, this.secret, { expiresIn: this.expiresIn });
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.secret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    /**
     * Middleware to validate JWT tokens
     */
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        try {
            const decoded = this.verifyToken(token);
            req.user = decoded;
            next();
        } catch (error) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
    }
}

module.exports = JWTUtils;