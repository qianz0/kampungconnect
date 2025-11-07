const { Pool } = require('pg');

/**
 * Database service for user management
 */
class DatabaseService {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'db',
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
            
            // Create pending_users table if it doesn't exist
            await this.createPendingUsersTable();
            
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    async createPendingUsersTable() {
        const client = await this.pool.connect();
        
        try {
            const query = `
                CREATE TABLE IF NOT EXISTS pending_users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    firstname VARCHAR(100) NOT NULL,
                    lastname VARCHAR(100) NOT NULL,
                    password_hash TEXT NOT NULL,
                    role VARCHAR(50),
                    location VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
                );
                
                -- Create index for faster lookups
                CREATE INDEX IF NOT EXISTS idx_pending_users_email ON pending_users(email);
                CREATE INDEX IF NOT EXISTS idx_pending_users_expires_at ON pending_users(expires_at);
            `;
            
            await client.query(query);
            console.log('Pending users table ready');
        } catch (error) {
            console.error('Error creating pending_users table:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async findOrCreateUser(userData) {
        const client = await this.pool.connect();
        
        try {
            // Try to find existing user
            const findQuery = `
                SELECT * FROM users 
                WHERE provider_id = $1 OR email = $2
            `;
            const findResult = await client.query(findQuery, [userData.id, userData.email]);
            
            // If user exists → update
            if (findResult.rows.length > 0) {
                const existingUser = findResult.rows[0];
                
                // Extract names
                const firstname = userData.firstname || 
                                (userData.name ? userData.name.trim().split(' ')[0] : '') || '';
                const lastname = userData.lastname || 
                            (userData.name ? userData.name.trim().split(' ').slice(1).join(' ') : '') || '';
                
                // If the existing user was created with email/password (provider_id is NULL)
                // and now logging in with OAuth, update the provider_id and provider
                if (!existingUser.provider_id && existingUser.provider === 'email' && userData.provider !== 'email') {
                    console.log(`Linking OAuth account (${userData.provider}) to existing email account: ${userData.email}`);
                    const linkQuery = `
                        UPDATE users 
                        SET firstname = $1, lastname = $2, picture = $3, provider_id = $4, provider = $5, 
                            email_verified = TRUE, updated_at = CURRENT_TIMESTAMP 
                        WHERE email = $6
                        RETURNING id, provider_id, email, firstname, lastname, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at
                    `;
                    
                    const linkResult = await client.query(linkQuery, [
                        firstname,
                        lastname,
                        userData.picture || null,
                        userData.id,
                        userData.provider,
                        userData.email
                    ]);
                    
                    return linkResult.rows[0];
                } else {
                    // Normal update for existing OAuth users
                    const updateQuery = `
                        UPDATE users 
                        SET firstname = $1, lastname = $2, picture = $3, email_verified = TRUE, updated_at = CURRENT_TIMESTAMP 
                        WHERE provider_id = $4 OR email = $5
                        RETURNING id, provider_id, email, firstname, lastname, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at
                    `;
                    
                    const updateResult = await client.query(updateQuery, [
                        firstname,
                        lastname,
                        userData.picture || null,
                        userData.id,
                        userData.email
                    ]);

                    return updateResult.rows[0];
                }
            }

            // Otherwise → insert a new user
            const insertQuery = `
                INSERT INTO users (provider_id, email, firstname, lastname, picture, provider, role, email_verified)
                VALUES ($1, $2, $3, $4, $5, $6, NULL, TRUE)
                RETURNING id, provider_id, email, firstname, lastname, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at
            `;
            
            const nameStr = (typeof userData.name === 'string' && userData.name) ? userData.name.trim() : '';
            const nameParts = nameStr ? nameStr.split(' ') : ['', ''];
            const firstname = userData.firstname || nameParts[0] || '';
            const lastname = userData.lastname || nameParts.slice(1).join(' ') || '';

            const insertResult = await client.query(insertQuery, [
                userData.id,
                userData.email,
                firstname,
                lastname,
                userData.picture || null,
                userData.provider
            ]);

            // Return the raw DB row directly
            return insertResult.rows[0];

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
            
            // Generate default profile picture using first and last name initials
            const displayName = `${userData.firstname} ${userData.lastname}`.trim();
            const defaultPicture = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6c757d&color=fff&size=200`;
            
            // Create new email/password user
            const insertQuery = `
                INSERT INTO users (email, firstname, lastname, password_hash, picture, provider, role, location, email_verified)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id, email, firstname, lastname, picture, provider, role, location, email_verified, created_at
            `;
            const insertResult = await client.query(insertQuery, [
                userData.email,
                userData.firstname,
                userData.lastname,
                userData.passwordHash,
                defaultPicture,
                'email',
                userData.role || 'senior',
                userData.location || null,
                false
            ]);

            // Return raw row (all lowercase fields)
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
            const query = `
                SELECT id, provider_id, email, firstname, lastname, password_hash, picture, provider, role,
                    rating, location, email_verified, is_active, created_at, updated_at, last_login
                FROM users
                WHERE email = $1 AND is_active = TRUE
            `;
            const result = await client.query(query, [email]);
            return result.rows[0] || null;  // Return raw DB row

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
                RETURNING id, email, firstname, lastname
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
                RETURNING id, email, firstname, lastname, email_verified
            `;
            const result = await client.query(query, [userId]);
            return result.rows[0];  // Return raw DB row
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
                RETURNING id, email, firstname, lastname, provider, role, location
            `;
            const result = await client.query(query, [role, location, userId]);
            return result.rows[0];  // Return raw DB row
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
            const query = 'SELECT id, provider_id, email, firstname, lastname, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at, last_login FROM users WHERE id = $1';
            const result = await client.query(query, [userId]);
            return result.rows[0] || null;  // Return raw DB row or null
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async createPendingUser(userData) {
        const client = await this.pool.connect();
        
        try {
            // Delete any existing pending user with this email
            await client.query('DELETE FROM pending_users WHERE email = $1', [userData.email]);
            
            // Insert new pending user
            const insertQuery = `
                INSERT INTO pending_users (email, firstname, lastname, password_hash, role, location)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, email, firstname, lastname, role, location, created_at
            `;
            
            const result = await client.query(insertQuery, [
                userData.email,
                userData.firstname,
                userData.lastname,
                userData.passwordHash,
                userData.role || 'senior',
                userData.location || null
            ]);
            
            return result.rows[0];
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getPendingUser(email) {
        const client = await this.pool.connect();
        
        try {
            const query = `
                SELECT id, email, firstname, lastname, password_hash, role, location, created_at, expires_at
                FROM pending_users 
                WHERE email = $1 AND expires_at > NOW()
            `;
            
            const result = await client.query(query, [email]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async deletePendingUser(email) {
        const client = await this.pool.connect();
        
        try {
            await client.query('DELETE FROM pending_users WHERE email = $1', [email]);
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async cleanupExpiredPendingUsers() {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query('DELETE FROM pending_users WHERE expires_at <= NOW()');
            if (result.rowCount > 0) {
                console.log(`Cleaned up ${result.rowCount} expired pending user(s)`);
            }
        } catch (error) {
            console.error('Error cleaning up pending users:', error);
        } finally {
            client.release();
        }
    }

    async findUserByEmailForReset(email) {
        const client = await this.pool.connect();
        
        try {
            const query = `
                SELECT id, email, firstname, lastname, provider 
                FROM users 
                WHERE email = $1 AND provider = 'email' AND is_active = TRUE
            `;
            const result = await client.query(query, [email]);
            return result.rows[0] || null;  // Return raw DB row
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateUserProfile(userId, profileData) {
        const client = await this.pool.connect();
        
        try {
            const query = `
                UPDATE users 
                SET firstname = $1, lastname = $2, location = $3, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $4
                RETURNING id, email, firstname, lastname, provider, role, location, picture, email_verified, created_at, updated_at
            `;
            const result = await client.query(query, [
                profileData.firstname,
                profileData.lastname,
                profileData.location || null,
                userId
            ]);
            return result.rows[0] || null; // Return raw DB row or null
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateLastLogin(userId) {
        const client = await this.pool.connect();
        
        try {
            // First get the current last_login (which is the PREVIOUS login time)
            const getCurrentQuery = `
                SELECT last_login 
                FROM users 
                WHERE id = $1
            `;
            const currentResult = await client.query(getCurrentQuery, [userId]);
            const previousLogin = currentResult.rows[0]?.last_login || null;
            
            // Now update to current timestamp
            const updateQuery = `
                UPDATE users 
                SET last_login = CURRENT_TIMESTAMP 
                WHERE id = $1
                RETURNING last_login
            `;
            await client.query(updateQuery, [userId]);
            
            // Return the PREVIOUS login time (before the update)
            return previousLogin;
        } catch (error) {
            console.error('Database error updating last login:', error);
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