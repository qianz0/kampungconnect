require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./db');
const { connectQueue, publishMessage } = require("./queue");


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
app.post('/postRequest', authMiddleware.authenticateToken, async(req, res) => {
    try {
        const { title, category, description, urgency } = req.body;
        const userId = req.user.id; // Get from authenticated user
        
        // Validate required fields
        if (!title || !category || !description || !urgency) {
            return res.status(400).json({
                error: 'Missing required fields: title, category, description, urgency'
            });
        }
        
        // Database insertion
        const result = await db.query(
            `INSERT INTO requests (user_id, title, category, description, urgency, status, created_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
             RETURNING id, user_id, title, category, description, urgency, status, created_at`,
            [userId, title, category, description, urgency]
        );

         // 2️⃣ Publish event to matching-service via RabbitMQ
        try {
            await publishMessage("request_created", {
                id: result.rows[0].id,
                user_id: userId,
                title,
                category,
                description,
                urgency,
        });
        console.log("📤 [request-service] Sent message to queue: request_created");
        }   catch (err) {
        console.error("❌ [request-service] Failed to publish message:", err);
        }
        
        res.json({ 
            message: "Request posted successfully", 
            request: result.rows[0]
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
            `SELECT r.*, 
       CONCAT(u.firstName, ' ', u.lastName) AS requester_name, 
       u.role AS requester_role
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
       CONCAT(u.firstName, ' ', u.lastName) AS requester_name, 
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
app.get('/requests', authMiddleware.authenticateToken, async(req, res) => {
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
app.get('/requests/latest3', authMiddleware.authenticateToken, async(req, res) => {
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
       CONCAT(poster.firstName, ' ', poster.lastName) AS requester_name,
       poster.role AS requester_role,
       CONCAT(helper.firstName, ' ', helper.lastName) AS fulfilled_by_name,
       helper.rating AS fulfilled_by_rating
FROM requests r
JOIN users poster ON r.user_id = poster.id
LEFT JOIN matches m ON r.id = m.request_id
LEFT JOIN users helper ON m.helper_id = helper.id
WHERE r.id = $1
`,
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

    if (userRole !== 'helper') {
      return res.status(403).json({ error: 'Only helpers can respond to requests' });
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
       CONCAT(u.firstName, ' ', u.lastName) AS responder_name,
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
       CONCAT(u.firstName, ' ', u.lastName) AS requester_name,
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



// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Request service error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

(async () => {
  try {
    await connectQueue(); // ✅ connect to RabbitMQ when service starts
    console.log("✅ Request-service connected to RabbitMQ");
  } catch (err) {
    console.error("❌ Failed to connect to RabbitMQ:", err);
  }
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Request service running on port ${PORT}`);
    console.log(`Authentication: ${process.env.AUTH_SERVICE_URL || 'http://auth-service:5000'}`);
});