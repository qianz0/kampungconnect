const db = require('../db');

/**
 * Get ratings based on user role:
 * - For seniors/caregivers: ratings they gave to volunteers
 * - For volunteers: ratings they received from seniors/caregivers
 * GET /api/ratings/my-ratings
 */
const getMyRatings = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let ratingsQuery;
    
    if (userRole === 'helper' || userRole === 'volunteer') {
      // For volunteers: get ratings they received with community statistics
      ratingsQuery = await db.query(
        `SELECT r.id, r.score, r.comment, r.created_at,
                u.firstname, u.lastname, u.picture,
                m.id as match_id, req.title, req.category,
                (SELECT AVG(r_stats.score) FROM ratings r_stats WHERE r_stats.ratee_id = $1) as avg_rating,
                (SELECT COUNT(r_stats.id) FROM ratings r_stats WHERE r_stats.ratee_id = $1) as total_ratings
         FROM ratings r
         JOIN users u ON r.rater_id = u.id
         JOIN matches m ON r.match_id = m.id
         JOIN requests req ON m.request_id = req.id
         WHERE r.ratee_id = $1
         ORDER BY r.created_at DESC`,
        [userId]
      );
    } else {
      // For seniors/caregivers: get ratings they gave to volunteers
      ratingsQuery = await db.query(
        `SELECT r.id, r.score, r.comment, r.created_at,
                u.firstname, u.lastname, u.picture, u.rating as volunteer_rating,
                m.id as match_id, req.title, req.category
         FROM ratings r
         JOIN users u ON r.ratee_id = u.id
         JOIN matches m ON r.match_id = m.id
         JOIN requests req ON m.request_id = req.id
         WHERE r.rater_id = $1
         ORDER BY r.created_at DESC`,
        [userId]
      );
    }

    res.json({ 
      ratings: ratingsQuery.rows,
      userRole: userRole 
    });

  } catch (error) {
    console.error('Error fetching my ratings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = getMyRatings;