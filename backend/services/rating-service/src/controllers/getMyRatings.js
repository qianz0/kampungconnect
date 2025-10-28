const db = require('../db');

/**
 * Get all ratings given by the current user (senior)
 * GET /api/ratings/my-ratings
 */
const getMyRatings = async (req, res) => {
  const raterId = req.user.id;

  try {
    const ratingsQuery = await db.query(
      `SELECT r.id, r.score, r.comment, r.created_at,
              u.firstname, u.lastname, u.picture, u.rating as helper_rating,
              m.id as match_id, req.title, req.category
       FROM ratings r
       JOIN users u ON r.ratee_id = u.id
       JOIN matches m ON r.match_id = m.id
       JOIN requests req ON m.request_id = req.id
       WHERE r.rater_id = $1
       ORDER BY r.created_at DESC`,
      [raterId]
    );

    res.json({ ratings: ratingsQuery.rows });

  } catch (error) {
    console.error('Error fetching my ratings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = getMyRatings;