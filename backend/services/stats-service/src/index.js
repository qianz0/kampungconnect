require('dotenv').config();
const db = require('./db');
const express = require('express');
const cors = require('cors');
const AuthMiddleware = require('/app/shared/auth-middleware');
const app = express();
const authMiddleware = new AuthMiddleware(process.env.AUTH_SERVICE_URL);

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({ 
        service: "stats-service", 
        status: "running",
        description: "User statistics and analytics"
    });
});

// Function to get time in Xh Ymin format
function formatHoursMinutes(totalHours) {
    if (!totalHours || totalHours === 0) return '0h 0m';
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    return `${hours}h ${minutes}m`;
}

// Function to calculate badges for helpers
function calculateBadges(stats) {
    const badges = [];

    // Completion Milestones
    if (stats.total_completed >= 1) {
        badges.push({
            id: 'first_help',
            name: 'First Help',
            description: 'Completed your first request',
            icon: 'fa-star',
            color: '#ffc107',
            tier: 'bronze'
        })
    }
    if (stats.total_completed >= 5) {
        badges.push({
            id: 'helping_hand',
            name: 'Helping Hand',
            description: 'Completed 5 requests',
            icon: 'fa-hand-holding-heart',
            color: '#17a2b8',
            tier: 'silver'
        })
    }
    if (stats.total_completed >= 10) {
        badges.push({
            id: 'community_helper',
            name: 'Community Helper',
            description: 'Completed 10 requests',
            icon: 'fa-hands-helping',
            color: '#28a745',
            tier: 'gold'
        });
    }
    if (stats.total_completed >= 25) {
        badges.push({
            id: 'super_volunteer',
            name: 'Super Volunteer',
            description: 'Completed 25 requests',
            icon: 'fa-trophy',
            color: '#6f42c1',
            tier: 'platinum'
        });
    }
    if (stats.total_completed >= 50) {
        badges.push({
            id: 'champion',
            name: 'Champion',
            description: 'Completed 50 requests',
            icon: 'fa-crown',
            color: '#fd7e14',
            tier: 'diamond'
        });
    }
    if (stats.total_completed >= 100) {
        badges.push({
            id: 'legend',
            name: 'Legend',
            description: 'Completed 100 requests',
            icon: 'fa-medal',
            color: '#e83e8c',
            tier: 'legendary'
        });
    }

    // Time based
    if (stats.total_hours >= 10) {
        badges.push({
            id: 'dedicated_10',
            name: 'Dedicated Helper',
            description: 'Volunteered 10+ hours',
            icon: 'fa-clock',
            color: '#17a2b8',
            tier: 'silver'
        });
    }
    if (stats.total_hours >= 50) {
        badges.push({
            id: 'time_warrior',
            name: 'Time Warrior',
            description: 'Volunteered 50+ hours',
            icon: 'fa-hourglass-half',
            color: '#28a745',
            tier: 'gold'
        });
    }
    if (stats.total_hours >= 100) {
        badges.push({
            id: 'marathon_volunteer',
            name: 'Marathon Volunteer',
            description: 'Volunteered 100+ hours',
            icon: 'fa-running',
            color: '#6f42c1',
            tier: 'platinum'
        });
    }

    // Ratings
    if (stats.avg_rating >= 4.5 && stats.total_ratings >= 5) {
        badges.push({
            id: 'highly_rated',
            name: 'Highly Rated',
            description: '4.5+ star average with 5+ ratings',
            icon: 'fa-star',
            color: '#ffc107',
            tier: 'gold'
        });
    }
    if (stats.avg_rating >= 4.8 && stats.total_ratings >= 10) {
        badges.push({
            id: 'five_star_hero',
            name: 'Five Star Hero',
            description: '4.8+ star average with 10+ ratings',
            icon: 'fa-certificate',
            color: '#fd7e14',
            tier: 'platinum'
        });
    }

    // Perfect rating
    const perfectRatingPercent = stats.total_ratings > 0 ? (stats.five_star_count / stats.total_ratings) * 100 : 0;
    if (perfectRatingPercent >= 80 && stats.total_ratings >= 5) {
        badges.push({
            id: 'excellence',
            name: 'Excellence Award',
            description: '80%+ five-star ratings',
            icon: 'fa-gem',
            color: '#e83e8c',
            tier: 'diamond'
        });
    }

    // Completion rate
    if (stats.completion_rate >= 90 && stats.total_completed >= 10) {
        badges.push({
            id: 'reliable',
            name: 'Reliable Helper',
            description: '90%+ completion rate',
            icon: 'fa-check-circle',
            color: '#28a745',
            tier: 'gold'
        });
    }
    if (stats.completion_rate >= 95 && stats.total_completed >= 20) {
        badges.push({
            id: 'dependable',
            name: 'Dependable Pro',
            description: '95%+ completion rate',
            icon: 'fa-shield-alt',
            color: '#6f42c1',
            tier: 'platinum'
        });
    }

    // Response time
    if (stats.avg_response_minutes <= 30 && stats.total_completed >= 5) {
        badges.push({
            id: 'quick_responder',
            name: 'Quick Responder',
            description: 'Average response under 30 minutes',
            icon: 'fa-bolt',
            color: '#ffc107',
            tier: 'gold'
        });
    }
    if (stats.avg_response_minutes <= 10 && stats.total_completed >= 10) {
        badges.push({
            id: 'lightning_fast',
            name: 'Lightning Fast',
            description: 'Average response under 10 minutes',
            icon: 'fa-zap',
            color: '#fd7e14',
            tier: 'platinum'
        });
    }

    // Rank 
    if (stats.rank_percentage <= 10 && stats.total_completed >= 10) {
        badges.push({
            id: 'top_10',
            name: 'Top 10%',
            description: 'Ranked in top 10% of helpers',
            icon: 'fa-award',
            color: '#6f42c1',
            tier: 'platinum'
        });
    }
    if (stats.rank_percentage <= 5 && stats.total_completed >= 20) {
        badges.push({
            id: 'elite',
            name: 'Elite Helper',
            description: 'Ranked in top 5% of helpers',
            icon: 'fa-star-of-life',
            color: '#e83e8c',
            tier: 'diamond'
        });
    }
    if (stats.rank_percentage <= 1 && stats.total_completed >= 50) {
        badges.push({
            id: 'top_1',
            name: 'Top 1%',
            description: 'Ranked in top 1% of helpers',
            icon: 'fa-crown',
            color: '#dc3545',
            tier: 'legendary'
        });
    }
    return badges;
}

// Function to get helper stats
async function getHelperStatsData(helperId) {
    // Request Statistics
    const requestStats = await db.query(`
        SELECT 
            COUNT(*) as total_accepted,
            COUNT(CASE WHEN m.status = 'completed' THEN 1 END) as total_completed,
            COUNT(CASE WHEN m.status = 'active' THEN 1 END) as total_ongoing,
            COUNT(CASE WHEN m.status = 'cancelled' THEN 1 END) as total_cancelled
        FROM matches m
        WHERE m.helper_id = $1
    `, [helperId]);
    const stats = requestStats.rows[0];
        const completionRate = stats.total_accepted > 0 
            ? ((stats.total_completed / stats.total_accepted) * 100).toFixed(1)
            : 0;

    // Time Statistics (for completed requests)
    const timeStats = await db.query(`
        SELECT 
            AVG(EXTRACT(EPOCH FROM (m.completed_at - m.matched_at)) / 3600) as avg_hours,
            MIN(EXTRACT(EPOCH FROM (m.completed_at - m.matched_at)) / 3600) as min_hours,
            SUM(EXTRACT(EPOCH FROM (m.completed_at - m.matched_at)) / 3600) as total_hours
        FROM matches m
        JOIN requests r ON m.request_id = r.id
        WHERE m.helper_id = $1 AND m.status = 'completed'
            AND m.completed_at IS NOT NULL
            AND m.matched_at IS NOT NULL
    `, [helperId]);
    const timeData = timeStats.rows[0];

    // Rating Statistics
    const ratingStats = await db.query(`
        SELECT 
            AVG(score) as avg_rating,
            COUNT(*) as total_ratings,
            COUNT(CASE WHEN score = 5 THEN 1 END) as five_star_count
        FROM ratings
        WHERE ratee_id = $1
    `, [helperId]);
    const ratingData = ratingStats.rows[0];

    // Response Time (time from match to first action)
    const responseStats = await db.query(`
        SELECT 
            AVG(EXTRACT(EPOCH FROM (m.matched_at - r.created_at)) / 60) as avg_response_minutes
        FROM matches m
        JOIN requests r ON m.request_id = r.id
        WHERE m.helper_id = $1 AND m.matched_at IS NOT NULL
    `, [helperId]);
    const avgResponseMinutes = responseStats.rows[0].avg_response_minutes || 0;

    // Monthly Trends
    const monthlyTrends = await db.query(`
        SELECT 
            COUNT(CASE WHEN m.matched_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
            COUNT(CASE WHEN m.matched_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
            AND m.matched_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
        FROM matches m
        WHERE m.helper_id = $1
    `, [helperId]);
    const trends = monthlyTrends.rows[0];
    const trendPercentage = trends.last_month > 0
        ? (((trends.this_month - trends.last_month) / trends.last_month) * 100).toFixed(1)
        : 0;

    // Category Breakdown
        const categoryStats = await db.query(`
            SELECT 
                r.category,
                COUNT(*) as count
            FROM matches m
            JOIN requests r ON m.request_id = r.id
            WHERE m.helper_id = $1
            GROUP BY r.category
            ORDER BY count DESC
        `, [helperId]);

    // Calculate Rank (percentile)
    const rankStats = await db.query(`
        WITH helper_counts AS (
            SELECT helper_id, COUNT(*) as completed
            FROM matches
            WHERE status = 'completed'
            GROUP BY helper_id
        ),
        user_rank AS (
            SELECT 
                helper_id,
                completed,
                PERCENT_RANK() OVER (ORDER BY completed DESC) as percentile
            FROM helper_counts
        )
        SELECT 
            ROUND((1 - percentile) * 100) as top_percentage,
            completed
        FROM user_rank
        WHERE helper_id = $1
    `, [helperId]);
    const rank = rankStats.rows[0] || { top_percentage: 100, completed: 0 };

    // Calculate badges
    const badges = calculateBadges({
        total_completed: parseInt(stats.total_completed),
        total_hours: parseFloat(timeData.total_hours || 0),
        avg_rating: parseFloat(ratingData.avg_rating || 0),
        five_star_count: parseInt(ratingData.five_star_count || 0),
        total_ratings: parseInt(ratingData.total_ratings || 0),
        completion_rate: parseFloat(completionRate),
        avg_response_minutes: parseFloat(avgResponseMinutes),
        rank_percentage: parseInt(rank.top_percentage)
    });
    
    return {
        helper_id: parseInt(helperId),
        request_stats: {
            total_accepted: parseInt(stats.total_accepted),
            total_completed: parseInt(stats.total_completed),
            total_ongoing: parseInt(stats.total_ongoing),
            total_cancelled: parseInt(stats.total_cancelled),
            completion_rate: `${completionRate}%`
        },
        time_stats: {
            avg_completion_time: formatHoursMinutes(timeData.avg_hours),
            fastest_completion: formatHoursMinutes(timeData.min_hours),
            total_hours_volunteered: formatHoursMinutes(timeData.total_hours),
        },
        rating_stats: {
            avg_rating: parseFloat(ratingData.avg_rating || 0).toFixed(2),
            total_ratings: parseInt(ratingData.total_ratings || 0),
            five_star_percentage: ratingData.total_ratings > 0
                ? ((ratingData.five_star_count / ratingData.total_ratings) * 100).toFixed(1)
                : 0
        },
        performance: {
            avg_response_time: `${Math.round(avgResponseMinutes)} minutes`,
            rank: `Top ${rank.top_percentage}%`
        },
        trends: {
            requests_this_month: parseInt(trends.this_month),
            requests_last_month: parseInt(trends.last_month),
            trend: trendPercentage > 0 ? `↑ ${trendPercentage}%` : `↓ ${Math.abs(trendPercentage)}%`
        },
        category_breakdown: categoryStats.rows.reduce((acc, row) => {
            acc[row.category] = parseInt(row.count);
            return acc;
        }, {}),
        badges: badges
    }
}

// Function to get senior stats
async function getSeniorStatsData(seniorId) {
    // Request Statistics
    const requestStats = await db.query(`
        SELECT 
            COUNT(*) as total_posted,
            COUNT(CASE WHEN r.status = 'fulfilled' THEN 1 END) as total_fulfilled,
            COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as total_pending,
            COUNT(CASE WHEN r.status = 'matched' THEN 1 END) as total_ongoing,
            COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) as total_cancelled
        FROM requests r
        WHERE r.user_id = $1
    `, [seniorId]);
    const stats = requestStats.rows[0];

    // Rating Statistics
    const ratingStats = await db.query(`
        SELECT 
            AVG(score) as avg_rating_given,
            COUNT(*) as total_ratings_given
        FROM ratings
        WHERE rater_id = $1
    `, [seniorId]);
    const ratingData = ratingStats.rows[0];

    // Monthly Trends
    const monthlyTrends = await db.query(`
        SELECT 
            COUNT(CASE WHEN r.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
            COUNT(CASE WHEN r.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
                AND r.created_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as last_month
        FROM requests r
        WHERE r.user_id = $1
    `, [seniorId]);
    const trends = monthlyTrends.rows[0];

    // Category Breakdown
    const categoryStats = await db.query(`
        SELECT 
            r.category,
            COUNT(*) as count
        FROM requests r
        WHERE r.user_id = $1
        GROUP BY r.category
        ORDER BY count DESC
    `, [seniorId]);
    const mostRequested = categoryStats.rows[0] || { category: 'None', count: 0 };

    return {
        senior_id: parseInt(seniorId),
        request_stats: {
            total_posted: parseInt(stats.total_posted),
            total_fulfilled: parseInt(stats.total_fulfilled),
            total_pending: parseInt(stats.total_pending),
            total_ongoing: parseInt(stats.total_ongoing),
            total_cancelled: parseInt(stats.total_cancelled),
            fulfillment_rate: stats.total_posted > 0
                ? `${((stats.total_fulfilled / stats.total_posted) * 100).toFixed(1)}%`
                : '0%'
        },
        rating_stats: {
            avg_rating_given: parseFloat(ratingData.avg_rating_given || 0).toFixed(2),
            total_ratings_given: parseInt(ratingData.total_ratings_given || 0)
        },
        trends: {
            requests_this_month: parseInt(trends.this_month),
            requests_last_month: parseInt(trends.last_month)
        },
        category_breakdown: {
            most_requested: mostRequested.category,
            breakdown: categoryStats.rows.reduce((acc, row) => {
                acc[row.category] = parseInt(row.count);
                return acc;
            }, {})
        }
    }
}

// Route for helper stats
app.get('/stats/helper', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const stats = await getHelperStatsData(req.user.id);
        res.json(stats);
    } catch (error) {
        console.error('[Stats] Get helper stats error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Route to view helper stats
app.get('/stats/helper/:id', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const stats = await getHelperStatsData(req.params.id);
        res.json(stats);
    } catch (error) {
        console.error('[Stats] Get helper stats error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Route for senior stats
app.get('/stats/senior', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const stats = await getSeniorStatsData(req.user.id);
        res.json(stats);
    } catch (error) {
        console.error('[Stats] Get senior stats error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Route to view senior stats
app.get('/stats/senior/:id', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const stats = await getSeniorStatsData(req.params.id);
        res.json(stats);
    } catch (error) {
        console.error('[Stats] Get senior stats error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Stats service error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5009;
app.listen(PORT, () => {
    console.log(`Stats service running on port ${PORT}`);
    console.log(`Stats available to all authenticated users`);
});