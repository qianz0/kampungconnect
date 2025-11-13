const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST || "db",
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "kampungconnect",
});

pool.on("connect", () => {
    console.log("✅ Matching-service connected to Postgres");
});

pool.on("error", (err) => {
    console.error("❌ Unexpected DB error", err);
});

(async () => {
    try {
        await pool.query("SELECT NOW()");
        console.log("✅ DB connection verified");
    } catch (err) {
        console.error("❌ DB connection failed:", err);
    }
})();

module.exports = pool;