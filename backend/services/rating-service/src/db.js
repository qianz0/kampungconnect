const { Pool } = require('pg');

// Determine which database to use
const useAWS = process.env.USE_AWS_DB === 'true';

// console.log('DB_PASSWORD:', process.env.DB_PASSWORD, typeof process.env.DB_PASSWORD);

const pool = new Pool({
  host: useAWS ? process.env.AWS_DB_HOST : process.env.DB_HOST,
  port: useAWS ? process.env.AWS_DB_PORT : process.env.DB_PORT,
  database: useAWS ? process.env.AWS_DB_NAME : process.env.DB_NAME,
  user: useAWS ? process.env.AWS_DB_USER : process.env.DB_USER,
  password: useAWS ? process.env.AWS_DB_PASSWORD : process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: useAWS ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack);
  } else {
    console.log(`✅ Connected to ${useAWS ? 'AWS RDS' : 'Local PostgreSQL'} database`);
    release();
  }
});

module.exports = pool;