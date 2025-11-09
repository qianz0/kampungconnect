const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const SMTPEmailService = require('./smtp-service');
const AuthMiddleware = require('/app/shared/auth-middleware');
const app = express();

// Initialize SMTP email service
const emailService = new SMTPEmailService();

// Initialize auth middleware
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

// Configure CORS to allow frontend requests with credentials
const allowedOrigins = [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins for development
        }
    },
    credentials: true
}));
app.use(express.json());

// Connect to database
const db = new Pool({
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'kampungconnect',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password'
});

app.get('/', (req, res) => {
    res.json({ service: "notification-service", status: "running", smtpEnabled: emailService.enabled });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'notification-service',
        smtp: {
            enabled: emailService.enabled
        }
    });
});

// Get user notification preferences
app.get('/notification-preferences', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        let result = await db.query(
            'SELECT * FROM notification_preferences WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            // Create default preferences if they don't exist
            const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
            const userEmail = userResult.rows[0]?.email || '';
            
            result = await db.query(
                `INSERT INTO notification_preferences 
                (user_id, enabled, email, notify_new_responses, notify_new_offers, notify_request_updates, notify_replies)
                VALUES ($1, TRUE, $2, TRUE, TRUE, TRUE, TRUE)
                RETURNING *`,
                [userId, userEmail]
            );
        }
        
        const prefs = result.rows[0];
        res.json({
            enabled: prefs.enabled,
            email: prefs.email,
            preferences: {
                newResponses: prefs.notify_new_responses,
                newOffers: prefs.notify_new_offers,
                requestUpdates: prefs.notify_request_updates,
                replies: prefs.notify_replies
            }
        });
    } catch (error) {
        console.error('[Notification] Error getting preferences:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user notification preferences
app.post('/notification-preferences', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { enabled, email, preferences } = req.body;
        
        const result = await db.query(
            `INSERT INTO notification_preferences 
            (user_id, enabled, email, notify_new_responses, notify_new_offers, notify_request_updates, notify_replies, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                enabled = $2,
                email = $3,
                notify_new_responses = $4,
                notify_new_offers = $5,
                notify_request_updates = $6,
                notify_replies = $7,
                updated_at = NOW()
            RETURNING *`,
            [
                userId,
                enabled,
                email,
                preferences?.newResponses !== false,
                preferences?.newOffers !== false,
                preferences?.requestUpdates !== false,
                preferences?.replies !== false
            ]
        );
        
        res.json({ message: 'Preferences updated successfully', preferences: result.rows[0] });
    } catch (error) {
        console.error('[Notification] Error updating preferences:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Check if user has notifications enabled for a specific type
 */
async function shouldSendNotification(userId, notificationType) {
    try {
        const result = await db.query(
            'SELECT enabled, notify_new_responses, notify_new_offers, notify_request_updates, notify_replies, email FROM notification_preferences WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            // No preferences set - default to enabled
            return { shouldSend: true, email: null };
        }
        
        const prefs = result.rows[0];
        
        if (!prefs.enabled) {
            return { shouldSend: false, email: prefs.email };
        }
        
        const typeMap = {
            'offer': prefs.notify_new_offers,
            'match': prefs.notify_request_updates,
            'response': prefs.notify_new_responses,
            'reply': prefs.notify_replies,
            'status_update': prefs.notify_request_updates
        };
        
        return { 
            shouldSend: typeMap[notificationType] !== false, 
            email: prefs.email 
        };
    } catch (error) {
        console.error('[Notification] Error checking preferences:', error);
        // Default to enabled on error
        return { shouldSend: true, email: null };
    }
}

// Endpoint to send offer notification (called by request-service)
app.post('/notify/offer', async (req, res) => {
    try {
        const { seniorId, seniorEmail, seniorName, requestTitle, helperName, helperRole, offerId, requestId } = req.body;
        
        if (!seniorId || (!seniorEmail && !seniorId)) {
            return res.status(400).json({ error: 'Missing seniorId or seniorEmail' });
        }

        // Check if senior has notifications enabled for offers
        const { shouldSend, email } = await shouldSendNotification(seniorId, 'offer');
        
        if (!shouldSend) {
            console.log(`[Notification] User ${seniorId} has disabled offer notifications`);
            return res.json({ message: 'Notification disabled by user preferences' });
        }
        
        const targetEmail = email || seniorEmail;
        console.log(`[Notification] Sending offer notification to ${targetEmail}`);
        
        const result = await emailService.sendOfferNotification(targetEmail, {
            helperName,
            helperRole,
            requestTitle,
            requestDescription: req.body.requestDescription || '',
            offerMessage: req.body.offerMessage || '',
            requestId,
            seniorName
        });

        res.json({ message: 'Offer notification sent', messageId: result.messageId });
    } catch (error) {
        console.error('[Notification] Error sending offer notification:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Endpoint to send match notification (called by request-service)
app.post('/notify/match', async (req, res) => {
    try {
        const { helperId, helperEmail, helperName, requestTitle, seniorName, category, urgency, requestId } = req.body;
        
        if (!helperId || (!helperEmail && !helperId)) {
            return res.status(400).json({ error: 'Missing helperId or helperEmail' });
        }

        // Check if helper has notifications enabled for matches
        const { shouldSend, email } = await shouldSendNotification(helperId, 'match');
        
        if (!shouldSend) {
            console.log(`[Notification] User ${helperId} has disabled match notifications`);
            return res.json({ message: 'Notification disabled by user preferences' });
        }
        
        const targetEmail = email || helperEmail;
        console.log(`[Notification] Sending match notification to ${targetEmail}`);
        
        const result = await emailService.sendMatchNotification(targetEmail, {
            seniorName,
            requestTitle,
            requestDescription: req.body.requestDescription || '',
            matchDate: new Date(),
            requestId,
            helperName,
            category,
            urgency
        });

        res.json({ message: 'Match notification sent', messageId: result.messageId });
    } catch (error) {
        console.error('[Notification] Error sending match notification:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Endpoint to send instant match notification (called by matching-service)
app.post('/notify/instant-match', async (req, res) => {
    try {
        const { helperId, helperEmail, helperName, helperRole, requestTitle, requestDescription, seniorName, category, urgency, requestId } = req.body;
        
        if (!helperId || (!helperEmail && !helperId)) {
            return res.status(400).json({ error: 'Missing helperId or helperEmail' });
        }

        // Check if helper has notifications enabled for matches
        const { shouldSend, email } = await shouldSendNotification(helperId, 'match');
        
        if (!shouldSend) {
            console.log(`[Notification] User ${helperId} has disabled instant match notifications`);
            return res.json({ message: 'Notification disabled by user preferences' });
        }
        
        const targetEmail = email || helperEmail;
        console.log(`[Notification] Sending instant match notification to ${targetEmail}`);
        
        const result = await emailService.sendInstantMatchNotification(targetEmail, {
            seniorName,
            requestTitle,
            requestDescription: requestDescription || '',
            matchDate: new Date(),
            requestId,
            helperRole,
            category,
            urgency
        });

        res.json({ message: 'Instant match notification sent', messageId: result.messageId });
    } catch (error) {
        console.error('[Notification] Error sending instant match notification:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Endpoint to send status update notification
app.post('/notify/status-update', async (req, res) => {
    try {
        const { userId, email, userName, requestTitle, oldStatus, newStatus, requestId } = req.body;
        
        if (!userId || (!email && !userId)) {
            return res.status(400).json({ error: 'Missing userId or email' });
        }

        // Check if user has notifications enabled for status updates
        const { shouldSend, email: prefEmail } = await shouldSendNotification(userId, 'status_update');
        
        if (!shouldSend) {
            console.log(`[Notification] User ${userId} has disabled status update notifications`);
            return res.json({ message: 'Notification disabled by user preferences' });
        }
        
        const targetEmail = prefEmail || email;
        console.log(`[Notification] Sending status update notification to ${targetEmail}`);
        
        const result = await emailService.sendStatusUpdateNotification(targetEmail, {
            requestTitle,
            oldStatus,
            newStatus,
            updatedBy: userName
        });

        res.json({ message: 'Status update notification sent', messageId: result.messageId });
    } catch (error) {
        console.error('[Notification] Error sending status update notification:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[Notification] Service running on port ${PORT}`);
    console.log(`[Notification] SMTP Email: ${emailService.enabled ? 'ENABLED' : 'DISABLED'}`);
});