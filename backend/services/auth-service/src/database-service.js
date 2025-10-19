const { Pool } = require('pg');

/**
 * Database service for user management
 */
class DatabaseService {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'kampungconnect',
            user: process.env.DB_USER || 'admin',
            password: process.env.DB_PASSWORD || 'password',
        });
    }

    async waitForDatabase(maxRetries = 30, retryInterval = 2000) {
        let retries = 0;
        
        while (retries < maxRetries) {
            try {
                console.log(`Attempting to connect to database (attempt ${retries + 1}/${maxRetries})...`);
                await this.pool.query('SELECT 1');
                console.log('Database connection established successfully!');
                return true;
            } catch (error) {
                retries++;
                console.log(`Database connection failed: ${error.message}`);
                
                if (retries < maxRetries) {
                    console.log(`Retrying in ${retryInterval/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryInterval));
                } else {
                    console.error('Max database connection retries reached');
                    throw error;
                }
            }
        }
    }

    async initialize() {
        try {
            // Wait for database to be ready
            await this.waitForDatabase();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    async findOrCreateUser(userData) {
        const client = await this.pool.connect();
        
        try {
            // First, try to find existing user
            const findQuery = 'SELECT * FROM users WHERE provider_id = $1 OR email = $2';
            const findResult = await client.query(findQuery, [userData.id, userData.email]);
            
            if (findResult.rows.length > 0) {
                // Update existing user (for OIDC users)
                const updateQuery = `
                    UPDATE users 
                    SET firstname = $1, lastname = $2, picture = $3, updated_at = CURRENT_TIMESTAMP 
                    WHERE provider_id = $4 OR email = $5
                    RETURNING id, provider_id, email, firstname as "firstName", lastname as "lastName", password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at
                `;
                
                // Use provided firstName and lastName, or parse from name if not available
                const firstName = userData.firstName || 
                                (userData.name ? userData.name.trim().split(' ')[0] : '') || '';
                const lastName = userData.lastName || 
                               (userData.name ? userData.name.trim().split(' ').slice(1).join(' ') : '') || '';
                
                const updateResult = await client.query(updateQuery, [
                    firstName,
                    lastName,
                    userData.picture || null,
                    userData.id,
                    userData.email
                ]);
                
                return updateResult.rows[0];
            } else {
                // Create new user (for OIDC users) - no default role assigned
                const insertQuery = `
                    INSERT INTO users (provider_id, email, firstname, lastname, picture, provider, role)
                    VALUES ($1, $2, $3, $4, $5, $6, NULL)
                    RETURNING id, provider_id, email, firstname as "firstName", lastname as "lastName", password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at
                `;
                
                // Split name into firstName and lastName for OIDC users
                const nameStr = (typeof userData.name === 'string' && userData.name) ? userData.name.trim() : '';
                const nameParts = nameStr ? nameStr.split(' ') : ['', ''];
                const firstName = userData.firstName || nameParts[0] || '';
                const lastName = userData.lastName || nameParts.slice(1).join(' ') || '';
                
                const insertResult = await client.query(insertQuery, [
                    userData.id,
                    userData.email,
                    firstName,
                    lastName,
                    userData.picture || null,
                    userData.provider
                ]);
                return insertResult.rows[0];
            }
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async createEmailUser(userData) {
        const client = await this.pool.connect();
        
        try {
            // Check if user already exists
            const existingQuery = 'SELECT id FROM users WHERE email = $1';
            const existingResult = await client.query(existingQuery, [userData.email]);
            
            if (existingResult.rows.length > 0) {
                throw new Error('User with this email already exists');
            }
            
            // Create new email/password user
            const insertQuery = `
                INSERT INTO users (email, firstname, lastname, password_hash, provider, role, location, email_verified)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, email, firstname as "firstName", lastname as "lastName", provider, role, location, email_verified, created_at
            `;
            const insertResult = await client.query(insertQuery, [
                userData.email,
                userData.firstName,
                userData.lastName,
                userData.passwordHash,
                'email',
                userData.role || 'senior',
                userData.location || null,
                false
            ]);
            return insertResult.rows[0];
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async findUserByEmail(email) {
        const client = await this.pool.connect();
        
        try {
            const query = 'SELECT id, provider_id, email, firstname as "firstName", lastname as "lastName", password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at FROM users WHERE email = $1 AND is_active = TRUE';
            const result = await client.query(query, [email]);
            const user = result.rows[0];
            
            if (user) {
                // Map database fields to camelCase for API response
                return user;
            }
            
            return null;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateUserPassword(userId, passwordHash) {
        const client = await this.pool.connect();
        
        try {
            const query = `
                UPDATE users 
                SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $2
                RETURNING id, email, firstname as "firstName", lastname as "lastName"
            `;
            const result = await client.query(query, [passwordHash, userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async verifyUserEmail(userId) {
        const client = await this.pool.connect();
        
        try {
            const query = `
                UPDATE users 
                SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $1
                RETURNING id, email, firstname as "firstName", lastname as "lastName", email_verified
            `;
            const result = await client.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateUserRole(userId, role, location = null) {
        const client = await this.pool.connect();
        
        try {
            const query = `
                UPDATE users 
                SET role = $1, location = $2, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $3
                RETURNING id, email, firstname as "firstName", lastname as "lastName", provider, role, location
            `;
            const result = await client.query(query, [role, location, userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getUserById(userId) {
        const client = await this.pool.connect();
        
        try {
            const query = 'SELECT id, provider_id, email, firstname as "firstName", lastname as "lastName", password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at FROM users WHERE id = $1';
            const result = await client.query(query, [userId]);
            const user = result.rows[0];
            
            if (user) {
                // Map database fields to camelCase for API response
                return user;
            }
            
            return null;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = DatabaseService;