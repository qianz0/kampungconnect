const db = require('../db');

/**
 * Complete a match and trigger rating prompt
 * POST /api/ratings/complete-match/:matchId
 */
const completeMatch = async (req, res) => {
  const { matchId } = req.params;
  const userId = req.user.id;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify the match exists and user is authorized with row lock
    const matchQuery = await client.query(
      `SELECT m.id, m.helper_id, m.status, r.user_id as senior_id, r.title
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

    // 2. Verify user is either the senior or the helper
    if (match.senior_id !== userId && match.helper_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Unauthorized to complete this match' });
    }

    // Check if already completed
    if (match.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Match already completed' });
    }

    // 3. Update match status to completed
    await client.query(
      'UPDATE matches SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', matchId]
    );

    // 4. Update request status to completed
    await client.query(
      'UPDATE requests SET status = $1 WHERE id = (SELECT request_id FROM matches WHERE id = $2)',
      ['completed', matchId]
    );

    await client.query('COMMIT');

    console.log(`✅ Match ${matchId} completed by user ${userId}`);

    res.json({
      message: 'Match completed successfully',
      matchId: matchId,
      shouldPromptRating: match.senior_id === userId, // Only prompt senior to rate
      helperInfo: match.senior_id === userId ? {
        helperId: match.helper_id,
        requestTitle: match.title
      } : null
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error completing match:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

module.exports = completeMatch;