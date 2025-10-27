const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'kampungconnect',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password'
});

async function waitForDatabase(maxRetries = 10, delay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await pool.query('SELECT 1');
            console.log('✅ Database connection successful');
            return true;
        } catch (error) {
            console.log(`⏳ Waiting for database... (attempt ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Could not connect to database after multiple attempts');
}

async function createAdminUser() {
    let client;
    try {
        // Wait for database to be ready
        await waitForDatabase();

        const email = 'kampungconnectsit@gmail.com';
        const password = 'Admin123!';
        const firstname = 'System';
        const lastname = 'Admin';

        console.log('🔐 Setting up admin user...');

        // Hash the password using bcrypt (same method as auth-service)
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Get a client from the pool
        client = await pool.connect();

        // Check if user already exists
        const checkResult = await client.query(
            'SELECT id, email, role FROM users WHERE email = $1',
            [email]
        );

        if (checkResult.rows.length > 0) {
            const existingUser = checkResult.rows[0];
            
            // Only update if not already an admin or password needs refresh
            if (existingUser.role !== 'admin') {
                console.log('⚠️  User exists but is not admin. Updating to admin role...');
                
                await client.query(
                    'UPDATE users SET password_hash = $1, provider = $2, role = $3, email_verified = $4, is_active = $5 WHERE email = $6',
                    [passwordHash, 'email', 'admin', true, true, email]
                );
                
                console.log('✅ User promoted to admin successfully!');
            } else {
                console.log('✅ Admin user already exists (ID: ' + existingUser.id + ')');
            }
        } else {
            // Insert new admin user
            const insertResult = await client.query(
                `INSERT INTO users (
                    provider_id, email, firstname, lastname, password_hash, 
                    picture, provider, role, email_verified, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id, email, firstname, lastname, role`,
                [null, email, firstname, lastname, passwordHash, null, 'email', 'admin', true, true]
            );

            console.log('✅ Admin user created successfully!');
            console.log('   ID:', insertResult.rows[0].id);
            console.log('   Email:', insertResult.rows[0].email);
            console.log('   Role:', insertResult.rows[0].role);
        }

    } catch (error) {
        console.error('❌ Error setting up admin user:', error.message);
        // Don't throw - allow the service to continue even if admin creation fails
        console.error('⚠️  Service will continue, but admin user may not be available');
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    createAdminUser().then(() => {
        console.log('Admin setup complete');
        process.exit(0);
    }).catch(error => {
        console.error('Admin setup failed:', error);
        process.exit(1);
    });
}

module.exports = createAdminUser;
