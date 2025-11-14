require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./db');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5008;
const GRPC_PORT = process.env.GRPC_PORT || 50051;

// Middleware
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

// JWT middleware
const AuthMiddleware = require('/app/shared/auth-middleware');
const authMiddlewareInstance = new AuthMiddleware(process.env.AUTH_SERVICE_URL);
const authMiddleware = authMiddlewareInstance.authenticateToken;

// Load proto file
const PROTO_PATH = path.join(__dirname, '../proto/messaging.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const messagingProto = grpc.loadPackageDefinition(packageDefinition).messaging;

// Store for active message streams (for real-time messaging)
const activeStreams = new Map();

// ==================== gRPC SERVICE IMPLEMENTATION ====================

// Helper function to format user data
function formatUser(user) {
    return {
        id: user.id,
        email: user.email || '',
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        picture: user.picture || ''
    };
}

// gRPC service implementations
const grpcService = {
    // Get all conversations for a user
    GetConversations: async (call, callback) => {
        try {
            const { user_id } = call.request;
            
            const result = await db.query(`
                WITH latest_messages AS (
                    SELECT DISTINCT ON (conversation_id)
                        conversation_id,
                        sender_id,
                        receiver_id,
                        content,
                        created_at,
                        read
                    FROM messages
                    WHERE sender_id = $1 OR receiver_id = $1
                    ORDER BY conversation_id, created_at DESC
                ),
                unread_counts AS (
                    SELECT 
                        conversation_id,
                        COUNT(*) as unread_count
                    FROM messages
                    WHERE receiver_id = $1 AND read = false
                    GROUP BY conversation_id
                )
                SELECT 
                    lm.conversation_id,
                    lm.sender_id,
                    lm.receiver_id,
                    lm.content as last_message_content,
                    lm.created_at as last_message_time,
                    CASE WHEN lm.receiver_id = $1 AND NOT lm.read THEN true ELSE false END as has_unread,
                    COALESCE(uc.unread_count, 0)::integer as unread_count,
                    CASE 
                        WHEN lm.sender_id = $1 THEN receiver.id
                        ELSE sender.id
                    END as other_user_id,
                    CASE 
                        WHEN lm.sender_id = $1 THEN receiver.email
                        ELSE sender.email
                    END as other_user_email,
                    CASE 
                        WHEN lm.sender_id = $1 THEN receiver.firstname
                        ELSE sender.firstname
                    END as other_user_firstname,
                    CASE 
                        WHEN lm.sender_id = $1 THEN receiver.lastname
                        ELSE sender.lastname
                    END as other_user_lastname,
                    CASE 
                        WHEN lm.sender_id = $1 THEN receiver.picture
                        ELSE sender.picture
                    END as other_user_picture
                FROM latest_messages lm
                JOIN users sender ON sender.id = lm.sender_id
                JOIN users receiver ON receiver.id = lm.receiver_id
                LEFT JOIN unread_counts uc ON uc.conversation_id = lm.conversation_id
                ORDER BY lm.created_at DESC
            `, [user_id]);

            const conversations = result.rows.map(row => ({
                conversation_id: row.conversation_id,
                other_user_id: row.other_user_id,
                other_user_email: row.other_user_email || '',
                other_user_firstname: row.other_user_firstname || '',
                other_user_lastname: row.other_user_lastname || '',
                other_user_picture: row.other_user_picture || '',
                last_message_content: row.last_message_content || '',
                last_message_time: row.last_message_time ? row.last_message_time.toISOString() : '',
                has_unread: row.has_unread || false,
                unread_count: row.unread_count || 0
            }));

            callback(null, { conversations });
        } catch (error) {
            console.error('gRPC GetConversations error:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Failed to fetch conversations'
            });
        }
    },

    // Get messages between two users
    GetMessages: async (call, callback) => {
        try {
            const { user_id, other_user_id, limit = 50, offset = 0 } = call.request;

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
            `, [user_id, other_user_id, limit, offset]);

            // Mark messages as read
            await db.query(`
                UPDATE messages 
                SET read = true 
                WHERE receiver_id = $1 AND sender_id = $2 AND read = false
            `, [user_id, other_user_id]);

            const messages = result.rows.reverse().map(row => ({
                id: row.id,
                sender_id: row.sender_id,
                receiver_id: row.receiver_id,
                conversation_id: row.conversation_id,
                content: row.content || '',
                read: row.read || false,
                created_at: row.created_at ? row.created_at.toISOString() : '',
                sender: {
                    id: row.sender_id,
                    email: row.sender_email || '',
                    firstname: row.sender_firstname || '',
                    lastname: row.sender_lastname || '',
                    picture: row.sender_picture || ''
                }
            }));

            callback(null, { messages });
        } catch (error) {
            console.error('gRPC GetMessages error:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Failed to fetch messages'
            });
        }
    },

    // Send a message
    SendMessage: async (call, callback) => {
        try {
            const { sender_id, receiver_id, content } = call.request;

            if (!sender_id || !receiver_id || !content) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Sender ID, receiver ID, and content are required'
                });
            }

            if (sender_id === receiver_id) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Cannot send message to yourself'
                });
            }

            // Check if users are friends (required for messaging)
            const friendshipCheck = await db.query(`
                SELECT * FROM friendships 
                WHERE ((user_id = $1 AND friend_id = $2) 
                   OR (user_id = $2 AND friend_id = $1))
                AND status = 'accepted'
            `, [sender_id, receiver_id]);

            if (friendshipCheck.rows.length === 0) {
                return callback({
                    code: grpc.status.PERMISSION_DENIED,
                    message: 'You can only send messages to your friends'
                });
            }

            // Create conversation ID (consistent ordering)
            const conversationId = sender_id < receiver_id 
                ? `${sender_id}_${receiver_id}` 
                : `${receiver_id}_${sender_id}`;

            const result = await db.query(`
                INSERT INTO messages (sender_id, receiver_id, conversation_id, content)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [sender_id, receiver_id, conversationId, content]);

            const messageRow = result.rows[0];

            // Get sender info
            const senderResult = await db.query(
                'SELECT id, email, firstname, lastname, picture FROM users WHERE id = $1',
                [sender_id]
            );

            const message = {
                id: messageRow.id,
                sender_id: messageRow.sender_id,
                receiver_id: messageRow.receiver_id,
                conversation_id: messageRow.conversation_id,
                content: messageRow.content || '',
                read: messageRow.read || false,
                created_at: messageRow.created_at ? messageRow.created_at.toISOString() : '',
                sender: formatUser(senderResult.rows[0])
            };

            // Notify active streams
            if (activeStreams.has(receiver_id)) {
                const stream = activeStreams.get(receiver_id);
                try {
                    stream.write({
                        message: message,
                        event_type: 'new_message'
                    });
                } catch (streamError) {
                    console.error('Error writing to stream:', streamError);
                    activeStreams.delete(receiver_id);
                }
            }

            callback(null, { message, success: true, error: '' });
        } catch (error) {
            console.error('gRPC SendMessage error:', error);
            callback(null, { 
                message: null, 
                success: false, 
                error: 'Failed to send message' 
            });
        }
    },

    // Get unread message count
    GetUnreadCount: async (call, callback) => {
        try {
            const { user_id } = call.request;

            const result = await db.query(`
                SELECT COUNT(*) as unread_count
                FROM messages
                WHERE receiver_id = $1 AND read = false
            `, [user_id]);

            const unreadCount = parseInt(result.rows[0].unread_count) || 0;

            callback(null, { unread_count: unreadCount });
        } catch (error) {
            console.error('gRPC GetUnreadCount error:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Failed to fetch unread count'
            });
        }
    },

    // Mark messages as read
    MarkAsRead: async (call, callback) => {
        try {
            const { user_id, other_user_id } = call.request;

            await db.query(`
                UPDATE messages 
                SET read = true 
                WHERE receiver_id = $1 AND sender_id = $2 AND read = false
            `, [user_id, other_user_id]);

            callback(null, { success: true });
        } catch (error) {
            console.error('gRPC MarkAsRead error:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Failed to mark messages as read'
            });
        }
    },

    // Stream messages (server streaming)
    StreamMessages: (call) => {
        const { user_id } = call.request;
        
        console.log(`User ${user_id} connected to message stream`);
        activeStreams.set(user_id, call);

        // Send initial connection confirmation
        call.write({
            message: null,
            event_type: 'connected'
        });

        // Handle client disconnect
        call.on('cancelled', () => {
            console.log(`User ${user_id} disconnected from message stream`);
            activeStreams.delete(user_id);
        });

        call.on('error', (error) => {
            console.error(`Stream error for user ${user_id}:`, error);
            activeStreams.delete(user_id);
        });
    },

    // Send typing indicator
    SendTypingIndicator: async (call, callback) => {
        try {
            const { user_id, other_user_id, is_typing } = call.request;

            // Notify the other user if they have an active stream
            if (activeStreams.has(other_user_id)) {
                const stream = activeStreams.get(other_user_id);
                try {
                    stream.write({
                        message: {
                            sender_id: user_id,
                            receiver_id: other_user_id
                        },
                        event_type: is_typing ? 'typing_start' : 'typing_stop'
                    });
                } catch (streamError) {
                    console.error('Error writing typing indicator:', streamError);
                    activeStreams.delete(other_user_id);
                }
            }

            callback(null, { success: true });
        } catch (error) {
            console.error('gRPC SendTypingIndicator error:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Failed to send typing indicator'
            });
        }
    }
};

// Create and start gRPC server
const grpcServer = new grpc.Server();
grpcServer.addService(messagingProto.MessagingService.service, grpcService);
grpcServer.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
        if (error) {
            console.error('Failed to start gRPC server:', error);
            return;
        }
        console.log(`🚀 gRPC server running on port ${port}`);
    }
);

// ==================== REST API (Gateway to gRPC) ====================

// Health check
app.get('/', (req, res) => {
    res.json({
        service: 'social-service',
        status: 'running',
        rest_port: PORT,
        grpc_port: GRPC_PORT,
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

// Get sent friend requests (pending requests sent by current user)
app.get('/friends/sent-requests', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(`
            SELECT 
                f.id as request_id,
                u.id, u.email, u.firstname, u.lastname, u.picture, 
                u.location, u.role,
                f.created_at as request_date,
                f.status
            FROM friendships f
            JOIN users u ON u.id = f.friend_id
            WHERE f.user_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            requests: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching sent friend requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sent friend requests'
        });
    }
});

// Send friend request
app.post('/friends/request', authMiddleware, async (req, res) => {
    const client = await db.pool.connect();
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

        await client.query('BEGIN');

        // Check if friendship already exists with row lock
        const existing = await client.query(`
            SELECT * FROM friendships 
            WHERE ((user_id = $1 AND friend_id = $2) 
               OR (user_id = $2 AND friend_id = $1))
            FOR UPDATE
        `, [userId, friendId]);

        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Friend request already exists'
            });
        }

        // Create friend request
        await client.query(`
            INSERT INTO friendships (user_id, friend_id, status)
            VALUES ($1, $2, 'pending')
        `, [userId, friendId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Friend request sent successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending friend request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send friend request'
        });
    } finally {
        client.release();
    }
});

// Accept friend request
app.post('/friends/accept/:requestId', authMiddleware, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const userId = req.user.id;
        const { requestId } = req.params;

        await client.query('BEGIN');

        // Verify the request is for this user with row lock
        const request = await client.query(`
            SELECT * FROM friendships 
            WHERE id = $1 AND friend_id = $2 AND status = 'pending'
            FOR UPDATE
        `, [requestId, userId]);

        if (request.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Friend request not found'
            });
        }

        // Accept the request
        await client.query(`
            UPDATE friendships 
            SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [requestId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Friend request accepted'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error accepting friend request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to accept friend request'
        });
    } finally {
        client.release();
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

// Get sent friend requests
app.get('/friends/sent', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(`
            SELECT 
                f.id as request_id,
                u.id, u.email, u.firstname, u.lastname, u.picture, 
                u.location, u.role,
                f.created_at as request_date
            FROM friendships f
            JOIN users u ON u.id = f.friend_id
            WHERE f.user_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            requests: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching sent friend requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sent friend requests'
        });
    }
});

// Cancel sent friend request
app.post('/friends/cancel/:requestId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;

        // Verify the request was sent by this user
        const request = await db.query(`
            SELECT * FROM friendships 
            WHERE id = $1 AND user_id = $2 AND status = 'pending'
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
            message: 'Friend request cancelled'
        });
    } catch (error) {
        console.error('Error cancelling friend request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel friend request'
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

// Get conversations list (calls gRPC internally)
app.get('/messages/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Call gRPC service
        const response = await grpcService.GetConversations({
            request: { user_id: userId }
        }, (error, result) => {
            if (error) {
                console.error('Error fetching conversations:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch conversations'
                });
            }

            res.json({
                success: true,
                conversations: result.conversations,
                count: result.conversations.length
            });
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch conversations'
        });
    }
});

// Get messages with a specific user (calls gRPC internally)
app.get('/messages/:otherUserId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Call gRPC service
        await grpcService.GetMessages({
            request: { 
                user_id: userId, 
                other_user_id: parseInt(otherUserId),
                limit,
                offset
            }
        }, (error, result) => {
            if (error) {
                console.error('Error fetching messages:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch messages'
                });
            }

            res.json({
                success: true,
                messages: result.messages,
                count: result.messages.length
            });
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
        });
    }
});

// Send a message (calls gRPC internally)
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

        // Check if users are friends (required for messaging)
        const friendshipCheck = await db.query(`
            SELECT * FROM friendships 
            WHERE ((user_id = $1 AND friend_id = $2) 
               OR (user_id = $2 AND friend_id = $1))
            AND status = 'accepted'
        `, [userId, parseInt(receiverId)]);

        if (friendshipCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'You can only send messages to your friends. Send them a friend request first!'
            });
        }

        // Call gRPC service
        await grpcService.SendMessage({
            request: {
                sender_id: userId,
                receiver_id: parseInt(receiverId),
                content
            }
        }, (error, result) => {
            if (error) {
                console.error('Error sending message:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send message'
                });
            }

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to send message'
                });
            }

            res.json({
                success: true,
                message: result.message
            });
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// Get unread message count (calls gRPC internally)
app.get('/messages/unread/count', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Call gRPC service
        await grpcService.GetUnreadCount({
            request: { user_id: userId }
        }, (error, result) => {
            if (error) {
                console.error('Error fetching unread count:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch unread count'
                });
            }

            res.json({
                success: true,
                unreadCount: result.unread_count
            });
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch unread count'
        });
    }
});

// Get user details (for friends/messaging) - bypasses role restrictions
app.get('/users/:userId', authMiddleware, async (req, res) => {
    try {
        const requestingUserId = req.user.id;
        const { userId } = req.params;
        const targetUserId = parseInt(userId);

        // Get user details
        const result = await db.query(`
            SELECT 
                u.id, 
                u.email, 
                u.firstname, 
                u.lastname, 
                u.picture,
                u.location,
                u.rating
            FROM users u
            WHERE u.id = $1 AND u.is_active = true
        `, [targetUserId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent((user.firstname || '') + ' ' + (user.lastname || ''))}`,
                location: user.location,
                rating: user.rating
            }
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user details'
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
    const client = await db.pool.connect();
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

        await client.query('BEGIN');

        // Lock the participant row to prevent concurrent updates
        const check = await client.query(`
            SELECT id FROM activity_participants
            WHERE activity_id = $1 AND user_id = $2
            FOR UPDATE
        `, [activityId, userId]);

        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'You are not invited to this activity'
            });
        }

        await client.query(`
            UPDATE activity_participants 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE activity_id = $2 AND user_id = $3
        `, [status, activityId, userId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Response updated successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating activity response:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update response'
        });
    } finally {
        client.release();
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Social service running on port ${PORT}`);
});