require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

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
app.post('/postRequest', authMiddleware.authenticateToken, (req, res) => {
    try {
        const { category, description, type, urgency } = req.body;
        const userId = req.user.id; // Get from authenticated user
        
        // Validate required fields
        if (!category || !description || !type) {
            return res.status(400).json({ 
                error: 'Missing required fields: category, description, type' 
            });
        }
        
        // Here you would typically save to database
        const requestData = {
            id: Math.floor(Math.random() * 10000), // Mock ID
            userId: userId,
            userEmail: req.user.email,
            userName: req.user.name,
            category,
            description,
            type,
            urgency: urgency || 'normal',
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        res.json({ 
            message: "Request posted successfully", 
            request: requestData
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

// Get user's requests
app.get('/requests', authMiddleware.authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        
        // Mock data - in production, fetch from database
        const userRequests = [
            {
                id: 1,
                category: 'transportation',
                description: 'Need a ride to the hospital',
                type: 'help',
                urgency: 'high',
                status: 'fulfilled',
                createdAt: '2025-09-25T10:30:00Z'
            },
            {
                id: 2,
                category: 'food',
                description: 'Looking for someone to share grocery shopping',
                type: 'collaboration',
                urgency: 'normal',
                status: 'pending',
                createdAt: '2025-09-29T14:15:00Z'
            }
        ];
        
        res.json({ 
            requests: userRequests,
            total: userRequests.length
        });
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get specific request details
app.get('/requests/:id', authMiddleware.authenticateToken, (req, res) => {
    try {
        const requestId = req.params.id;
        const userId = req.user.id;
        
        // Mock data - verify user owns this request or has permission to view
        const requestDetails = {
            id: requestId,
            userId: userId,
            category: 'transportation',
            description: 'Need a ride to the hospital for check-up',
            type: 'help',
            urgency: 'high',
            status: 'fulfilled',
            createdAt: '2025-09-25T10:30:00Z',
            fulfilledAt: '2025-09-25T11:45:00Z',
            fulfilledBy: {
                name: 'John Doe',
                rating: 4.8
            },
            responses: [
                {
                    userId: 'user123',
                    name: 'John Doe',
                    message: 'I can help you with this!',
                    timestamp: '2025-09-25T10:35:00Z'
                }
            ]
        };
        
        res.json({ request: requestDetails });
    } catch (error) {
        console.error('Get request details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Request service error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Request service running on port ${PORT}`);
    console.log(`Authentication: ${process.env.AUTH_SERVICE_URL || 'http://auth-service:5000'}`);
});