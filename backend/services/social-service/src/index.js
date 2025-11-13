require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5008;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// JWT middleware
const AuthMiddleware = require('/app/shared/auth-middleware');
const authMiddlewareInstance = new AuthMiddleware(process.env.AUTH_SERVICE_URL);
const authMiddleware = authMiddlewareInstance.authenticateToken;

// Health check
app.get('/', (req, res) => {
    res.json({
        service: 'social-service',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// ==================== FRIENDS ENDPOINTS ====================

// Get user's friends list
app.get('/friends', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(`
            SELECT 
                u.id, u.email, u.firstname, u.lastname, u.picture, 
                u.location, u.role, u.created_at,
                f.created_at as friends_since,
                f.status
            FROM friendships f
            JOIN users u ON (
                CASE 
                    WHEN f.user_id = $1 THEN u.id = f.friend_id
                    ELSE u.id = f.user_id
                END
            )
            WHERE (f.user_id = $1 OR f.friend_id = $1) 
                AND f.status = 'accepted'
            ORDER BY f.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            friends: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching friends:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch friends'
        });
    }
});

// Get pending friend requests (received)
app.get('/friends/requests', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(`
            SELECT 
                f.id as request_id,
                u.id, u.email, u.firstname, u.lastname, u.picture, 
                u.location, u.role,
                f.created_at as request_date
            FROM friendships f
            JOIN users u ON u.id = f.user_id
            WHERE f.friend_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            requests: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching friend requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch friend requests'
        });
    }
});

// Send friend request
app.post('/friends/request', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.body;

        if (!friendId) {
            return res.status(400).json({
                success: false,
                error: 'Friend ID is required'
            });
        }

        if (userId === friendId) {
            return res.status(400).json({
                success: false,
                error: 'Cannot send friend request to yourself'
            });
        }

        // Check if friendship already exists
        const existing = await db.query(`
            SELECT * FROM friendships 
            WHERE (user_id = $1 AND friend_id = $2) 
               OR (user_id = $2 AND friend_id = $1)
        `, [userId, friendId]);

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Friend request already exists'
            });
        }

        // Create friend request
        await db.query(`
            INSERT INTO friendships (user_id, friend_id, status)
            VALUES ($1, $2, 'pending')
        `, [userId, friendId]);

        res.json({
            success: true,
            message: 'Friend request sent successfully'
        });
    } catch (error) {
        console.error('Error sending friend request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send friend request'
        });
    }
});

// Accept friend request
app.post('/friends/accept/:requestId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;

        // Verify the request is for this user
        const request = await db.query(`
            SELECT * FROM friendships 
            WHERE id = $1 AND friend_id = $2 AND status = 'pending'
        `, [requestId, userId]);

        if (request.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Friend request not found'
            });
        }

        // Accept the request
        await db.query(`
            UPDATE friendships 
            SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [requestId]);

        res.json({
            success: true,
            message: 'Friend request accepted'
        });
    } catch (error) {
        console.error('Error accepting friend request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to accept friend request'
        });
    }
});

// Reject friend request
app.post('/friends/reject/:requestId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;

        // Verify the request is for this user
        const request = await db.query(`
            SELECT * FROM friendships 
            WHERE id = $1 AND friend_id = $2 AND status = 'pending'
        `, [requestId, userId]);

        if (request.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Friend request not found'
            });
        }

        // Delete the request
        await db.query(`
            DELETE FROM friendships WHERE id = $1
        `, [requestId]);

        res.json({
            success: true,
            message: 'Friend request rejected'
        });
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject friend request'
        });
    }
});

// Remove friend
app.delete('/friends/:friendId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;

        await db.query(`
            DELETE FROM friendships 
            WHERE (user_id = $1 AND friend_id = $2) 
               OR (user_id = $2 AND friend_id = $1)
        `, [userId, friendId]);

        res.json({
            success: true,
            message: 'Friend removed successfully'
        });
    } catch (error) {
        console.error('Error removing friend:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove friend'
        });
    }
});

// ==================== MESSAGES ENDPOINTS ====================

// Get conversations list
app.get('/messages/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(`
            SELECT DISTINCT ON (conversation_id)
                m.conversation_id,
                m.id as last_message_id,
                m.sender_id,
                m.receiver_id,
                m.content,
                m.created_at,
                m.read,
                CASE 
                    WHEN m.sender_id = $1 THEN receiver.id
                    ELSE sender.id
                END as other_user_id,
                CASE 
                    WHEN m.sender_id = $1 THEN receiver.email
                    ELSE sender.email
                END as other_user_email,
                CASE 
                    WHEN m.sender_id = $1 THEN receiver.firstname
                    ELSE sender.firstname
                END as other_user_firstname,
                CASE 
                    WHEN m.sender_id = $1 THEN receiver.lastname
                    ELSE sender.lastname
                END as other_user_lastname,
                CASE 
                    WHEN m.sender_id = $1 THEN receiver.picture
                    ELSE sender.picture
                END as other_user_picture
            FROM messages m
            JOIN users sender ON sender.id = m.sender_id
            JOIN users receiver ON receiver.id = m.receiver_id
            WHERE m.sender_id = $1 OR m.receiver_id = $1
            ORDER BY conversation_id, m.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            conversations: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch conversations'
        });
    }
});

// Get messages with a specific user
app.get('/messages/:otherUserId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const result = await db.query(`
            SELECT 
                m.*,
                sender.email as sender_email,
                sender.firstname as sender_firstname,
                sender.lastname as sender_lastname,
                sender.picture as sender_picture
            FROM messages m
            JOIN users sender ON sender.id = m.sender_id
            WHERE (m.sender_id = $1 AND m.receiver_id = $2)
               OR (m.sender_id = $2 AND m.receiver_id = $1)
            ORDER BY m.created_at DESC
            LIMIT $3 OFFSET $4
        `, [userId, otherUserId, limit, offset]);

        // Mark messages as read
        await db.query(`
            UPDATE messages 
            SET read = true 
            WHERE receiver_id = $1 AND sender_id = $2 AND read = false
        `, [userId, otherUserId]);

        res.json({
            success: true,
            messages: result.rows.reverse(),
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
        });
    }
});

// Send a message
app.post('/messages', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { receiverId, content } = req.body;

        if (!receiverId || !content) {
            return res.status(400).json({
                success: false,
                error: 'Receiver ID and content are required'
            });
        }

        if (userId === parseInt(receiverId)) {
            return res.status(400).json({
                success: false,
                error: 'Cannot send message to yourself'
            });
        }

        // Create conversation ID (consistent ordering)
        const conversationId = userId < receiverId 
            ? `${userId}_${receiverId}` 
            : `${receiverId}_${userId}`;

        const result = await db.query(`
            INSERT INTO messages (sender_id, receiver_id, conversation_id, content)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [userId, receiverId, conversationId, content]);

        res.json({
            success: true,
            message: result.rows[0]
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// Get unread message count
app.get('/messages/unread/count', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(`
            SELECT COUNT(*) as unread_count
            FROM messages
            WHERE receiver_id = $1 AND read = false
        `, [userId]);

        res.json({
            success: true,
            unreadCount: parseInt(result.rows[0].unread_count)
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch unread count'
        });
    }
});

// ==================== ACTIVITIES ENDPOINTS ====================

// Get user's activities
app.get('/activities', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const status = req.query.status; // 'upcoming', 'past', or null for all

        let query = `
            SELECT 
                a.*,
                creator.email as creator_email,
                creator.firstname as creator_firstname,
                creator.lastname as creator_lastname,
                json_agg(
                    json_build_object(
                        'user_id', ap.user_id,
                        'status', ap.status,
                        'email', u.email,
                        'firstname', u.firstname,
                        'lastname', u.lastname,
                        'picture', u.picture
                    )
                ) as participants
            FROM activities a
            JOIN users creator ON creator.id = a.creator_id
            LEFT JOIN activity_participants ap ON ap.activity_id = a.id
            LEFT JOIN users u ON u.id = ap.user_id
            WHERE a.creator_id = $1 OR ap.user_id = $1
        `;

        const params = [userId];

        if (status === 'upcoming') {
            query += ` AND a.scheduled_at > CURRENT_TIMESTAMP AND a.status = 'scheduled'`;
        } else if (status === 'past') {
            query += ` AND (a.scheduled_at < CURRENT_TIMESTAMP OR a.status = 'completed')`;
        }

        query += `
            GROUP BY a.id, creator.email, creator.firstname, creator.lastname
            ORDER BY a.scheduled_at DESC
        `;

        const result = await db.query(query, params);

        res.json({
            success: true,
            activities: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activities'
        });
    }
});

// Create new activity
app.post('/activities', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description, scheduled_at, location, invitees } = req.body;

        if (!title || !scheduled_at) {
            return res.status(400).json({
                success: false,
                error: 'Title and scheduled time are required'
            });
        }

        // Create activity
        const result = await db.query(`
            INSERT INTO activities (creator_id, title, description, scheduled_at, location)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [userId, title, description, scheduled_at, location]);

        const activity = result.rows[0];

        // Add invitees as participants
        if (invitees && invitees.length > 0) {
            for (const inviteeId of invitees) {
                await db.query(`
                    INSERT INTO activity_participants (activity_id, user_id, status)
                    VALUES ($1, $2, 'invited')
                `, [activity.id, inviteeId]);
            }
        }

        // Add creator as participant
        await db.query(`
            INSERT INTO activity_participants (activity_id, user_id, status)
            VALUES ($1, $2, 'accepted')
        `, [activity.id, userId]);

        res.json({
            success: true,
            activity: activity
        });
    } catch (error) {
        console.error('Error creating activity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create activity'
        });
    }
});

// Update activity response
app.post('/activities/:activityId/respond', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { activityId } = req.params;
        const { status } = req.body; // 'accepted', 'declined', 'maybe'

        if (!['accepted', 'declined', 'maybe'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        await db.query(`
            UPDATE activity_participants 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE activity_id = $2 AND user_id = $3
        `, [status, activityId, userId]);

        res.json({
            success: true,
            message: 'Response updated successfully'
        });
    } catch (error) {
        console.error('Error updating activity response:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update response'
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Social service running on port ${PORT}`);
});