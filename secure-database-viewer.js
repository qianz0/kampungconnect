const { Pool } = require('pg');
const express = require('express');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const app = express();
const port = 3001; // Changed port to avoid conflicts

// Basic security middleware
app.use(express.json());

// Simple authentication (for development only!)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

// Session store (in production, use Redis or database)
const sessions = new Map();

// Authentication middleware
function authenticateSession(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const session = sessions.get(sessionId);
  if (Date.now() > session.expires) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: 'Session expired' });
  }
  
  req.user = session.user;
  next();
}

// Database configuration with read-only approach
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Disable SSL for local development
  ssl: false,
  // Connection limits for security
  max: 5, // Maximum 5 connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

console.log(`🔌 Attempting to connect to database:`);
console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}`);

const pool = new Pool(dbConfig);

// Serve static files
app.use(express.static('public'));

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session = {
      user: { username },
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    
    sessions.set(sessionId, session);
    
    res.json({ 
      success: true, 
      sessionId,
      message: 'Login successful'
    });
  } else {
    // Add delay to prevent brute force
    setTimeout(() => {
      res.status(401).json({ error: 'Invalid credentials' });
    }, 1000);
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.json({ success: true, message: 'Logged out' });
});

// Protected API endpoints
app.get('/api/tables', authenticateSession, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Get table schema (columns and types)
app.get('/api/schema/:tableName', authenticateSession, async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Strict whitelist of allowed tables
    const allowedTables = ['users', 'requests', 'matches', 'ratings'];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: 'Table not allowed' });
    }
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default,
             character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    res.json({
      tableName,
      columns: result.rows
    });
  } catch (error) {
    console.error('Schema error:', error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// CREATE - Insert new record
app.post('/api/table/:tableName', authenticateSession, async (req, res) => {
  try {
    const { tableName } = req.params;
    const data = req.body;
    
    // Strict whitelist of allowed tables
    const allowedTables = ['users', 'requests', 'matches', 'ratings'];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: 'Table not allowed' });
    }
    
    // Remove id from data if present (auto-generated)
    delete data.id;
    delete data.created_at;
    delete data.updated_at;
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    res.json({
      success: true,
      message: 'Record created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create error:', error);
    res.status(500).json({ 
      error: 'Failed to create record',
      details: error.message 
    });
  }
});

// UPDATE - Update existing record
app.put('/api/table/:tableName/:id', authenticateSession, async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const data = req.body;
    
    // Strict whitelist of allowed tables
    const allowedTables = ['users', 'requests', 'matches', 'ratings'];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: 'Table not allowed' });
    }
    
    // Remove fields that shouldn't be updated
    delete data.id;
    delete data.created_at;
    
    // Add updated_at for users table
    if (tableName === 'users') {
      data.updated_at = new Date();
    }
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
    
    const query = `
      UPDATE ${tableName} 
      SET ${setClause} 
      WHERE id = $${values.length + 1} 
      RETURNING *
    `;
    
    const result = await pool.query(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json({
      success: true,
      message: 'Record updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ 
      error: 'Failed to update record',
      details: error.message 
    });
  }
});

// DELETE - Delete record
app.delete('/api/table/:tableName/:id', authenticateSession, async (req, res) => {
  try {
    const { tableName, id } = req.params;
    
    // Strict whitelist of allowed tables
    const allowedTables = ['users', 'requests', 'matches', 'ratings'];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: 'Table not allowed' });
    }
    
    const query = `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json({
      success: true,
      message: 'Record deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete record',
      details: error.message 
    });
  }
});

app.get('/api/table/:tableName', authenticateSession, async (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Max 1000 records
    
    // Strict whitelist of allowed tables
    const allowedTables = ['users', 'requests', 'matches', 'ratings'];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: 'Table not allowed' });
    }
    
    // Use parameterized query with identifier validation
    const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT $1`, [limit]);
    res.json({
      tableName,
      rowCount: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Restricted query endpoint (predefined queries only)
app.get('/api/query/:queryName', authenticateSession, async (req, res) => {
  try {
    const { queryName } = req.params;
    
    // Predefined safe queries only
    const allowedQueries = {
      userStats: 'SELECT role, COUNT(*) as count FROM users GROUP BY role',
      requestsByCategory: 'SELECT category, COUNT(*) as count FROM requests GROUP BY category',
      recentUsers: 'SELECT id, email, firstName, lastName, role, created_at FROM users ORDER BY created_at DESC LIMIT 10',
      activeRequests: 'SELECT id, category, type, status, created_at FROM requests WHERE status = $1 ORDER BY created_at DESC LIMIT 20'
    };
    
    if (!allowedQueries[queryName]) {
      return res.status(400).json({ error: 'Query not allowed' });
    }
    
    let result;
    if (queryName === 'activeRequests') {
      result = await pool.query(allowedQueries[queryName], ['pending']);
    } else {
      result = await pool.query(allowedQueries[queryName]);
    }
    
    res.json({
      queryName,
      rowCount: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Database error in query endpoint:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({ 
      error: 'Database error occurred',
      details: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    sessions: sessions.size
  });
});

// Debug endpoint to check table structure
app.get('/api/debug/columns/:tableName', authenticateSession, async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Get column information for the specified table
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    res.json({
      tableName,
      columns: result.rows
    });
  } catch (error) {
    console.error('Debug columns error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'secure-viewer.html'));
});

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expires) {
      sessions.delete(sessionId);
    }
  }
}, 60000); // Check every minute

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log(`✅ Database connection successful at ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error(`❌ Database connection failed:`, error.message);
    return false;
  }
}

app.listen(port, async () => {
  console.log(`🔒 Secure Database Viewer running at http://localhost:${port}`);
  console.log(`� Default login: ${process.env.ADMIN_USERNAME} / ${process.env.ADMIN_PASSWORD}`);
  console.log('⚠️  FOR DEVELOPMENT USE ONLY - NOT PRODUCTION READY');
  
  // Test the database connection
  const connected = await testDatabaseConnection();
  if (!connected) {
    console.log('💡 If you\'re running this outside Docker, make sure:');
    console.log('   1. PostgreSQL Docker container is running (docker-compose up db)');
    console.log('   2. DB_HOST is set to "localhost" (not "db") in .env');
    console.log('   3. Port 5432 is accessible from your host machine');
  }
});