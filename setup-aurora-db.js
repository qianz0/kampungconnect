const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

// Database configuration for AWS RDS PostgreSQL
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: 'postgres', // Default PostgreSQL database for initial connection
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false // Required for AWS RDS connections
    },
    connectionTimeoutMillis: 10000, // 10 second timeout
    idleTimeoutMillis: 30000
};

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables in .env file:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease check your .env file and ensure all database variables are set.');
    process.exit(1);
}

async function setupDatabase() {
    const pool = new Pool(dbConfig);

    try {
        console.log('Connecting to AWS RDS PostgreSQL...');

        // Test connection
        const client = await pool.connect();
        console.log('✅ Successfully connected to AWS RDS PostgreSQL');

        // Check if target database exists, create if not
        console.log(`Checking if ${process.env.DB_NAME} database exists...`);
        const dbExists = await client.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [process.env.DB_NAME]);

        if (dbExists.rows.length === 0) {
            console.log(`Creating ${process.env.DB_NAME} database...`);
            // Note: Database name cannot be parameterized, so we validate it first
            const dbName = process.env.DB_NAME.replace(/[^a-zA-Z0-9_]/g, '');
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`✅ Database "${process.env.DB_NAME}" created successfully`);
        } else {
            console.log(`✅ Database "${process.env.DB_NAME}" already exists`);
        }

        client.release();

        // Now connect to the kampungconnect database to create tables
        const kampungConnectConfig = { ...dbConfig, database: process.env.DB_NAME };
        const kampungConnectPool = new Pool(kampungConnectConfig);
        const kampungConnectClient = await kampungConnectPool.connect();

        // Read and execute the init.sql file
        const initSqlPath = path.join(__dirname, 'backend', 'db', 'init.sql');
        const initSql = fs.readFileSync(initSqlPath, 'utf8');

        console.log('Executing database initialization script...');
        await kampungConnectClient.query(initSql);
        console.log('✅ Database schema initialized successfully');

        // Verify tables were created
        const result = await kampungConnectClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

        console.log('📋 Created tables:');
        result.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        kampungConnectClient.release();
        await kampungConnectPool.end();

    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        console.error('Error code:', error.code);

        if (error.code === 'ENOTFOUND') {
            console.error('🌐 DNS resolution failed. Check your internet connection and database host.');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('⏰ Connection timed out. This usually means:');
            console.error('   1. RDS instance is not publicly accessible');
            console.error('   2. Security group doesn\'t allow your IP address');
            console.error('   3. RDS instance is in a private subnet');
            console.error('   4. Network connectivity issues');
        } else if (error.code === '28P01') {
            console.error('🔐 Authentication failed. Check your username and password.');
        } else if (error.code === '3D000') {
            console.error('🗄️  Database does not exist. Please create the database first.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('🚫 Connection refused. Check if the database is running and accessible.');
        }

        console.error('\n🔍 Troubleshooting steps:');
        console.error('1. Check AWS RDS Security Groups - ensure port 5432 is open to your IP');
        console.error('2. Verify RDS instance is publicly accessible');
        console.error('3. Check your internet connection');
        console.error('4. Confirm RDS instance status is "Available"');

        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the setup
setupDatabase();