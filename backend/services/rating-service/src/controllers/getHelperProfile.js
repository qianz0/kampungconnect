const db = require('../db');

/**
 * Get helper profile with ratings for display
 * GET /api/ratings/helper-profile/:helperId
 */
const getHelperProfile = async (req, res) => {
  const { helperId } = req.params;

  try {
    // 1. Get helper basic info
    const helperQuery = await db.query(
      `SELECT id, firstname, lastname, picture, rating, 
              CASE 
                WHEN role = 'volunteer' THEN 'Community Volunteer'
                WHEN role = 'caregiver' THEN 'Professional Caregiver'
                ELSE UPPER(SUBSTRING(role, 1, 1)) || LOWER(SUBSTRING(role, 2))
              END as role_display,
              created_at
       FROM users 
       WHERE id = $1 AND role IN ('volunteer', 'caregiver')`,
      [helperId]
    );

    if (helperQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Helper not found' });
    }

    const helper = helperQuery.rows[0];

    // 2. Get rating statistics
    const statsQuery = await db.query(
      `SELECT 
        COUNT(*) as total_ratings,
        AVG(score) as avg_rating,
        COUNT(CASE WHEN score = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN score = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN score = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN score = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN score = 1 THEN 1 END) as one_star
       FROM ratings
       WHERE ratee_id = $1`,
      [helperId]
    );

    const stats = statsQuery.rows[0];

    // 3. Get recent ratings with comments
    const recentRatingsQuery = await db.query(
      `SELECT r.score, r.comment, r.created_at,
              u.firstname, u.lastname
       FROM ratings r
       JOIN users u ON r.rater_id = u.id
       WHERE r.ratee_id = $1 AND r.comment IS NOT NULL AND r.comment != ''
       ORDER BY r.created_at DESC
       LIMIT 5`,
      [helperId]
    );

    // 4. Get completed tasks count
    const tasksQuery = await db.query(
      'SELECT COUNT(*) as completed_tasks FROM matches WHERE helper_id = $1 AND status = $2',
      [helperId, 'completed']
    );

    res.json({
      helper: {
        id: helper.id,
        name: `${helper.firstname} ${helper.lastname}`,
        picture: helper.picture,
        role: helper.role_display,
        memberSince: helper.created_at,
        completedTasks: parseInt(tasksQuery.rows[0].completed_tasks)
      },
      ratings: {
        average: parseFloat(stats.avg_rating || 5.0).toFixed(1),
        total: parseInt(stats.total_ratings || 0),
        distribution: {
          5: parseInt(stats.five_star || 0),
          4: parseInt(stats.four_star || 0),
          3: parseInt(stats.three_star || 0),
          2: parseInt(stats.two_star || 0),
          1: parseInt(stats.one_star || 0)
        }
      },
      recentReviews: recentRatingsQuery.rows.map(review => ({
        score: review.score,
        comment: review.comment,
        date: review.created_at,
        reviewer: `${review.firstname} ${review.lastname.charAt(0)}.`
      }))
    });

  } catch (error) {
    console.error('Error fetching helper profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = getHelperProfile;