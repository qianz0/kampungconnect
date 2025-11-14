const db = require('../db');

/**
 * Create a new rating
 * POST /api/ratings
 */
const createRating = async (req, res) => {
  const { matchId, score, comment } = req.body;
  const raterId = req.user.id;

  // Validation
  if (!matchId || !score) {
    return res.status(400).json({ error: 'matchId and score are required' });
  }

  if (score < 1 || score > 5) {
    return res.status(400).json({ error: 'Score must be between 1 and 5' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify the match exists and get helper_id with row lock
    const matchQuery = await client.query(
      `SELECT m.id, m.helper_id, m.status, r.user_id as senior_id
       FROM matches m
       JOIN requests r ON m.request_id = r.id
       WHERE m.id = $1
       FOR UPDATE`,
      [matchId]
    );

    if (matchQuery.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchQuery.rows[0];

    // 2. Verify the rater is the senior who made the request
    if (match.senior_id !== raterId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only rate helpers for your own requests' });
    }

    // 3. Verify match is completed
    if (match.status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Can only rate completed matches' });
    }

    // 4. Check if rating already exists for this match
    const existingRating = await client.query(
      'SELECT id FROM ratings WHERE match_id = $1 AND rater_id = $2',
      [matchId, raterId]
    );

    if (existingRating.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already rated this helper for this match' });
    }

    // 5. Insert the rating
    const insertRating = await client.query(
      `INSERT INTO ratings (match_id, rater_id, ratee_id, score, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [matchId, raterId, match.helper_id, score, comment || null]
    );

    // 6. Lock the helper user row and update average rating
    await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [match.helper_id]
    );

    const avgRatingQuery = await client.query(
      `SELECT AVG(score) as avg_rating, COUNT(*) as total_ratings
       FROM ratings
       WHERE ratee_id = $1`,
      [match.helper_id]
    );

    const { avg_rating, total_ratings } = avgRatingQuery.rows[0];

    await client.query(
      'UPDATE users SET rating = $1 WHERE id = $2',
      [parseFloat(avg_rating).toFixed(2), match.helper_id]
    );

    await client.query('COMMIT');

    console.log(`✅ Rating created: Helper ${match.helper_id} now has rating ${parseFloat(avg_rating).toFixed(2)}`);

    res.status(201).json({
      message: 'Rating submitted successfully',
      rating: insertRating.rows[0],
      helperNewRating: parseFloat(avg_rating).toFixed(2),
      totalRatings: parseInt(total_ratings)
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating rating:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

module.exports = createRating;