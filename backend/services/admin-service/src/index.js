require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const AuthMiddleware = require('../shared/auth-middleware');

const app = express();
const authMiddleware = new AuthMiddleware();

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'kampungconnect',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Database connected successfully');
    }
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(express.json());

// Admin-only middleware
const requireAdmin = authMiddleware.requireRole('admin');

// Health check
app.get('/', (req, res) => {
    res.json({
        service: 'admin-service',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// ============= DASHBOARD STATISTICS =============

// Get dashboard overview statistics
app.get('/api/admin/stats/overview', 
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const stats = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM users WHERE role = 'senior') as total_seniors,
                    (SELECT COUNT(*) FROM users WHERE role = 'volunteer') as total_volunteers,
                    (SELECT COUNT(*) FROM users WHERE role = 'caregiver') as total_caregivers,
                    (SELECT COUNT(*) FROM users WHERE role = 'admin') as total_admins,
                    (SELECT COUNT(*) FROM users WHERE role IS NULL OR email_verified = false) as pending_users,
                    (SELECT COUNT(*) FROM requests) as total_requests,
                    (SELECT COUNT(*) FROM requests WHERE status = 'pending') as pending_requests,
                    (SELECT COUNT(*) FROM requests WHERE status = 'matched') as matched_requests,
                    (SELECT COUNT(*) FROM requests WHERE status = 'completed') as completed_requests,
                    (SELECT COUNT(*) FROM matches) as total_matches,
                    (SELECT COUNT(*) FROM matches WHERE status = 'active') as active_matches,
                    (SELECT COUNT(*) FROM matches WHERE status = 'completed') as completed_matches,
                    (SELECT COUNT(*) FROM ratings) as total_ratings,
                    (SELECT AVG(score) FROM ratings) as average_rating,
                    (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_week,
                    (SELECT COUNT(*) FROM requests WHERE created_at >= NOW() - INTERVAL '7 days') as new_requests_week,
                    (SELECT COUNT(*) FROM requests WHERE urgency = 'urgent' AND status = 'pending') as urgent_pending,
                    (SELECT COUNT(*) FROM requests WHERE urgency != 'urgent' AND status = 'pending') as normal_pending,
                    (SELECT COUNT(*) FROM users WHERE is_active = false) as suspended_users
            `);

            res.json(stats.rows[0]);
        } catch (error) {
            console.error('Error fetching overview stats:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    }
);

// Get queue statistics (urgent vs normal)
app.get('/api/admin/stats/queue-status',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    urgency,
                    status,
                    COUNT(*) as count,
                    AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) as avg_wait_hours
                FROM requests
                WHERE status IN ('pending', 'matched')
                GROUP BY urgency, status
                ORDER BY 
                    CASE urgency
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    status
            `);

            // Get oldest pending requests by urgency
            const oldestRequests = await pool.query(`
                SELECT 
                    urgency,
                    id,
                    title,
                    created_at,
                    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as wait_hours
                FROM requests
                WHERE status = 'pending'
                ORDER BY 
                    CASE urgency
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    created_at ASC
                LIMIT 10
            `);

            res.json({
                queue_stats: result.rows,
                oldest_pending: oldestRequests.rows
            });
        } catch (error) {
            console.error('Error fetching queue status:', error);
            res.status(500).json({ error: 'Failed to fetch queue status' });
        }
    }
);

// Get system health metrics
app.get('/api/admin/stats/system-health',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const healthMetrics = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM requests WHERE created_at >= NOW() - INTERVAL '1 hour') as requests_last_hour,
                    (SELECT COUNT(*) FROM matches WHERE matched_at >= NOW() - INTERVAL '1 hour') as matches_last_hour,
                    (SELECT COUNT(*) FROM users WHERE last_login >= NOW() - INTERVAL '1 hour') as active_users_last_hour,
                    (SELECT COUNT(*) FROM requests WHERE status = 'pending' AND urgency = 'urgent' AND created_at < NOW() - INTERVAL '2 hours') as stale_urgent_requests,
                    (SELECT COUNT(*) FROM requests WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours') as stale_requests,
                    (SELECT AVG(EXTRACT(EPOCH FROM (matched_at - created_at)) / 60) 
                     FROM (SELECT m.matched_at, r.created_at 
                           FROM matches m 
                           JOIN requests r ON m.request_id = r.id 
                           WHERE m.matched_at >= NOW() - INTERVAL '24 hours') subq) as avg_match_time_minutes_24h,
                    (SELECT COUNT(*) FROM ratings WHERE created_at >= NOW() - INTERVAL '24 hours') as ratings_last_24h,
                    (SELECT AVG(score) FROM ratings WHERE created_at >= NOW() - INTERVAL '7 days') as avg_rating_last_week
            `);

            // Database statistics
            const dbStats = await pool.query(`
                SELECT 
                    pg_database_size(current_database()) as db_size_bytes,
                    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
            `);

            res.json({
                ...healthMetrics.rows[0],
                ...dbStats.rows[0],
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching system health:', error);
            res.status(500).json({ error: 'Failed to fetch system health' });
        }
    }
);

// Get urgency distribution
app.get('/api/admin/stats/urgency-distribution',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT urgency, COUNT(*) as count
                FROM requests
                GROUP BY urgency
                ORDER BY 
                    CASE urgency
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching urgency distribution:', error);
            res.status(500).json({ error: 'Failed to fetch urgency distribution' });
        }
    }
);

// Get category distribution
app.get('/api/admin/stats/category-distribution',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT category, COUNT(*) as count
                FROM requests
                WHERE category IS NOT NULL
                GROUP BY category
                ORDER BY count DESC
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching category distribution:', error);
            res.status(500).json({ error: 'Failed to fetch category distribution' });
        }
    }
);

// Get activity timeline (requests created per day for last 30 days)
app.get('/api/admin/stats/activity-timeline',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as requests_count
                FROM requests
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching activity timeline:', error);
            res.status(500).json({ error: 'Failed to fetch activity timeline' });
        }
    }
);

// Get role distribution
app.get('/api/admin/stats/role-distribution',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    role,
                    COUNT(*) AS count
                FROM users
                WHERE role IS NOT NULL
                GROUP BY role
                ORDER BY role;
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching role distribution:', error);
            res.status(500).json({ error: 'Failed to fetch role distribution' });
        }
    }
);

// Get status distribution
app.get('/api/admin/stats/status-distribution',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    status,
                    COUNT(*) AS count
                FROM requests
                WHERE status IS NOT NULL
                GROUP BY status
                ORDER BY 
                    CASE status
                        WHEN 'pending' THEN 1
                        WHEN 'matched' THEN 2
                        WHEN 'completed' THEN 3
                        WHEN 'cancelled' THEN 4
                    END;
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching status distribution:', error);
            res.status(500).json({ error: 'Failed to fetch status distribution' });
        }
    }
);

// Get rating distribution
app.get('/api/admin/stats/rating-distribution',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    score,
                    COUNT(*) AS count
                FROM ratings
                WHERE score IS NOT NULL
                GROUP BY score
                ORDER BY score ASC;
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching rating distribution:', error);
            res.status(500).json({ error: 'Failed to fetch rating distribution' });
        }
    }
);

// ============= USER MANAGEMENT =============

// Get all users with filtering and pagination
app.get('/api/admin/users',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 50, 
                role, 
                provider, 
                search,
                email_verified,
                is_active,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (page - 1) * limit;
            let conditions = [];
            let params = [];
            let paramCount = 1;

            // Build WHERE conditions
            if (role) {
                conditions.push(`role = $${paramCount++}`);
                params.push(role);
            }
            if (provider) {
                conditions.push(`provider = $${paramCount++}`);
                params.push(provider);
            }
            if (search) {
                conditions.push(`(email ILIKE $${paramCount} OR firstname ILIKE $${paramCount} OR lastname ILIKE $${paramCount})`);
                params.push(`%${search}%`);
                paramCount++;
            }
            if (email_verified !== undefined) {
                conditions.push(`email_verified = $${paramCount++}`);
                params.push(email_verified === 'true');
            }
            if (is_active !== undefined) {
                // Handle special case for "pending" status
                if (is_active === 'pending') {
                    conditions.push(`(role IS NULL OR email_verified = false)`);
                } else {
                    conditions.push(`is_active = $${paramCount++}`);
                    params.push(is_active === 'true');
                }
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Validate sort columns
            const validSortColumns = ['id', 'email', 'firstname', 'lastname', 'role', 'provider', 'created_at', 'last_login', 'rating'];
            const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
            const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM users ${whereClause}`,
                params
            );
            const totalUsers = parseInt(countResult.rows[0].count);

            // Get users with computed status
            params.push(parseInt(limit), offset);
            const users = await pool.query(
                `SELECT 
                    id, email, firstname, lastname, provider, role, rating, location,
                    email_verified, is_active, created_at, updated_at, last_login, password_hash,
                    CASE 
                        WHEN role IS NULL OR email_verified = false THEN 'Pending'
                        WHEN is_active = true THEN 'Active'
                        ELSE 'Inactive'
                    END as status
                FROM users 
                ${whereClause}
                ORDER BY ${sortColumn} ${sortDirection}
                LIMIT $${paramCount++} OFFSET $${paramCount}`,
                params
            );

            res.json({
                users: users.rows,
                pagination: {
                    total: totalUsers,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(totalUsers / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    }
);

// Get single user details
app.get('/api/admin/users/:id',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            const userResult = await pool.query(
                `SELECT *, 
                    CASE 
                        WHEN role IS NULL OR email_verified = false THEN 'Pending'
                        WHEN is_active = true THEN 'Active'
                        ELSE 'Inactive'
                    END as status
                FROM users 
                WHERE id = $1`,
                [id]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = userResult.rows[0];

            // Get user's requests
            const requestsResult = await pool.query(
                `SELECT * FROM requests WHERE user_id = $1 ORDER BY created_at DESC`,
                [id]
            );

            // Get user's matches (as helper)
            const matchesResult = await pool.query(
                `SELECT m.*, r.title, r.category, r.description 
                FROM matches m
                JOIN requests r ON m.request_id = r.id
                WHERE m.helper_id = $1 
                ORDER BY m.matched_at DESC`,
                [id]
            );

            // Get user's ratings (received)
            const ratingsResult = await pool.query(
                `SELECT r.*, u.firstname as rater_firstname, u.lastname as rater_lastname
                FROM ratings r
                JOIN users u ON r.rater_id = u.id
                WHERE r.ratee_id = $1 
                ORDER BY r.created_at DESC`,
                [id]
            );

            res.json({
                user,
                requests: requestsResult.rows,
                matches: matchesResult.rows,
                ratings: ratingsResult.rows
            });
        } catch (error) {
            console.error('Error fetching user details:', error);
            res.status(500).json({ error: 'Failed to fetch user details' });
        }
    }
);

// Update user status (activate/deactivate)
app.patch('/api/admin/users/:id/status',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { is_active } = req.body;

            if (typeof is_active !== 'boolean') {
                return res.status(400).json({ error: 'is_active must be a boolean' });
            }

            const result = await pool.query(
                `UPDATE users SET is_active = $1, updated_at = NOW() 
                WHERE id = $2 
                RETURNING id, email, firstname, lastname, is_active`,
                [is_active, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
                user: result.rows[0]
            });
        } catch (error) {
            console.error('Error updating user status:', error);
            res.status(500).json({ error: 'Failed to update user status' });
        }
    }
);

// Update user role
app.patch('/api/admin/users/:id/role',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { role } = req.body;

            const validRoles = ['senior', 'volunteer', 'caregiver', 'admin'];
            if (!validRoles.includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const result = await pool.query(
                `UPDATE users SET role = $1, updated_at = NOW() 
                WHERE id = $2 
                RETURNING id, email, firstname, lastname, role`,
                [role, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                message: 'User role updated successfully',
                user: result.rows[0]
            });
        } catch (error) {
            console.error('Error updating user role:', error);
            res.status(500).json({ error: 'Failed to update user role' });
        }
    }
);

// ============= REQUEST MANAGEMENT =============

// Get all requests with filtering and pagination
app.get('/api/admin/requests',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 50, 
                status, 
                urgency, 
                category,
                search,
                user_id,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (page - 1) * limit;
            let conditions = [];
            let params = [];
            let paramCount = 1;

            // Build WHERE conditions
            if (status) {
                conditions.push(`r.status = $${paramCount++}`);
                params.push(status);
            }
            if (urgency) {
                conditions.push(`r.urgency = $${paramCount++}`);
                params.push(urgency);
            }
            if (category) {
                conditions.push(`r.category = $${paramCount++}`);
                params.push(category);
            }
            if (user_id) {
                conditions.push(`r.user_id = $${paramCount++}`);
                params.push(parseInt(user_id));
            }
            if (search) {
                conditions.push(`(r.title ILIKE $${paramCount} OR r.description ILIKE $${paramCount})`);
                params.push(`%${search}%`);
                paramCount++;
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Validate sort columns
            const validSortColumns = ['id', 'title', 'category', 'urgency', 'status', 'created_at'];
            const sortColumn = validSortColumns.includes(sort_by) ? `r.${sort_by}` : 'r.created_at';
            const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM requests r ${whereClause}`,
                params
            );
            const totalRequests = parseInt(countResult.rows[0].count);

            // Get requests with user info
            params.push(parseInt(limit), offset);
            const requests = await pool.query(
                `SELECT 
                    r.*,
                    u.firstname as user_firstname,
                    u.lastname as user_lastname,
                    u.email as user_email,
                    u.location as user_location
                FROM requests r
                JOIN users u ON r.user_id = u.id
                ${whereClause}
                ORDER BY ${sortColumn} ${sortDirection}
                LIMIT $${paramCount++} OFFSET $${paramCount}`,
                params
            );

            res.json({
                requests: requests.rows,
                pagination: {
                    total: totalRequests,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(totalRequests / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching requests:', error);
            res.status(500).json({ error: 'Failed to fetch requests' });
        }
    }
);

// Get single request details
app.get('/api/admin/requests/:id',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            const requestResult = await pool.query(
                `SELECT r.*, 
                    u.firstname as user_firstname,
                    u.lastname as user_lastname,
                    u.email as user_email,
                    u.location as user_location
                FROM requests r
                JOIN users u ON r.user_id = u.id
                WHERE r.id = $1`,
                [id]
            );

            if (requestResult.rows.length === 0) {
                return res.status(404).json({ error: 'Request not found' });
            }

            const request = requestResult.rows[0];

            // Get matches for this request
            const matchesResult = await pool.query(
                `SELECT m.*, 
                    u.firstname as helper_firstname,
                    u.lastname as helper_lastname,
                    u.email as helper_email,
                    u.rating as helper_rating
                FROM matches m
                JOIN users u ON m.helper_id = u.id
                WHERE m.request_id = $1`,
                [id]
            );

            // Get responses/offers
            const responsesResult = await pool.query(
                `SELECT r.*, 
                    u.firstname as responder_firstname,
                    u.lastname as responder_lastname
                FROM responses r
                JOIN users u ON r.user_id = u.id
                WHERE r.request_id = $1
                ORDER BY r.created_at ASC`,
                [id]
            );

            res.json({
                request,
                matches: matchesResult.rows,
                responses: responsesResult.rows
            });
        } catch (error) {
            console.error('Error fetching request details:', error);
            res.status(500).json({ error: 'Failed to fetch request details' });
        }
    }
);

// Update request status
app.patch('/api/admin/requests/:id/status',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ['pending', 'matched', 'completed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const result = await pool.query(
                `UPDATE requests SET status = $1 
                WHERE id = $2 
                RETURNING id, title, status`,
                [status, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Request not found' });
            }

            res.json({
                message: 'Request status updated successfully',
                request: result.rows[0]
            });
        } catch (error) {
            console.error('Error updating request status:', error);
            res.status(500).json({ error: 'Failed to update request status' });
        }
    }
);

// ============= MATCHES MANAGEMENT =============

// Get all matches with filtering
app.get('/api/admin/matches',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 50, 
                status,
                helper_id,
                request_id,
                sort_by = 'matched_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (page - 1) * limit;
            let conditions = [];
            let params = [];
            let paramCount = 1;

            if (status) {
                conditions.push(`m.status = $${paramCount++}`);
                params.push(status);
            }
            if (helper_id) {
                conditions.push(`m.helper_id = $${paramCount++}`);
                params.push(parseInt(helper_id));
            }
            if (request_id) {
                conditions.push(`m.request_id = $${paramCount++}`);
                params.push(parseInt(request_id));
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM matches m ${whereClause}`,
                params
            );
            const totalMatches = parseInt(countResult.rows[0].count);

            // Get matches
            params.push(parseInt(limit), offset);
            const matches = await pool.query(
                `SELECT 
                    m.*,
                    r.title as request_title,
                    r.category as request_category,
                    r.urgency as request_urgency,
                    u1.firstname as requester_firstname,
                    u1.lastname as requester_lastname,
                    u2.firstname as helper_firstname,
                    u2.lastname as helper_lastname
                FROM matches m
                JOIN requests r ON m.request_id = r.id
                JOIN users u1 ON r.user_id = u1.id
                JOIN users u2 ON m.helper_id = u2.id
                ${whereClause}
                ORDER BY m.${sort_by || 'matched_at'} ${sort_order === 'ASC' ? 'ASC' : 'DESC'}
                LIMIT $${paramCount++} OFFSET $${paramCount}`,
                params
            );

            res.json({
                matches: matches.rows,
                pagination: {
                    total: totalMatches,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(totalMatches / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching matches:', error);
            res.status(500).json({ error: 'Failed to fetch matches' });
        }
    }
);

// ============= RATINGS MANAGEMENT =============

// Get all ratings with filtering
app.get('/api/admin/ratings',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 50,
                rater_id,
                ratee_id,
                min_score,
                max_score,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (page - 1) * limit;
            let conditions = [];
            let params = [];
            let paramCount = 1;

            if (rater_id) {
                conditions.push(`r.rater_id = $${paramCount++}`);
                params.push(parseInt(rater_id));
            }
            if (ratee_id) {
                conditions.push(`r.ratee_id = $${paramCount++}`);
                params.push(parseInt(ratee_id));
            }
            if (min_score) {
                conditions.push(`r.score >= $${paramCount++}`);
                params.push(parseInt(min_score));
            }
            if (max_score) {
                conditions.push(`r.score <= $${paramCount++}`);
                params.push(parseInt(max_score));
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM ratings r ${whereClause}`,
                params
            );
            const totalRatings = parseInt(countResult.rows[0].count);

            // Get ratings
            params.push(parseInt(limit), offset);
            const ratings = await pool.query(
                `SELECT 
                    r.*,
                    u1.firstname as rater_firstname,
                    u1.lastname as rater_lastname,
                    u2.firstname as ratee_firstname,
                    u2.lastname as ratee_lastname
                FROM ratings r
                JOIN users u1 ON r.rater_id = u1.id
                JOIN users u2 ON r.ratee_id = u2.id
                ${whereClause}
                ORDER BY r.${sort_by || 'created_at'} ${sort_order === 'ASC' ? 'ASC' : 'DESC'}
                LIMIT $${paramCount++} OFFSET $${paramCount}`,
                params
            );

            res.json({
                ratings: ratings.rows,
                pagination: {
                    total: totalRatings,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(totalRatings / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching ratings:', error);
            res.status(500).json({ error: 'Failed to fetch ratings' });
        }
    }
);

// ============= REPORTS MANAGEMENT =============

// Get all reports with filtering
app.get('/api/admin/reports',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 50,
                status,
                report_type,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (page - 1) * limit;
            let conditions = [];
            let params = [];
            let paramCount = 1;

            if (status) {
                conditions.push(`rep.status = $${paramCount++}`);
                params.push(status);
            }
            if (report_type) {
                conditions.push(`rep.report_type = $${paramCount++}`);
                params.push(report_type);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM reports rep ${whereClause}`,
                params
            );
            const totalReports = parseInt(countResult.rows[0].count);

            // Get reports with user info
            params.push(parseInt(limit), offset);
            const reports = await pool.query(
                `SELECT 
                    rep.*,
                    u1.firstname as reporter_firstname,
                    u1.lastname as reporter_lastname,
                    u1.email as reporter_email,
                    u2.firstname as reported_user_firstname,
                    u2.lastname as reported_user_lastname,
                    u2.email as reported_user_email
                FROM reports rep
                LEFT JOIN users u1 ON rep.reporter_id = u1.id
                LEFT JOIN users u2 ON rep.reported_user_id = u2.id
                ${whereClause}
                ORDER BY rep.${sort_by || 'created_at'} ${sort_order === 'ASC' ? 'ASC' : 'DESC'}
                LIMIT $${paramCount++} OFFSET $${paramCount}`,
                params
            );

            res.json({
                reports: reports.rows,
                pagination: {
                    total: totalReports,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(totalReports / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching reports:', error);
            res.status(500).json({ error: 'Failed to fetch reports' });
        }
    }
);

// Get single report details
app.get('/api/admin/reports/:id',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            const reportResult = await pool.query(
                `SELECT 
                    rep.*,
                    u1.firstname as reporter_firstname,
                    u1.lastname as reporter_lastname,
                    u1.email as reporter_email,
                    u2.firstname as reported_user_firstname,
                    u2.lastname as reported_user_lastname,
                    u2.email as reported_user_email
                FROM reports rep
                LEFT JOIN users u1 ON rep.reporter_id = u1.id
                LEFT JOIN users u2 ON rep.reported_user_id = u2.id
                WHERE rep.id = $1`,
                [id]
            );

            if (reportResult.rows.length === 0) {
                return res.status(404).json({ error: 'Report not found' });
            }

            res.json(reportResult.rows[0]);
        } catch (error) {
            console.error('Error fetching report details:', error);
            res.status(500).json({ error: 'Failed to fetch report details' });
        }
    }
);

// Update report status
app.patch('/api/admin/reports/:id/status',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { status, action_taken, admin_notes } = req.body;

            const validStatuses = ['pending', 'investigating', 'resolved', 'dismissed'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const result = await pool.query(
                `UPDATE reports 
                SET status = $1, action_taken = $2, admin_notes = $3, resolved_at = CASE WHEN $1 IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END
                WHERE id = $4 
                RETURNING *`,
                [status, action_taken, admin_notes, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Report not found' });
            }

            res.json({
                message: 'Report status updated successfully',
                report: result.rows[0]
            });
        } catch (error) {
            console.error('Error updating report status:', error);
            res.status(500).json({ error: 'Failed to update report status' });
        }
    }
);

// ============= USER MODERATION =============

// Ban/suspend user
app.post('/api/admin/users/:id/ban',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason, duration_days } = req.body;

            // Update user status
            await pool.query(
                `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
                [id]
            );

            // Create audit log
            await pool.query(
                `INSERT INTO admin_actions (admin_id, action_type, target_user_id, reason, duration_days, created_at)
                VALUES ($1, 'ban', $2, $3, $4, NOW())`,
                [req.user.userId, id, reason, duration_days]
            );

            res.json({
                message: 'User banned successfully',
                user_id: id,
                reason,
                duration_days
            });
        } catch (error) {
            console.error('Error banning user:', error);
            res.status(500).json({ error: 'Failed to ban user' });
        }
    }
);

// Unban user
app.post('/api/admin/users/:id/unban',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            // Update user status
            await pool.query(
                `UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1`,
                [id]
            );

            // Create audit log
            await pool.query(
                `INSERT INTO admin_actions (admin_id, action_type, target_user_id, reason, created_at)
                VALUES ($1, 'unban', $2, $3, NOW())`,
                [req.user.userId, id, reason]
            );

            res.json({
                message: 'User unbanned successfully',
                user_id: id
            });
        } catch (error) {
            console.error('Error unbanning user:', error);
            res.status(500).json({ error: 'Failed to unban user' });
        }
    }
);

// Delete user (hard delete with cascading)
app.delete('/api/admin/users/:id',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            // Create audit log before deletion
            await pool.query(
                `INSERT INTO admin_actions (admin_id, action_type, target_user_id, reason, created_at)
                VALUES ($1, 'delete_user', $2, $3, NOW())`,
                [req.user.userId, id, reason]
            );

            // Delete user (cascading will handle related records)
            const result = await pool.query(
                `DELETE FROM users WHERE id = $1 RETURNING email, firstname, lastname`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                message: 'User deleted successfully',
                deleted_user: result.rows[0]
            });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    }
);

// ============= REQUEST MODERATION =============

// Flag request as inappropriate
app.post('/api/admin/requests/:id/flag',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await pool.query(
                `UPDATE requests SET is_flagged = true, flag_reason = $1 WHERE id = $2`,
                [reason, id]
            );

            // Create audit log
            await pool.query(
                `INSERT INTO admin_actions (admin_id, action_type, target_request_id, reason, created_at)
                VALUES ($1, 'flag_request', $2, $3, NOW())`,
                [req.user.userId, id, reason]
            );

            res.json({
                message: 'Request flagged successfully',
                request_id: id
            });
        } catch (error) {
            console.error('Error flagging request:', error);
            res.status(500).json({ error: 'Failed to flag request' });
        }
    }
);

// Remove flag from request
app.post('/api/admin/requests/:id/unflag',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            await pool.query(
                `UPDATE requests SET is_flagged = false, flag_reason = NULL WHERE id = $1`,
                [id]
            );

            res.json({
                message: 'Request flag removed successfully',
                request_id: id
            });
        } catch (error) {
            console.error('Error removing flag:', error);
            res.status(500).json({ error: 'Failed to remove flag' });
        }
    }
);

// Delete request
app.delete('/api/admin/requests/:id',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            // Create audit log before deletion
            await pool.query(
                `INSERT INTO admin_actions (admin_id, action_type, target_request_id, reason, created_at)
                VALUES ($1, 'delete_request', $2, $3, NOW())`,
                [req.user.userId, id, reason]
            );

            // Delete request
            const result = await pool.query(
                `DELETE FROM requests WHERE id = $1 RETURNING title`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Request not found' });
            }

            res.json({
                message: 'Request deleted successfully',
                deleted_request: result.rows[0]
            });
        } catch (error) {
            console.error('Error deleting request:', error);
            res.status(500).json({ error: 'Failed to delete request' });
        }
    }
);

// Get admin action logs
app.get('/api/admin/audit-logs',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 50,
                action_type,
                admin_id,
                sort_order = 'DESC'
            } = req.query;

            const offset = (page - 1) * limit;
            let conditions = [];
            let params = [];
            let paramCount = 1;

            if (action_type) {
                conditions.push(`a.action_type = $${paramCount++}`);
                params.push(action_type);
            }
            if (admin_id) {
                conditions.push(`a.admin_id = $${paramCount++}`);
                params.push(parseInt(admin_id));
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM admin_actions a ${whereClause}`,
                params
            );
            const totalLogs = parseInt(countResult.rows[0].count);

            // Get logs
            params.push(parseInt(limit), offset);
            const logs = await pool.query(
                `SELECT 
                    a.*,
                    u.firstname as admin_firstname,
                    u.lastname as admin_lastname,
                    u.email as admin_email
                FROM admin_actions a
                JOIN users u ON a.admin_id = u.id
                ${whereClause}
                ORDER BY a.created_at ${sort_order === 'ASC' ? 'ASC' : 'DESC'}
                LIMIT $${paramCount++} OFFSET $${paramCount}`,
                params
            );

            res.json({
                logs: logs.rows,
                pagination: {
                    total: totalLogs,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(totalLogs / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            res.status(500).json({ error: 'Failed to fetch audit logs' });
        }
    }
);

// ============= EXPORT DATA =============

// Export users data as CSV
app.get('/api/admin/export/users',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const users = await pool.query(`
                SELECT 
                    id, email, firstname, lastname, provider, role, rating, location,
                    email_verified, is_active, created_at, last_login
                FROM users
                ORDER BY created_at DESC
            `);

            // Convert to CSV
            const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Provider', 'Role', 'Rating', 'Location', 'Email Verified', 'Active', 'Created At', 'Last Login'];
            const csv = [
                headers.join(','),
                ...users.rows.map(row => [
                    row.id,
                    `"${row.email}"`,
                    `"${row.firstname || ''}"`,
                    `"${row.lastname || ''}"`,
                    row.provider,
                    row.role,
                    row.rating,
                    `"${row.location || ''}"`,
                    row.email_verified,
                    row.is_active,
                    row.created_at,
                    row.last_login
                ].join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
            res.send(csv);
        } catch (error) {
            console.error('Error exporting users:', error);
            res.status(500).json({ error: 'Failed to export users' });
        }
    }
);

// Export requests data as CSV
app.get('/api/admin/export/requests',
    authMiddleware.authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const requests = await pool.query(`
                SELECT 
                    r.id, r.title, r.category, r.description, r.urgency, r.status, r.created_at,
                    u.firstname as user_firstname, u.lastname as user_lastname, u.email as user_email
                FROM requests r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.created_at DESC
            `);

            const headers = ['ID', 'Title', 'Category', 'Description', 'Urgency', 'Status', 'Created At', 'User Name', 'User Email'];
            const csv = [
                headers.join(','),
                ...requests.rows.map(row => [
                    row.id,
                    `"${row.title || ''}"`,
                    row.category,
                    `"${(row.description || '').replace(/"/g, '""')}"`,
                    row.urgency,
                    row.status,
                    row.created_at,
                    `"${row.user_firstname} ${row.user_lastname}"`,
                    `"${row.user_email}"`
                ].join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=requests.csv');
            res.send(csv);
        } catch (error) {
            console.error('Error exporting requests:', error);
            res.status(500).json({ error: 'Failed to export requests' });
        }
    }
);

// Error handling
app.use((error, req, res, next) => {
    console.error('Admin service error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Admin service running on port ${PORT}`);
    console.log(`🔐 Admin authentication: enabled`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down admin service...');
    await pool.end();
    process.exit(0);
});
