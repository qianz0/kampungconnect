const { Pool } = require('pg');

// Load environment variables from .env file
require('dotenv').config();

// Test connection to AWS RDS
const testConnection = async () => {
    console.log('🔍 Testing connection to AWS RDS PostgreSQL...');
    console.log('Host:', process.env.DB_HOST);

    const pool = new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        database: 'postgres',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: {
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 15000, // 15 second timeout
        statement_timeout: 10000,
        query_timeout: 10000
    });

    try {
        console.log('⏳ Attempting to connect...');
        const client = await pool.connect();
        console.log('✅ Connection successful!');

        // Test a simple query
        const result = await client.query('SELECT version()');
        console.log('📊 PostgreSQL Version:', result.rows[0].version);

        // List databases
        const databases = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
        console.log('📋 Available databases:');
        databases.rows.forEach(db => console.log(`   - ${db.datname}`));

        client.release();
        console.log('✅ Test completed successfully');

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error code:', error.code);

        // More specific error messages
        if (error.code === 'ETIMEDOUT') {
            console.error('\n🚨 TIMEOUT ERROR - This means:');
            console.error('1. Your RDS instance may not be publicly accessible');
            console.error('2. Security group is blocking the connection');
            console.error('3. RDS is in a private subnet without proper routing');

            console.error('\n🛠️  To fix this:');
            console.error('1. Go to AWS Console → RDS → Databases → cloud-db');
            console.error('2. Check "Connectivity & security" tab');
            console.error('3. Ensure "Publicly accessible" is set to "Yes"');
            console.error('4. Check Security Groups - ensure inbound rule allows:');
            console.error('   - Type: PostgreSQL');
            console.error('   - Port: 5432');
            console.error('   - Source: Your IP or 0.0.0.0/0 (for testing)');

        } else if (error.code === 'ENOTFOUND') {
            console.error('\n🌐 DNS ERROR - The hostname cannot be resolved');
            console.error('Check your internet connection and the RDS endpoint');

        } else if (error.code === '28P01') {
            console.error('\n🔐 AUTHENTICATION ERROR');
            console.error('Username or password is incorrect');
        }

    } finally {
        await pool.end();
    }
};

testConnection();