const nodemailer = require('nodemailer');

/**
 * OTP Service for email verification and password reset
 * Uses Nodemailer to send OTP codes to users
 */
class OTPService {
    constructor() {
        // In-memory storage for OTPs (in production, use Redis or database)
        this.otpStore = new Map();
        
        // OTP configuration
        this.OTP_LENGTH = 6;
        this.OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes
        this.MAX_ATTEMPTS = 3;
        
        // Email configuration
        this.emailConfig = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        };
        
        this.fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
        this.fromName = process.env.SMTP_FROM_NAME || 'KampungConnect';
        
        // Check if email is configured
        this.isConfigured = !!(
            this.emailConfig.auth.user && 
            this.emailConfig.auth.pass
        );
        
        // Create transporter
        if (this.isConfigured) {
            try {
                this.transporter = nodemailer.createTransport(this.emailConfig);
                console.log('✅ Email service configured successfully');
                
                // Verify connection
                this.transporter.verify((error, success) => {
                    if (error) {
                        console.error('⚠️  Email service verification failed:', error.message);
                        this.isConfigured = false;
                    } else {
                        console.log('✅ Email service ready to send messages');
                    }
                });
            } catch (error) {
                console.error('⚠️  Failed to create email transporter:', error.message);
                this.isConfigured = false;
            }
        } else {
            console.warn('⚠️  Email service not configured. OTP emails will not be sent.');
            console.warn('   Set SMTP_USER and SMTP_PASSWORD environment variables.');
        }
    }

    /**
     * Generate a random OTP code
     * @returns {string} - 6-digit OTP code
     */
    generateOTP() {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        return otp;
    }

    /**
     * Store OTP with expiry time
     * @param {string} email - User's email address
     * @param {string} otp - The OTP code
     * @param {string} type - Type of OTP (signup, password_reset)
     */
    storeOTP(email, otp, type = 'signup') {
        const key = `${email}:${type}`;
        const expiresAt = Date.now() + this.OTP_EXPIRY;
        
        this.otpStore.set(key, {
            otp,
            expiresAt,
            attempts: 0,
            createdAt: Date.now()
        });
        
        console.log(`[OTP] Stored OTP for ${email} (${type}), expires at ${new Date(expiresAt).toISOString()}`);
    }

    /**
     * Verify OTP code
     * @param {string} email - User's email address
     * @param {string} otp - The OTP code to verify
     * @param {string} type - Type of OTP (signup, password_reset)
     * @returns {Object} - Verification result
     */
    verifyOTP(email, otp, type = 'signup') {
        const key = `${email}:${type}`;
        const stored = this.otpStore.get(key);
        
        if (!stored) {
            return {
                valid: false,
                error: 'OTP not found or expired. Please request a new code.'
            };
        }
        
        // Check if OTP has expired
        if (Date.now() > stored.expiresAt) {
            this.otpStore.delete(key);
            return {
                valid: false,
                error: 'OTP has expired. Please request a new code.'
            };
        }
        
        // Check attempts
        if (stored.attempts >= this.MAX_ATTEMPTS) {
            this.otpStore.delete(key);
            return {
                valid: false,
                error: 'Too many failed attempts. Please request a new code.'
            };
        }
        
        // Increment attempts
        stored.attempts++;
        this.otpStore.set(key, stored);
        
        // Verify OTP
        if (stored.otp === otp) {
            // OTP is valid, remove from store
            this.otpStore.delete(key);
            console.log(`[OTP] Valid OTP verified for ${email} (${type})`);
            return {
                valid: true
            };
        }
        
        const attemptsLeft = this.MAX_ATTEMPTS - stored.attempts;
        console.log(`[OTP] Invalid OTP attempt for ${email} (${type}), ${attemptsLeft} attempts left`);
        
        return {
            valid: false,
            error: `Invalid OTP code. ${attemptsLeft} attempt(s) remaining.`
        };
    }

    /**
     * Generate HTML email template for OTP
     * @param {string} otp - The OTP code
     * @param {string} type - Type of email (signup, password_reset)
     * @param {Object} userData - Additional user data
     * @returns {string} - HTML email content
     */
    generateEmailHTML(otp, type, userData = {}) {
        const userName = userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : 'User';
        const expiryMinutes = Math.floor(this.OTP_EXPIRY / 60000);
        
        const title = type === 'password_reset' ? 'Password Reset' : 'Email Verification';
        const message = type === 'password_reset' 
            ? 'You requested to reset your password. Use the code below to complete the process:'
            : 'Thank you for registering! Use the code below to verify your email address:';
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - KampungConnect</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">KampungConnect</h1>
                            <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">${title}</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hello <strong>${userName}</strong>,
                            </p>
                            <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 30px 0;">
                                ${message}
                            </p>
                            
                            <!-- OTP Box -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 20px; background-color: #f8f9fa; border-radius: 8px; border: 2px dashed #667eea;">
                                        <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">Your verification code is:</p>
                                        <h2 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otp}</h2>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                                This code will expire in <strong>${expiryMinutes} minutes</strong>.
                            </p>
                            
                            <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                                If you didn't request this code, please ignore this email or contact our support team.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                            <p style="color: #999999; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} KampungConnect. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    /**
     * Send OTP via Nodemailer
     * @param {string} email - Recipient's email address
     * @param {string} otp - The OTP code
     * @param {string} type - Type of email (signup, password_reset)
     * @param {Object} userData - Additional user data for email template
     * @returns {Promise<boolean>} - Success status
     */
    async sendOTP(email, otp, type = 'signup', userData = {}) {
        if (!this.isConfigured) {
            console.warn(`[OTP] Email service not configured. OTP for ${email}: ${otp} (${type})`);
            // In development, just log the OTP
            console.log(`╔════════════════════════════════════════╗`);
            console.log(`║  OTP CODE FOR ${email.padEnd(20)} ║`);
            console.log(`║  Code: ${otp}                        ║`);
            console.log(`║  Type: ${type.padEnd(29)} ║`);
            console.log(`╚════════════════════════════════════════╝`);
            return true;
        }

        try {
            const subject = type === 'password_reset' 
                ? 'Password Reset Code - KampungConnect'
                : 'Email Verification Code - KampungConnect';
            
            const html = this.generateEmailHTML(otp, type, userData);
            
            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: email,
                subject: subject,
                html: html,
                text: `Your ${type === 'password_reset' ? 'password reset' : 'verification'} code is: ${otp}. This code will expire in ${Math.floor(this.OTP_EXPIRY / 60000)} minutes.`
            };

            console.log(`[OTP] Sending OTP email to ${email}...`);
            
            const info = await this.transporter.sendMail(mailOptions);

            console.log(`[OTP] Email sent successfully to ${email}:`, info.messageId);
            return true;

        } catch (error) {
            console.error('[OTP] Failed to send email:', error);
            
            // In development, still log the OTP even if email fails
            if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
                console.log(`╔════════════════════════════════════════╗`);
                console.log(`║  OTP CODE (Email failed)              ║`);
                console.log(`║  Email: ${email.padEnd(27)} ║`);
                console.log(`║  Code: ${otp}                        ║`);
                console.log(`║  Type: ${type.padEnd(29)} ║`);
                console.log(`╚════════════════════════════════════════╝`);
            }
            
            throw new Error('Failed to send verification email. Please try again.');
        }
    }

    /**
     * Resend OTP (generates new code)
     * @param {string} email - User's email address
     * @param {string} type - Type of OTP (signup, password_reset)
     * @param {Object} userData - Additional user data
     * @returns {Promise<Object>} - Result of resend operation
     */
    async resendOTP(email, type = 'signup', userData = {}) {
        const key = `${email}:${type}`;
        
        // Check if there's a recent OTP request (prevent spam)
        const stored = this.otpStore.get(key);
        if (stored && (Date.now() - stored.createdAt) < 60000) { // 1 minute cooldown
            const waitTime = Math.ceil((60000 - (Date.now() - stored.createdAt)) / 1000);
            return {
                success: false,
                error: `Please wait ${waitTime} seconds before requesting a new code.`
            };
        }

        try {
            // Generate new OTP
            const otp = this.generateOTP();
            
            // Store OTP
            this.storeOTP(email, otp, type);
            
            // Send OTP via email
            await this.sendOTP(email, otp, type, userData);
            
            return {
                success: true,
                message: 'Verification code sent successfully.'
            };
        } catch (error) {
            console.error('[OTP] Resend failed:', error);
            return {
                success: false,
                error: error.message || 'Failed to send verification code.'
            };
        }
    }

    /**
     * Check if OTP exists for email
     * @param {string} email - User's email address
     * @param {string} type - Type of OTP
     * @returns {boolean}
     */
    hasOTP(email, type = 'signup') {
        const key = `${email}:${type}`;
        const stored = this.otpStore.get(key);
        
        if (!stored) return false;
        
        // Check if expired
        if (Date.now() > stored.expiresAt) {
            this.otpStore.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * Clear OTP for a user
     * @param {string} email - User's email address
     * @param {string} type - Type of OTP
     */
    clearOTP(email, type = 'signup') {
        const key = `${email}:${type}`;
        this.otpStore.delete(key);
        console.log(`[OTP] Cleared OTP for ${email} (${type})`);
    }

    /**
     * Clean up expired OTPs (call periodically)
     */
    cleanupExpiredOTPs() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, value] of this.otpStore.entries()) {
            if (now > value.expiresAt) {
                this.otpStore.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[OTP] Cleaned up ${cleaned} expired OTP(s)`);
        }
    }
}

module.exports = OTPService;
