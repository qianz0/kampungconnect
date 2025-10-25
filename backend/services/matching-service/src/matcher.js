const db = require("./db");

// Basic matching algorithm
async function findBestHelper(request) {
  const result = await db.query(`
SELECT id,
       CONCAT(firstName, ' ', lastName) AS name,
       role,
       rating
FROM users
WHERE role IN ('volunteer', 'caregiver')
  AND is_active = true
ORDER BY rating DESC, RANDOM()
LIMIT 1;

  `);
  return result.rows[0] || null;
}

module.exports = { findBestHelper };