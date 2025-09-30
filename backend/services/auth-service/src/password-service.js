const bcrypt = require('bcrypt');

/**
 * Password service for email/password authentication
 */
class PasswordService {
    constructor() {
        this.saltRounds = 12; // Higher is more secure but slower
    }

    /**
     * Hash a plain text password
     * @param {string} plainPassword - The plain text password
     * @returns {Promise<string>} - The hashed password
     */
    async hashPassword(plainPassword) {
        try {
            if (!plainPassword || typeof plainPassword !== 'string') {
                throw new Error('Password must be a non-empty string');
            }

            if (plainPassword.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            return await bcrypt.hash(plainPassword, this.saltRounds);
        } catch (error) {
            console.error('Password hashing error:', error);
            throw error;
        }
    }

    /**
     * Verify a plain text password against a hash
     * @param {string} plainPassword - The plain text password
     * @param {string} hashedPassword - The hashed password
     * @returns {Promise<boolean>} - Whether the password matches
     */
    async verifyPassword(plainPassword, hashedPassword) {
        try {
            if (!plainPassword || !hashedPassword) {
                return false;
            }

            return await bcrypt.compare(plainPassword, hashedPassword);
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }

    /**
     * Validate password strength
     * @param {string} password - The password to validate
     * @returns {Object} - Validation result with isValid and messages
     */
    validatePasswordStrength(password) {
        const result = {
            isValid: true,
            messages: []
        };

        if (!password || typeof password !== 'string') {
            result.isValid = false;
            result.messages.push('Password is required');
            return result;
        }

        // Minimum length check
        if (password.length < 8) {
            result.isValid = false;
            result.messages.push('Password must be at least 8 characters long');
        }

        // Maximum length check (prevent DoS attacks)
        if (password.length > 128) {
            result.isValid = false;
            result.messages.push('Password must be less than 128 characters');
        }

        // Character variety checks
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

        if (!hasLowerCase) {
            result.isValid = false;
            result.messages.push('Password must contain at least one lowercase letter');
        }

        if (!hasUpperCase) {
            result.isValid = false;
            result.messages.push('Password must contain at least one uppercase letter');
        }

        if (!hasNumbers) {
            result.isValid = false;
            result.messages.push('Password must contain at least one number');
        }

        if (!hasSpecialChar) {
            result.isValid = false;
            result.messages.push('Password must contain at least one special character');
        }

        // Common password check
        const commonPasswords = [
            'password', '123456', '123456789', 'qwerty', 'abc123',
            'password123', 'admin', 'letmein', 'welcome', 'monkey'
        ];

        if (commonPasswords.includes(password.toLowerCase())) {
            result.isValid = false;
            result.messages.push('Password is too common. Please choose a more secure password');
        }

        return result;
    }

    /**
     * Generate a secure random password
     * @param {number} length - Length of the password (default 12)
     * @returns {string} - Generated password
     */
    generateRandomPassword(length = 12) {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        const allChars = uppercase + lowercase + numbers + symbols;
        let password = '';

        // Ensure at least one character from each category
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += symbols[Math.floor(Math.random() * symbols.length)];

        // Fill the rest randomly
        for (let i = 4; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }

        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }
}

module.exports = PasswordService;