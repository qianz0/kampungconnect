const db = require('../db');

/**
 * Update an existing rating
 * PUT /api/ratings/:ratingId
 */
const updateRating = async (req, res) => {
  const { ratingId } = req.params;
  const { score, comment } = req.body;
  const raterId = req.user.id;

  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ error: 'Valid score (1-5) is required' });
  }

  try {
    // 1. Verify rating exists and belongs to the user
    const ratingQuery = await db.query(
      'SELECT * FROM ratings WHERE id = $1 AND rater_id = $2',
      [ratingId, raterId]
    );

    if (ratingQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Rating not found or unauthorized' });
    }

    const rating = ratingQuery.rows[0];

    // 2. Update the rating
    const updatedRating = await db.query(
      `UPDATE ratings 
       SET score = $1, comment = $2
       WHERE id = $3
       RETURNING *`,
      [score, comment !== undefined ? comment : rating.comment, ratingId]
    );

    // 3. Recalculate helper's average rating
    const avgRatingQuery = await db.query(
      `SELECT AVG(score) as avg_rating
       FROM ratings
       WHERE ratee_id = $1`,
      [rating.ratee_id]
    );

    await db.query(
      'UPDATE users SET rating = $1 WHERE id = $2',
      [parseFloat(avgRatingQuery.rows[0].avg_rating).toFixed(2), rating.ratee_id]
    );

    console.log(`✅ Rating updated: Rating ${ratingId} changed to ${score} stars`);

    res.json({
      message: 'Rating updated successfully',
      rating: updatedRating.rows[0]
    });

  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = updateRating;