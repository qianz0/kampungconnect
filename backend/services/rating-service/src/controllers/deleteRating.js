const db = require('../db');

/**
 * Delete a rating
 * DELETE /api/ratings/:ratingId
 */
const deleteRating = async (req, res) => {
  const { ratingId } = req.params;
  const raterId = req.user.id;

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
    const helperId = rating.ratee_id;

    // 2. Delete the rating
    await db.query('DELETE FROM ratings WHERE id = $1', [ratingId]);

    // 3. Recalculate helper's average rating
    const avgRatingQuery = await db.query(
      `SELECT AVG(score) as avg_rating, COUNT(*) as count
       FROM ratings
       WHERE ratee_id = $1`,
      [helperId]
    );

    const newRating = avgRatingQuery.rows[0].count > 0 
      ? parseFloat(avgRatingQuery.rows[0].avg_rating).toFixed(2)
      : 5.0; // Reset to default if no ratings left

    await db.query(
      'UPDATE users SET rating = $1 WHERE id = $2',
      [newRating, helperId]
    );

    console.log(`✅ Rating deleted: Rating ${ratingId} removed, helper rating now ${newRating}`);

    res.json({ message: 'Rating deleted successfully' });

  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = deleteRating;