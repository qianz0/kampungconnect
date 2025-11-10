const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased for Kubernetes
  acquireTimeoutMillis: 10000,   // Added for Kubernetes
  createTimeoutMillis: 5000,     // Added for Kubernetes
});

// Enhanced connection testing with retry logic for Kubernetes
async function testConnection(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ Connected to PostgreSQL database');
      client.release();
      return;
    } catch (err) {
      console.log(`❌ Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      if (i === retries - 1) {
        console.error('❌ Final database connection attempt failed:', err.stack);
        process.exit(1);
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

// Test connection on startup with retry logic
testConnection();

module.exports = pool;