const db = require('../db');

/**
 * Get all ratings for a specific helper
 * GET /api/ratings/helper/:helperId
 */
const getHelperRatings = async (req, res) => {
  const { helperId } = req.params;
  const { limit = 10, offset = 0 } = req.query;

  try {
    // Get ratings with rater info
    const ratingsQuery = await db.query(
      `SELECT r.id, r.score, r.comment, r.created_at,
              u.firstname, u.lastname, u.picture
       FROM ratings r
       JOIN users u ON r.rater_id = u.id
       WHERE r.ratee_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [helperId, limit, offset]
    );

    // Get summary stats
    const statsQuery = await db.query(
      `SELECT 
        AVG(score) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN score = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN score = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN score = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN score = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN score = 1 THEN 1 END) as one_star
       FROM ratings
       WHERE ratee_id = $1`,
      [helperId]
    );

    res.json({
      ratings: ratingsQuery.rows,
      stats: {
        avgRating: parseFloat(statsQuery.rows[0].avg_rating || 5.0).toFixed(2),
        totalRatings: parseInt(statsQuery.rows[0].total_ratings || 0),
        distribution: {
          5: parseInt(statsQuery.rows[0].five_star || 0),
          4: parseInt(statsQuery.rows[0].four_star || 0),
          3: parseInt(statsQuery.rows[0].three_star || 0),
          2: parseInt(statsQuery.rows[0].two_star || 0),
          1: parseInt(statsQuery.rows[0].one_star || 0),
        }
      }
    });

  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = getHelperRatings;