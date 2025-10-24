require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require("./db"); // your db.js file
const { connectQueue, consumeQueue } = require("./queue");
const { findBestHelper } = require("./matcher");
const AuthMiddleware = require("/app/shared/auth-middleware");

const app = express();
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

// ==================
// Middleware setup
// ==================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true, // ✅ needed for cookie-based Google auth
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

// ==================
// Get all matches (admin/debug)
// ==================
app.get("/matches", authMiddleware.authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT m.*, 
       r.title, r.category, r.urgency,
       CONCAT(s.firstName, ' ', s.lastName) AS senior_name,
       CONCAT(h.firstName, ' ', h.lastName) AS helper_name
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
       CONCAT(h.firstName, ' ', h.lastName) AS helper_name,
       h.rating AS helper_rating
FROM matches m
JOIN requests r ON m.request_id = r.id
JOIN users h ON m.helper_id = h.id
WHERE r.user_id = $1
ORDER BY m.matched_at DESC

    `,
      [userId]
    );
    res.json({ matches: result.rows });
  } catch (err) {
    console.error("Error fetching senior matches:", err);
    res.status(500).json({ error: "Internal server error" });
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
       CONCAT(s.firstName, ' ', s.lastName) AS senior_name,
       s.rating AS senior_rating
FROM matches m
JOIN requests r ON m.request_id = r.id
JOIN users s ON r.user_id = s.id
WHERE m.helper_id = $1
ORDER BY m.matched_at DESC

    `,
      [userId]
    );
    res.json({ matches: result.rows });
  } catch (err) {
    console.error("Error fetching helper matches:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================
// Manual match assignment
// ==================
app.post("/matches/assign", authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { request_id, helper_id } = req.body;

    if (!request_id || !helper_id) {
      return res.status(400).json({ error: "request_id and helper_id are required" });
    }

    const result = await db.query(
      `INSERT INTO matches (request_id, helper_id, status)
       VALUES ($1, $2, 'active')
       RETURNING *`,
      [request_id, helper_id]
    );

    await db.query(`UPDATE requests SET status = 'matched' WHERE id = $1`, [request_id]);

    res.json({ message: "Match created successfully", match: result.rows[0] });
  } catch (err) {
    console.error("Error assigning match:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================
// Mark match complete
// ==================
app.post("/matches/:id/complete", authMiddleware.authenticateToken, async (req, res) => {
  try {
    const matchId = req.params.id;
    const helperId = req.user.id;

     // Validate match ownership
    const match = await db.query(
      `SELECT * FROM matches WHERE id = $1 AND helper_id = $2`,
      [matchId, helperId]
    );

    

    if (match.rowCount === 0) {
      return res.status(404).json({ error: "Match not found or not assigned to you." });
    }

    const requestId = match.rows[0].request_id;


     // Update match and request status
    await db.query(`UPDATE matches SET status = 'completed' WHERE id = $1`, [matchId]);
    await db.query(`UPDATE requests SET status = 'fulfilled' WHERE id = $1`, [requestId]);

    res.json({ message: "Request marked as completed successfully." });
  } catch (err) {
    console.error("Error completing match:", err);
    res.status(500).json({ error: "Internal server error" });
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

  try {
    // Find a helper
    const helper = await findBestHelper(request);

    if (!helper) {
      console.log("No suitable helper found for request:", request.id);
      return;
    }

    // Insert match into DB
    const result = await db.query(
      `INSERT INTO matches (request_id, helper_id, status)
       VALUES ($1, $2, 'active')
       RETURNING *`,
      [request.id, helper.id]
    );

    // Update the request to 'matched'
    await db.query(`UPDATE requests SET status = 'matched' WHERE id = $1`, [request.id]);

    console.log("✅ Match created:", result.rows[0]);
  } catch (err) {
    console.error("Error handling new request:", err);
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
