// Load environment variables. The monorepo/service layout places a single .env at the repo root
// so resolve the file path relative to this file's location so dotenv can find it when
// the service is started from its own folder.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./db');
const ratingRoutes = require('./routes/ratingRoutes');

// Import authentication middleware
const AuthMiddleware = require('../shared/auth-middleware');

const app = express();
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

// Middleware setup
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

// ==================
// Health check
// ==================
app.get('/', (req, res) => {
  res.json({ service: 'rating-service', status: 'running' });
});

// ==================
// Rating routes
// ==================
app.use('/api/ratings', ratingRoutes);

// ==================
// Global error handler
// ==================
app.use((err, req, res, next) => {
  console.error('Rating-service error:', err);
  console.error('Stack trace:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    path: req.path
  });
});

// ==================
// Start server
// ==================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Rating-service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await db.end();
  process.exit(0);
});