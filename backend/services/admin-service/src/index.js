require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const AuthMiddleware = require('../shared/auth-middleware');

const app = express();
const authMiddleware = new AuthMiddleware();

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
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
                    (SELECT COUNT(*) FROM requests WHERE created_at >= NOW() - INTERVAL '7 days') as new_requests_week
            `);

            res.json(stats.rows[0]);
        } catch (error) {
            console.error('Error fetching overview stats:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
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
                conditions.push(`(email ILIKE $${paramCount} OR firstName ILIKE $${paramCount} OR lastName ILIKE $${paramCount})`);
                params.push(`%${search}%`);
                paramCount++;
            }
            if (email_verified !== undefined) {
                conditions.push(`email_verified = $${paramCount++}`);
                params.push(email_verified === 'true');
            }
            if (is_active !== undefined) {
                conditions.push(`is_active = $${paramCount++}`);
                params.push(is_active === 'true');
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Validate sort columns
            const validSortColumns = ['id', 'email', 'firstName', 'lastName', 'role', 'provider', 'created_at', 'last_login', 'rating'];
            const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
            const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM users ${whereClause}`,
                params
            );
            const totalUsers = parseInt(countResult.rows[0].count);

            // Get users
            params.push(parseInt(limit), offset);
            const users = await pool.query(
                `SELECT 
                    id, email, firstname, lastname, provider, role, rating, location,
                    email_verified, is_active, created_at, updated_at, last_login
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
                `SELECT * FROM users WHERE id = $1`,
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
