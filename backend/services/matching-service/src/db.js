const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST || "postgres",
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "kampungconnect",
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20,
});

let isConnected = false;

pool.on("connect", () => {
    console.log("✅ Matching-service connected to Postgres");
    isConnected = true;
});

pool.on("error", (err) => {
    console.error("❌ Unexpected DB error", err);
    isConnected = false;
});

// Retry connection with exponential backoff
async function connectWithRetry(maxRetries = 10, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await pool.query("SELECT NOW()");
            console.log("✅ DB connection verified");
            isConnected = true;
            return;
        } catch (err) {
            console.error(`❌ DB connection attempt ${i + 1}/${maxRetries} failed:`, err.message);
            if (i < maxRetries - 1) {
                const waitTime = delay * Math.pow(2, i);
                console.log(`⏳ Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    console.error("❌ Failed to connect to database after all retries");
}

// Start connection attempts
connectWithRetry();

// Export pool with connection status
module.exports = pool;
module.exports.isConnected = () => isConnected;