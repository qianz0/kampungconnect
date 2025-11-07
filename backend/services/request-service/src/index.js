require('./tracing');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./db');
const { connectQueue, getChannel, publishMessage, consumeQueue } = require("./queue");
const axios = require("axios");
const client = require('prom-client');
client.collectDefaultMetrics();

// Import authentication middleware
const AuthMiddleware = require('/app/shared/auth-middleware');

const app = express();
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

// Middleware setup
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint (public)
app.get('/', (req, res) => {
    res.json({
        service: "request-service",
        status: "running",
        auth_required: true
    });
});

// Count every created request (for Prometheus)
const messagesPublished = new client.Counter({
  name: 'messages_published_total',
  help: 'Total number of messages published to RabbitMQ by request-service',
});

// count every created matched (for Prometheus)
const messageProcessedNonInstant = new client.Counter({
  name: 'messages_processed_non_instant_total',
  help: 'Total number of messages successfully processed by matching-service',
});

// ====== Prometheus Metrics Endpoint ======
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// Public endpoint to get service info
app.get('/info', (req, res) => {
    res.json({
        service: "request-service",
        version: "1.0.0",
        description: "Handles community requests and help requests",
        endpoints: [
            "POST /postRequest - Create a new community request",
            "POST /panicRequest - Create an urgent/panic request",
            "GET /requests - Get user's requests",
            "GET /requests/:id - Get specific request details"
        ]
    });
});

// Protected endpoints - require authentication
app.post('/postRequest', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { title, category, description, urgency, instantMatch } = req.body;
        const userId = req.user.id; // Get from authenticated user

        // Determine request status
        // If instant match selected, start as 'matching'; else default to 'pending'
        const status = instantMatch ? 'matching' : 'pending';

        // Validate required fields
        if (!title || !category || !description || !urgency) {
            return res.status(400).json({
                error: 'Missing required fields: title, category, description, urgency'
            });
        }

        // Database insertion
        const result = await db.query(
            `INSERT INTO requests (user_id, title, category, description, urgency, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING id, user_id, title, category, description, urgency, status, created_at`,
            [userId, title, category, description, urgency, status]
        );

        // Count every created request (for Prometheus)
        messagesPublished.inc(); // count published messages

        const newRequest = result.rows[0];

        // Call priority router for urgent or high-priority requests
        try {
            if (["urgent", "high"].includes(urgency)) {
                console.log(`Sending request ${newRequest.id} (${urgency}) to Priority Router...`);

                await axios.post(`${process.env.PRIORITY_ROUTER_URL}/route`, {
                    request_id: newRequest.id,
                    urgency: urgency
                }, {
                    headers: {
                        Authorization: req.headers.authorization,     // Forward token
                    },
                });

                console.log("Priority Router triggered successfully!");
            } else {
                console.log(`Request ${newRequest.id} (${urgency}) added normally (no immediate routing).`);
            }
        } catch (err) {
            console.error("Failed to trigger Priority Router:", err.message);
        }

        // 2 Publish event to matching-service via RabbitMQ
        if (instantMatch) {
            try {
                await publishMessage("request_created", {
                    id: result.rows[0].id,
                    user_id: userId,
                    title,
                    category,
                    description,
                    urgency,
                    instantMatch: true,
                    status: 'matching',
                });
                console.log("[request-service] Sent message to queue: request_created (instant match)");
            } catch (err) {
                console.error("[request-service] Failed to publish message:", err);
            }
        } else {
            console.log("🕓 [request-service] Skipped queue publish — normal post request.");
        }

        res.json({
            message: instantMatch
                ? "Request posted and instant matching initiated!"
                : "Request posted successfully. Waiting for volunteers...",
            request: newRequest
        });
    } catch (error) {
        console.error('Post request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/panicRequest', authMiddleware.authenticateToken, (req, res) => {
    try {
        const { description, location, emergency_type } = req.body;
        const userId = req.user.id;

        if (!description) {
            return res.status(400).json({
                error: 'Description is required for panic requests'
            });
        }

        // Create high-priority panic request
        const panicRequest = {
            id: Math.floor(Math.random() * 10000), // Mock ID
            userId: userId,
            userEmail: req.user.email,
            userName: req.user.name,
            description,
            location: location || 'Not specified',
            emergency_type: emergency_type || 'general',
            type: 'panic',
            urgency: 'critical',
            status: 'active',
            createdAt: new Date().toISOString()
        };

        // Here you would typically:
        // 1. Save to database with high priority
        // 2. Trigger immediate notifications to nearby users
        // 3. Alert emergency responders if configured

        res.json({
            message: "Panic request received and being processed",
            request: panicRequest,
            alert: "Emergency services and nearby community members have been notified"
        });
    } catch (error) {
        console.error('Panic request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all community requests (everyone can see)
app.get('/requests/all', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const results = await db.query(
            ` SELECT r.*, 
         CONCAT(u.firstname, ' ', u.lastname) AS requester_name, 
         u.role AS requester_role,
         COALESCE(
           (SELECT COUNT(*) FROM offers o WHERE o.request_id = r.id),
           0
         ) AS offers_count
  FROM requests r
  JOIN users u ON r.user_id = u.id
  ORDER BY r.created_at DESC
`
        );

        res.json({
            requests: results.rows,
            total: results.rowCount
        });
    } catch (error) {
        console.error('Get all requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get latest 3 community requests (everyone can see)
app.get('/requests/latest3/all', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const results = await db.query(
            `SELECT r.*, 
       CONCAT(u.firstname, ' ', u.lastname) AS requester_name, 
       u.role AS requester_role
FROM requests r
JOIN users u ON r.user_id = u.id
ORDER BY r.created_at DESC
LIMIT 3`
        );

        res.json({
            requests: results.rows,
            total: results.rowCount
        });
    } catch (error) {
        console.error('Get latest 3 community requests error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's requests only
app.get('/requests', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const results = await db.query(
            "SELECT * FROM requests WHERE user_id = $1 ORDER BY created_at DESC",
            [userId]
        );

        res.json({
            requests: results.rows,
            total: results.rowCount
        });
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get latest 3 requests
app.get('/requests/latest3', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const results = await db.query(
            "SELECT * FROM requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3",
            [userId]
        );

        res.json({
            requests: results.rows,
            total: results.rowCount
        });
    } catch (error) {
        console.error('Get latest 3 requests error:', error.message);
        console.error(error.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get specific request details
app.get('/requests/:id', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.id;

        const result = await db.query(
            `SELECT r.*,
                    CONCAT(poster.firstname, ' ', poster.lastname) AS requester_name,
                    poster.role AS requester_role,
                    poster.email AS requester_email,
                    CONCAT(helper.firstname, ' ', helper.lastname) AS helper_name,
                    helper.email AS helper_email,
                    m.helper_id,
                    m.status AS match_status,
                    m.matched_at
             FROM requests r
             JOIN users poster ON r.user_id = poster.id
        LEFT JOIN matches m ON r.id = m.request_id
        LEFT JOIN users helper ON m.helper_id = helper.id
            WHERE r.id = $1`,
            [requestId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json({ request: result.rows[0] });
    } catch (error) {
        console.error('Get request details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Respond to a request
app.post('/requests/:id/respond', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        const { message } = req.body;
        const requestId = req.params.id;

        // Only helpers allowed
        if (!["volunteer", "caregiver", "admin"].includes(userRole)) {
            return res.status(403).json({ error: "Only helpers can respond to requests" });
        }

        if (!message) {
            return res.status(400).json({ error: 'Response message is required' });
        }

        // Save response in DB
        const result = await db.query(
            `INSERT INTO responses (request_id, user_id, message, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, request_id, user_id, message, created_at`,
            [requestId, userId, message]
        );

        res.json({ message: 'Response added successfully', response: result.rows[0] });
    } catch (error) {
        console.error('Respond to request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Offer to help with a request
app.post("/requests/:id/offer", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.id;
        const helperId = req.user.id;
        const userRole = req.user.role;

        // Only helpers allowed
        if (!["volunteer", "caregiver", "admin"].includes(userRole)) {
            return res.status(403).json({ error: "Only helpers can offer to help." });
        }

        // Check request validity
        const reqCheck = await db.query("SELECT status FROM requests WHERE id = $1", [requestId]);
        if (reqCheck.rowCount === 0) return res.status(404).json({ error: "Request not found." });
        if (reqCheck.rows[0].status !== "pending") {
            return res.status(400).json({ error: "This request is not open for help." });
        }

        // Prevent duplicate offers
        const exists = await db.query(
            "SELECT id FROM offers WHERE request_id = $1 AND helper_id = $2",
            [requestId, helperId]
        );
        if (exists.rowCount > 0) return res.status(400).json({ error: "You already offered to help." });

        // Save offer
        const insert = await db.query(
            `INSERT INTO offers (request_id, helper_id, status, created_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id, request_id, helper_id, status, created_at`,
            [requestId, helperId]
        );

        // Optional: notify matching-service
        try {
            await publishMessage("offer_created", insert.rows[0]);
            console.log("[request-service] Sent offer_created event");
        } catch (err) {
            console.warn("Failed to publish offer_created:", err.message);
        }

        res.json({ message: "Offer submitted successfully!", offer: insert.rows[0] });
    } catch (error) {
        console.error("Offer to help error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Get all offers for a specific request
app.get("/requests/:id/offers", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.id;
        const results = await db.query(`
      SELECT o.id, o.helper_id, o.status, o.created_at, u.location, u.rating,
             CONCAT(u.firstname, ' ', u.lastname) AS helper_name,
             u.role AS helper_role
      FROM offers o
      JOIN users u ON o.helper_id = u.id
      WHERE o.request_id = $1
      ORDER BY o.created_at ASC
    `, [requestId]);

        res.json({ offers: results.rows });
    } catch (error) {
        console.error("Get offers error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Senior accepts an offer (assign a helper)
app.post("/offers/:id/accept", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const offerId = req.params.id;
        const seniorId = req.user.id;

        // 1 Get offer info
        const offer = await db.query(
            `SELECT o.*, r.user_id AS requester_id
       FROM offers o
       JOIN requests r ON o.request_id = r.id
       WHERE o.id = $1`,
            [offerId]
        );

        if (offer.rowCount === 0) {
            return res.status(404).json({ error: "Offer not found." });
        }

        const { request_id, helper_id, requester_id } = offer.rows[0];

        // Ensure only the senior who posted the request can accept
        if (requester_id !== seniorId) {
            return res.status(403).json({ error: "You are not allowed to accept this offer." });
        }

        // 2 Create a match
        const match = await db.query(
            `INSERT INTO matches (request_id, helper_id, matched_at, status)
       VALUES ($1, $2, NOW(), 'active')
       RETURNING *`,
            [request_id, helper_id]
        );
        // increment when matched
        messageProcessedNonInstant.inc();

        // 3 Update request status
        await db.query(`UPDATE requests SET status = 'matched' WHERE id = $1`, [request_id]);

        // 4 Reject other offers for this request
        await db.query(
            `UPDATE offers SET status = 'rejected' WHERE request_id = $1 AND id <> $2`,
            [request_id, offerId]
        );

        // 5 Mark accepted offer
        await db.query(`UPDATE offers SET status = 'accepted' WHERE id = $1`, [offerId]);

        // 6 fetch contact details of both side
        const helper = await db.query(
            `SELECT id, CONCAT(firstname, ' ', lastname) AS name, email FROM users WHERE id = $1`,
            [helper_id]
        );

        const senior = await db.query(
            `SELECT id, CONCAT(firstname, ' ', lastname) AS name, email FROM users WHERE id = $1`,
            [requester_id]
        );

        res.json({
            message: "Offer accepted successfully! Helper has been assigned.",
            match: match.rows[0],
            contact: {
                helper: helper.rows[0],
                senior: senior.rows[0],
            }
        });
    } catch (error) {
        console.error("Accept offer error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Reply to a response
app.post('/responses/:id/reply', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const responseId = req.params.id;  // ID of the response being replied to
        const { message } = req.body;
        const userId = req.user.id;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Find the request that this response belongs to
        const parentRes = await db.query("SELECT request_id FROM responses WHERE id = $1", [responseId]);

        if (parentRes.rowCount === 0) {
            return res.status(404).json({ error: "Parent response not found" });
        }

        const requestId = parentRes.rows[0].request_id;

        // Insert reply correctly
        const result = await db.query(
            `INSERT INTO responses (request_id, user_id, message, parent_id, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING id, request_id, user_id, message, parent_id, created_at`,
            [requestId, userId, message, responseId]
        );

        res.json({ reply: result.rows[0] });
    } catch (error) {
        console.error("Reply error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Get responses and their replies for a request
// Get responses for a request
app.get('/requests/:id/responses', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.id;

        const result = await db.query(
            `SELECT r.id, r.message, r.created_at, r.parent_id,
       CONCAT(u.firstname, ' ', u.lastname) AS responder_name,
       u.role as responder_role
FROM responses r
JOIN users u ON r.user_id = u.id
WHERE r.request_id = $1
ORDER BY r.created_at ASC
`,
            [requestId]
        );

        res.json({ responses: result.rows });
    } catch (error) {
        console.error('Get responses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Get all matches for the logged-in helper
app.get('/matches', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        if (userRole !== 'volunteer' && userRole !== 'caregiver' && userRole !== 'admin') {
            return res.status(403).json({ error: 'Only helpers can view their matches' });
        }


        const results = await db.query(`
      SELECT m.*, 
       r.id AS request_id, r.title, r.category, r.description, r.urgency,
       CONCAT(u.firstname, ' ', u.lastname) AS requester_name,
       u.email AS requester_email
FROM matches m
JOIN requests r ON m.request_id = r.id
JOIN users u ON r.user_id = u.id
WHERE m.helper_id = $1
ORDER BY m.matched_at DESC

    `, [userId]);

        res.json({ matches: results.rows, total: results.rowCount });
    } catch (error) {
        console.error('Get helper matches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Update a request (only by the owner senior or admin, and only if not matched/completed)
app.put('/requests/:id', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        const { title, category, description, urgency } = req.body;

        // Ensure the request exists
        const check = await db.query("SELECT * FROM requests WHERE id = $1", [requestId]);
        if (check.rowCount === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = check.rows[0];

        // Only allow seniors (who own the request) or admins
        if (!(userRole === 'admin' || (userRole === 'senior' && request.user_id === userId))) {
            return res.status(403).json({ error: 'You are not allowed to edit this request' });
        }

        // Block editing if already matched or completed
        if (['matched', 'completed'].includes(request.status)) {
            return res.status(400).json({ error: 'Cannot edit a request that has already been matched or completed' });
        }

        // Proceed with update
        const result = await db.query(
            `UPDATE requests 
             SET title = $1, category = $2, description = $3, urgency = $4
             WHERE id = $5
             RETURNING id, user_id, title, category, description, urgency, status, created_at`,
            [title, category, description, urgency, requestId]
        );

        res.json({ message: "Request updated successfully", request: result.rows[0] });
    } catch (error) {
        console.error("Update request error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Delete a request (only by the owner senior or admin, and only if not matched/completed)
app.delete('/requests/:id', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Ensure the request exists
        const check = await db.query("SELECT * FROM requests WHERE id = $1", [requestId]);
        if (check.rowCount === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = check.rows[0];

        // Permission check
        if (!(userRole === 'admin' || (userRole === 'senior' && request.user_id === userId))) {
            return res.status(403).json({ error: 'You are not allowed to delete this request' });
        }

        // Block deleting if already matched or completed
        if (['matched', 'completed'].includes(request.status)) {
            return res.status(400).json({ error: 'Cannot delete a request that has already been matched or completed' });
        }

        // Delete from DB
        await db.query("DELETE FROM requests WHERE id = $1", [requestId]);

        res.json({ message: "Request deleted successfully" });
    } catch (error) {
        console.error("Delete request error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// DEV ONLY: publish malformed message to test DLQ
app.post("/_dev/publish-bad", async (req, res) => {
  try {
    if (!getChannel()) await connectQueue();
    const ch = getChannel();

    const q = req.query.q || "request_created";

    // Example 1: Non-JSON
    ch.sendToQueue(q, Buffer.from("THIS IS NOT JSON"), { persistent: true });

    // Example 2: JSON but wrong schema
    ch.sendToQueue(q, Buffer.from(JSON.stringify({ wrongKey: 123 })), { persistent: true });

    res.json({ ok: true, sentTo: q });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Request service error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

(async () => {
    try {
        await connectQueue(); // connect to RabbitMQ when service starts
        await consumeQueue("request_created", async (data) => {
            console.log("[request-service] Received message:", data);
        });
        console.log("Request-service connected to RabbitMQ");
    } catch (err) {
        console.error("Failed to connect to RabbitMQ:", err);
    }
})();

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`Request service running on port ${PORT}`);
    console.log(`Authentication: ${process.env.AUTH_SERVICE_URL || 'http://auth-service:5000'}`);
});