require('./tracing');
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require("./db");
const { connectQueue, consumeQueue, publishMessage } = require("./queue");
const { findBestHelper } = require("./matcher");
const AuthMiddleware = require("/app/shared/auth-middleware");
const client = require('prom-client');
const { getAreaFromPostalCode } = require("./postal-utils");

const app = express();
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

// ==================
// Middleware setup
// ==================
// Allow multiple origins for local development and production
const allowedOrigins = [
    'http://localhost:8080',
    'http://frontend:80',
    'http://localhost:80',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(
    cors({
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
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

// ==================
// Health check
// ==================
app.get("/", (req, res) => {
    res.json({ service: "matching-service", status: "running" });
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


// ==================
// Get all matches (admin/debug)
// ==================
app.get("/matches", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT m.*, 
       r.title, r.category, r.urgency,
       CONCAT(s.firstname, ' ', s.lastname) AS senior_name,
       CONCAT(h.firstname, ' ', h.lastname) AS helper_name
FROM matches m
JOIN requests r ON m.request_id = r.id
JOIN users s ON r.user_id = s.id
JOIN users h ON m.helper_id = h.id
ORDER BY m.matched_at DESC
    `);
        res.json({ matches: result.rows });
    } catch (err) {
        console.error("Error fetching matches:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==================
// Senior’s matches
// ==================
app.get("/matches/senior", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query(
            `
    SELECT m.*, 
       r.title, r.category, r.urgency, r.status AS request_status,
       CONCAT(h.firstname, ' ', h.lastname) AS helper_name,
       h.rating AS helper_rating,
       h.location AS helper_location
FROM matches m
JOIN requests r ON m.request_id = r.id
JOIN users h ON m.helper_id = h.id
WHERE r.user_id = $1
ORDER BY m.matched_at DESC

    `,
            [userId]
        );
        const rows = result.rows.map(r => ({
            ...r,
            helper_area: getAreaFromPostalCode(r.helper_location)
        }));
        res.json({ matches: rows });
    } catch (err) {
        console.error("Error fetching senior matches:", err);
        res.status(500).json({ 
            error: "Internal server error",
            message: err.message,
            matches: []
        });
    }
});

// ==================
// Helper’s matches
// ==================
app.get("/matches/helper", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query(
            `
SELECT m.*, 
       r.title, r.category, r.urgency, r.status AS request_status,
       CONCAT(s.firstname, ' ', s.lastname) AS senior_name,
       s.rating AS senior_rating,
       s.location AS senior_location,
       (SELECT COUNT(*) FROM matches WHERE helper_id = m.helper_id AND status = 'active') AS active_count
FROM matches m
JOIN requests r ON m.request_id = r.id
JOIN users s ON r.user_id = s.id
WHERE m.helper_id = $1
ORDER BY m.matched_at DESC;
    `,
            [userId]
        );
        const rows = result.rows.map(m => ({
            ...m,
            senior_area: getAreaFromPostalCode(m.senior_location)
        }));
        res.json({ matches: rows });
    } catch (err) {
        console.error("Error fetching helper matches:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==================
// Get available helpers
// ==================
app.get("/helpers/available", authMiddleware.authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT id, firstname, lastname, rating, role
      FROM users
      WHERE role IN ('volunteer', 'caregiver')
        AND is_active = TRUE
      ORDER BY rating DESC;
    `);

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching available helpers:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==================
// Manual match assignment
// ==================
app.post("/matches/assign", authMiddleware.authenticateToken, async (req, res) => {
    const client = await db.connect();
    try {
        const { request_id, helper_id } = req.body;

        if (!request_id || !helper_id) {
            return res.status(400).json({ error: "request_id and helper_id are required" });
        }

        await client.query('BEGIN');

        // Lock the request row to prevent concurrent matches
        const requestCheck = await client.query(
            `SELECT status FROM requests WHERE id = $1 FOR UPDATE`,
            [request_id]
        );

        if (requestCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Request not found" });
        }

        if (requestCheck.rows[0].status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Request is not available for matching" });
        }

        const result = await client.query(
            `INSERT INTO matches (request_id, helper_id, status)
       VALUES ($1, $2, 'active')
       RETURNING *`,
            [request_id, helper_id]
        );

        await client.query(`UPDATE requests SET status = 'matched' WHERE id = $1`, [request_id]);

        await client.query('COMMIT');

        res.json({ message: "Match created successfully", match: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error assigning match:", err);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

// ==================
// Mark match complete
// ==================
app.post("/matches/:id/complete", authMiddleware.authenticateToken, async (req, res) => {
    const client = await db.connect();
    try {
        const matchId = req.params.id;
        const helperId = req.user.id;

        await client.query('BEGIN');

        // Validate match ownership with row lock
        const match = await client.query(
            `SELECT * FROM matches WHERE id = $1 AND helper_id = $2 FOR UPDATE`,
            [matchId, helperId]
        );

        if (match.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Match not found or not assigned to you." });
        }

        if (match.rows[0].status === 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Match already completed" });
        }

        const requestId = match.rows[0].request_id;

        // Update match and request status
        await client.query(`UPDATE matches SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`, [matchId]);
        await client.query(`UPDATE requests SET status = 'fulfilled' WHERE id = $1`, [requestId]);

        // Update helper active to true
        await client.query(`UPDATE users SET is_active = TRUE WHERE id = $1`, [helperId]);

        await client.query('COMMIT');

        res.json({ message: "Request marked as completed successfully." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error completing match:", err);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

// ==================
// Global error handler
// ==================
app.use((err, req, res, next) => {
    console.error("Matching-service error:", err);
    res.status(500).json({ error: "Internal server error" });
});

// ==================
// Auto-Matching Logic (new addition)
// ==================
async function handleNewRequest(request) {
    console.log("New request received:", request);

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Lock the request row to prevent concurrent matches
        const requestCheck = await client.query(
            `SELECT status FROM requests WHERE id = $1 FOR UPDATE`,
            [request.id]
        );

        if (requestCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            console.log(`Request ${request.id} not found`);
            return;
        }

        // Check if already matched
        if (requestCheck.rows[0].status !== 'pending' && requestCheck.rows[0].status !== 'matching') {
            await client.query('ROLLBACK');
            console.log(`Request ${request.id} already matched or not available`);
            return;
        }

        // Find a helper
        const helper = await findBestHelper(request);

        if (!helper) {
            await client.query('ROLLBACK');
            // console.log(`No helper found for request ${request.id}. Retrying in 30s...`);
            await publishMessage("request_retry", request);
            return;
        }

        // Insert match into DB
        const result = await client.query(
            `INSERT INTO matches (request_id, helper_id, status)
       VALUES ($1, $2, 'active')
       RETURNING *`,
            [request.id, helper.id]
        );

        // Update the request to 'matched'
        await client.query(`UPDATE requests SET status = 'matched' WHERE id = $1`, [request.id]);

        await client.query('COMMIT');

        // console.log(" Match created:", result.rows[0]);

        // Send email notification to the matched helper
        try {
            const axios = require('axios');

            // Get helper's email and role
            const helperData = await db.query(
                `SELECT email, role FROM users WHERE id = $1`,
                [helper.id]
            );

            if (helperData.rows.length > 0) {
                const helperEmail = helperData.rows[0].email;
                const helperRole = helperData.rows[0].role;

                // Get senior's name and email
                const seniorData = await db.query(
                    `SELECT CONCAT(firstname, ' ', lastname) AS name, email FROM users WHERE id = $1`,
                    [request.user_id]
                );

                const seniorName = seniorData.rows.length > 0
                    ? seniorData.rows[0].name
                    : 'A community member';
                const seniorEmail = seniorData.rows.length > 0
                    ? seniorData.rows[0].email
                    : null;

                // Notify helper about instant match
                await axios.post('http://notification-service:5000/notify/instant-match', {
                    helperId: helper.id,
                    helperEmail: helperEmail,
                    helperName: helper.name,
                    helperRole: helperRole,
                    requestTitle: request.title,
                    requestDescription: request.description,
                    seniorName: seniorName,
                    category: request.category,
                    urgency: request.urgency,
                    requestId: request.id
                });

                // Notify senior about instant match
                if (seniorEmail) {
                    await axios.post('http://notification-service:5000/notify/senior-match', {
                        seniorId: request.user_id,
                        seniorEmail: seniorEmail,
                        seniorName: seniorName,
                        helperName: helper.name,
                        helperRole: helperRole,
                        requestTitle: request.title,
                        requestDescription: request.description,
                        category: request.category,
                        urgency: request.urgency,
                        requestId: request.id
                    });
                }

                // console.log(` Instant match notification sent to ${helperRole}: ${helperEmail}`);
            }
        } catch (notifyErr) {
            // console.warn('Failed to send instant match notification:', notifyErr.message);
            // Don't fail the match creation if notification fails
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error handling new request:", err);
    } finally {
        client.release();
    }
}

// ==================
// Start server and queue listener safely
// ==================
(async () => {
    try {
        // 🟢 Connect to RabbitMQ
        await connectQueue();
        await consumeQueue("request_created", handleNewRequest);
        console.log("✅ Matching-service connected to RabbitMQ and listening for requests");

        // 🟢 Start server
        const PORT = process.env.PORT || 5003;
        app.listen(PORT, () => {
            console.log(`✅ Matching-service running on port ${PORT}`);
        });
    } catch (err) {
        console.error("❌ Failed to initialize matching-service:", err);
    }
})();