const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const router = express.Router();

const AuthMiddleware = require('../../shared/auth-middleware');

// Import individual controller functions
const createRating = require('../controllers/createRating');
const getHelperRatings = require('../controllers/getHelperRatings');
const getMyRatings = require('../controllers/getMyRatings');
const updateRating = require('../controllers/updateRating');
const deleteRating = require('../controllers/deleteRating');
const getPendingRatings = require('../controllers/getPendingRatings');

// Initialize auth middleware
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

// ==================
// Public endpoint - Get helper ratings (anyone can view)
// ==================
router.get('/helper/:helperId', authMiddleware.authenticateToken, getHelperRatings);

// ==================
// Protected endpoints (require authentication)
// ==================
// Submit a new rating
router.post('/', authMiddleware.authenticateToken, createRating);

// Get ratings submitted by current user (senior)
router.get('/my-ratings', authMiddleware.authenticateToken, getMyRatings);

// Update an existing rating
router.put('/:ratingId', authMiddleware.authenticateToken, updateRating);

// Delete a rating
router.delete('/:ratingId', authMiddleware.authenticateToken, deleteRating);

// Get completed matches that haven't been rated yet
router.get('/pending-ratings', authMiddleware.authenticateToken, getPendingRatings);

module.exports = router;