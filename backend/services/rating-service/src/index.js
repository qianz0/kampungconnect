require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./db');
const ratingRoutes = require('./routes/ratingRoutes');

let authMiddlewarePath;
if (process.env.NODE_ENV === 'docker') {
  authMiddlewarePath = '/app/shared/auth-middleware';
} else {
  authMiddlewarePath = '../../../shared/auth-middleware';
}
const AuthMiddleware = require(authMiddlewarePath);

const app = express();
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

// ==================
// Middleware setup
// ================== 
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
  })
);
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
  res.status(500).json({ error: 'Internal server error' });
});

// ==================
// Start server
// ==================
const PORT = process.env.PORT || 5006;
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