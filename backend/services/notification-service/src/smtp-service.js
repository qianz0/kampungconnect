const nodemailer = require('nodemailer');

class SMTPEmailService {
    constructor() {
        this.enabled = process.env.SMTP_ENABLED === 'true';
        
        if (!this.enabled) {
            console.log('[SMTP] Email notifications disabled');
            return;
        }

        // Create transporter using Gmail SMTP
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false, // Use TLS
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });

        console.log('[SMTP] Email service initialized with Gmail SMTP');
        console.log(`[SMTP] Using SMTP host: ${process.env.SMTP_HOST}`);
        console.log(`[SMTP] Sending from: ${process.env.SMTP_USER}`);
    }

    /**
     * Send offer notification email to senior
     */
    async sendOfferNotification(recipientEmail, data) {
        if (!this.enabled) {
            console.log('[SMTP] Email disabled, skipping notification');
            return { success: false, message: 'Email disabled' };
        }

        try {
            const { helperName, helperRole, requestTitle, requestDescription, offerMessage, requestId, seniorName, helperRating } = data;
            
            // Determine role label - Volunteer or Caregiver (should match exactly)
            const roleLabel = helperRole === 'caregiver' ? 'Caregiver' : 'Volunteer';
            
            // Format rating display
            const ratingDisplay = helperRating ? `${parseFloat(helperRating).toFixed(1)}/5.0` : 'No rating yet';
            
            const mailOptions = {
                from: `"KampungConnect" <${process.env.SMTP_USER}>`,
                to: recipientEmail,
                subject: `New Help Offer for Your Request: ${requestTitle}`,
                text: `Hello ${seniorName},

Good news! ${helperName} has offered to help with your request.

Request: ${requestTitle}

${roleLabel}: ${helperName}

Rating: ${ratingDisplay}

You can accept this offer by logging into KampungConnect and viewing your request details.

View Request: ${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}

Thank you for using KampungConnect!

---
KampungConnect Team
Making our community stronger, together.`,
                html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 0;">
        Hello ${seniorName},<br><br>
        Good news! ${helperName} has offered to help with your request.<br><br>
        Request: ${requestTitle}<br>
        ${roleLabel}: ${helperName}<br>
        Rating: ${ratingDisplay}<br><br>
        You can accept this offer by logging into KampungConnect and viewing your request details.<br><br>
        View Request: <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}" 
           style="color: #007bff; text-decoration: none;">${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}</a><br><br>
        Thank you for using KampungConnect!<br><br>
        ---<br>
        KampungConnect Team<br>
        Making our community stronger, together.
    </p>
</div>
                `
            };

            console.log(`[SMTP] Sending offer notification to ${recipientEmail}`);
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[SMTP] Email sent successfully to ${recipientEmail}. MessageId: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId,
                recipient: recipientEmail
            };
        } catch (error) {
            console.error('[SMTP] Failed to send offer notification:', error.message);
            throw error;
        }
    }

    /**
     * Send match notification email to helper/caregiver
     */
    async sendMatchNotification(recipientEmail, data) {
        if (!this.enabled) {
            console.log('[SMTP] Email disabled, skipping notification');
            return { success: false, message: 'Email disabled' };
        }

        try {
            const { seniorName, requestTitle, requestDescription, matchDate, requestId, helperName, helperRole, category, urgency } = data;
            
            const mailOptions = {
                from: `"KampungConnect" <${process.env.SMTP_USER}>`,
                to: recipientEmail,
                subject: `You've Been Matched! Request: ${requestTitle}`,
                text: `Hello ${helperName},

Congratulations! You have been matched with a senior who needs your help.

Request: ${requestTitle}

Category: ${category || 'N/A'}

Urgency: ${urgency || 'N/A'}

Senior: ${seniorName}

Please log in to KampungConnect to view the full details and contact information.

View Request: ${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}

Thank you for being part of our caring community!

---
KampungConnect Team
Making our community stronger, together.`,
                html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 0;">
        Hello ${helperName},<br><br>
        Congratulations! You have been matched with a senior who needs your help.<br><br>
        Request: ${requestTitle}<br>
        Category: ${category || 'N/A'}<br>
        Urgency: ${urgency || 'N/A'}<br>
        Senior: ${seniorName}<br><br>
        Please log in to KampungConnect to view the full details and contact information.<br><br>
        View Request: <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}" 
           style="color: #007bff; text-decoration: none;">${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}</a><br><br>
        Thank you for being part of our caring community!<br><br>
        ---<br>
        KampungConnect Team<br>
        Making our community stronger, together.
    </p>
</div>
                `
            };

            console.log(`[SMTP] Sending match notification to ${recipientEmail}`);
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[SMTP] Email sent successfully to ${recipientEmail}. MessageId: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId,
                recipient: recipientEmail
            };
        } catch (error) {
            console.error('[SMTP] Failed to send match notification:', error.message);
            throw error;
        }
    }

    /**
     * Send instant match notification to helper/caregiver
     */
    async sendInstantMatchNotification(recipientEmail, data) {
        if (!this.enabled) {
            console.log('[SMTP] Email disabled, skipping notification');
            return { success: false, message: 'Email disabled' };
        }

        try {
            const { seniorName, requestTitle, requestDescription, matchDate, requestId, helperName, helperRole, category, urgency } = data;
            
            const mailOptions = {
                from: `"KampungConnect" <${process.env.SMTP_USER}>`,
                to: recipientEmail,
                subject: `Instant Match! You've Been Assigned: ${requestTitle}`,
                text: `Hello ${helperName},

Congratulations! You have been instantly matched with a senior who needs your help.

Request: ${requestTitle}

Category: ${category || 'N/A'}

Urgency: ${urgency || 'N/A'}

Senior: ${seniorName}

Please log in to KampungConnect to view the full details and contact information.

View Request: ${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}

Thank you for being part of our caring community!

---
KampungConnect Team
Making our community stronger, together.`,
                html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 0;">
        Hello ${helperName},<br><br>
        Congratulations! You have been instantly matched with a senior who needs your help.<br><br>
        Request: ${requestTitle}<br>
        Category: ${category || 'N/A'}<br>
        Urgency: ${urgency || 'N/A'}<br>
        Senior: ${seniorName}<br><br>
        Please log in to KampungConnect to view the full details and contact information.<br><br>
        View Request: <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}" 
           style="color: #007bff; text-decoration: none;">${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}</a><br><br>
        Thank you for being part of our caring community!<br><br>
        ---<br>
        KampungConnect Team<br>
        Making our community stronger, together.
    </p>
</div>
                `
            };

            console.log(`[SMTP] Sending instant match notification to ${recipientEmail}`);
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[SMTP] Email sent successfully to ${recipientEmail}. MessageId: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId,
                recipient: recipientEmail
            };
        } catch (error) {
            console.error('[SMTP] Failed to send instant match notification:', error.message);
            throw error;
        }
    }

    /**
     * Send status update notification
     */
    async sendStatusUpdateNotification(recipientEmail, data) {
        if (!this.enabled) {
            console.log('[SMTP] Email disabled, skipping notification');
            return { success: false, message: 'Email disabled' };
        }

        try {
            const { requestTitle, oldStatus, newStatus, updatedBy, requestId } = data;
            
            const mailOptions = {
                from: `"KampungConnect" <${process.env.SMTP_USER}>`,
                to: recipientEmail,
                subject: `Request Status Update: ${requestTitle}`,
                text: `Hello,

The status of your request has been updated.

Request: ${requestTitle}

Previous Status: ${oldStatus}

New Status: ${newStatus}
${updatedBy ? `\nUpdated by: ${updatedBy}` : ''}

View Request: ${process.env.FRONTEND_URL || 'http://localhost:8080'}/request-details.html?id=${requestId}

Thank you for using KampungConnect!

---
KampungConnect Team
Making our community stronger, together.`
            };

            console.log(`[SMTP] Sending status update notification to ${recipientEmail}`);
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[SMTP] Email sent successfully to ${recipientEmail}. MessageId: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId,
                recipient: recipientEmail
            };
        } catch (error) {
            console.error('[SMTP] Failed to send status update notification:', error.message);
            throw error;
        }
    }

    /**
     * Verify SMTP connection
     */
    async verifyConnection() {
        if (!this.enabled) {
            return { success: false, message: 'SMTP disabled' };
        }

        try {
            await this.transporter.verify();
            console.log('[SMTP] Connection verified successfully');
            return { success: true, message: 'SMTP connection verified' };
        } catch (error) {
            console.error('[SMTP] Connection verification failed:', error.message);
            throw error;
        }
    }
}

module.exports = SMTPEmailService;
