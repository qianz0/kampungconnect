const db = require("./db");

async function findBestHelper(request) {
  if (!request || !request.user_id) {
    console.error("❌ findBestHelper: request.user_id missing");
    return null;
  }

  // 1️⃣ Get the senior’s location
  const senior = await db.query(
    `SELECT location FROM users WHERE id = $1 LIMIT 1`,
    [request.user_id]
  );

  if (senior.rowCount === 0 || !senior.rows[0].location) {
    console.warn("⚠️ Senior has no location set, using fallback search");
    return await findFallbackHelper(request);
  }

  const seniorLocation = senior.rows[0].location;

  // 2️⃣ Find best helper in same location that satisfies limits
  const result = await db.query(
    `
    SELECT u.id,
           CONCAT(u.firstname, ' ', u.lastname) AS name,
           u.role,
           u.rating,
           u.location
    FROM users u
    WHERE u.role IN ('volunteer', 'caregiver')
      AND u.is_active = true
      AND u.location ILIKE $1
      AND (
        SELECT COUNT(*) 
        FROM matches m
        WHERE m.helper_id = u.id
          AND m.status = 'active'
      ) < 5
      AND (
        -- allow only 1 urgent request per helper
        $2 != 'urgent' OR
        (
          SELECT COUNT(*)
          FROM matches m2
          JOIN requests r2 ON r2.id = m2.request_id
          WHERE m2.helper_id = u.id
            AND m2.status = 'active'
            AND r2.urgency = 'urgent'
        ) = 0
      )
    ORDER BY u.rating DESC, RANDOM()
    LIMIT 1
    `,
    [seniorLocation, request.urgency]
  );

  // 3️⃣ Fallback if none in location
  if (result.rowCount === 0) {
    console.warn(
      `⚠️ No eligible helpers found in '${seniorLocation}', using fallback`
    );
    return await findFallbackHelper(request);
  }

  return result.rows[0];
}

// 🧩 Fallback search (any location)
async function findFallbackHelper(request) {
  const result = await db.query(
    `
    SELECT u.id,
           CONCAT(u.firstname, ' ', u.lastname) AS name,
           u.role,
           u.rating,
           u.location
    FROM users u
    WHERE u.role IN ('volunteer', 'caregiver')
      AND u.is_active = true
      AND (
        SELECT COUNT(*) 
        FROM matches m
        WHERE m.helper_id = u.id
          AND m.status = 'active'
      ) < 5
      AND (
        $1 != 'urgent' OR
        (
          SELECT COUNT(*)
          FROM matches m2
          JOIN requests r2 ON r2.id = m2.request_id
          WHERE m2.helper_id = u.id
            AND m2.status = 'active'
            AND r2.urgency = 'urgent'
        ) = 0
      )
    ORDER BY u.rating DESC, RANDOM()
    LIMIT 1
    `,
    [request.urgency]
  );

  return result.rows[0] || null;
}

module.exports = { findBestHelper };
