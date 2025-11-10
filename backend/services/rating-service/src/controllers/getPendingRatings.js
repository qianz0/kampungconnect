const db = require('../db');

/**
 * Get completed matches that haven't been rated yet
 * GET /api/ratings/pending-ratings
 */
const getPendingRatings = async (req, res) => {
  console.log('Received request for pending ratings');
  
  if (!req.user) {
    console.error('No user found in request');
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  const seniorId = req.user.id;
  console.log('Processing request for senior ID:', seniorId);

  try {
    console.log('Executing database query...');
    const pendingQuery = await db.query(
      `SELECT m.id as match_id, m.matched_at,
              u.id as helper_id, u.firstname, u.lastname, u.picture,
              req.title, req.category, req.description
       FROM matches m
       JOIN requests req ON m.request_id = req.id
       JOIN users u ON m.helper_id = u.id
       WHERE req.user_id = $1 
         AND m.status = 'completed'
         AND NOT EXISTS (
           SELECT 1 FROM ratings r 
           WHERE r.match_id = m.id AND r.rater_id = $1
         )
       ORDER BY m.matched_at DESC`,
      [seniorId]
    );
    
    console.log('Query completed successfully. Found rows:', pendingQuery.rows.length);
    res.json({ pendingRatings: pendingQuery.rows });

  } catch (error) {
    console.error('Error fetching pending ratings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = getPendingRatings;