const db = require("./db");

// Basic matching algorithm
async function findBestHelper(request) {
  const result = await db.query(`
    SELECT id, name, role, rating
    FROM users
    WHERE role = 'helper' AND is_active = true
    ORDER BY rating DESC
    LIMIT 1
  `);
  return result.rows[0] || null;
}

module.exports = { findBestHelper };