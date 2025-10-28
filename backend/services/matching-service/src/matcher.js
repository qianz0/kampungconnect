const db = require("./db");

// Enhanced matching algorithm: match helper in same location
async function findBestHelper(request) {
  if (!request || !request.user_id) {
    console.error("❌ findBestHelper: request.user_id missing");
    return null;
  }

  // 1️. Get the senior’s location
  const senior = await db.query(
    `SELECT location FROM users WHERE id = $1 LIMIT 1`,
    [request.user_id]
  );

  if (senior.rowCount === 0 || !senior.rows[0].location) {
    console.warn("⚠️ Senior has no location set, using fallback search");
    // Fallback: any top-rated active helper
    const fallback = await db.query(`
      SELECT id,
             CONCAT(firstname, ' ', lastname) AS name,
             role,
             rating,
             location
      FROM users
      WHERE role IN ('volunteer', 'caregiver')
        AND is_active = true
      ORDER BY rating DESC, RANDOM()
      LIMIT 1
    `);
    return fallback.rows[0] || null;
  }

  const seniorLocation = senior.rows[0].location;

  // 2️. Find best helpers near or in same location
  const result = await db.query(`
    SELECT id,
           CONCAT(firstname, ' ', lastname) AS name,
           role,
           rating,
           location
    FROM users
    WHERE role IN ('volunteer', 'caregiver')
      AND is_active = true
      AND location ILIKE $1
    ORDER BY rating DESC, RANDOM()
    LIMIT 1
  `, [seniorLocation]);

  // 3️. Fallback if no helpers in same location
  if (result.rowCount === 0) {
    console.warn(`⚠️ No helpers found in location '${seniorLocation}', using fallback`);
    const fallback = await db.query(`
      SELECT id,
             CONCAT(firstname, ' ', lastname) AS name,
             role,
             rating,
             location
      FROM users
      WHERE role IN ('volunteer', 'caregiver')
        AND is_active = true
      ORDER BY rating DESC, RANDOM()
      LIMIT 1
    `);
    return fallback.rows[0] || null;
  }

  return result.rows[0];
}

module.exports = { findBestHelper };
