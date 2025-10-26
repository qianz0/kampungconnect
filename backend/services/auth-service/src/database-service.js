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

    /**
     * Transform database row from snake_case/lowercase to camelCase
     */
    transformUserRow(row) {
        if (!row) return null;
        
        return {
            id: row.id,
            providerId: row.provider_id,
            email: row.email,
            firstName: row.firstname,
            lastName: row.lastname,
            passwordHash: row.password_hash,
            picture: row.picture,
            provider: row.provider,
            role: row.role,
            rating: row.rating,
            location: row.location,
            emailVerified: row.email_verified,
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastLogin: row.last_login,
            // Keep backwards compatibility
            password_hash: row.password_hash,
            email_verified: row.email_verified,
            created_at: row.created_at,
            updated_at: row.updated_at,
            last_login: row.last_login
        };
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
                    firstName VARCHAR(100) NOT NULL,
                    lastName VARCHAR(100) NOT NULL,
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
            // First, try to find existing user
            const findQuery = 'SELECT * FROM users WHERE provider_id = $1 OR email = $2';
            const findResult = await client.query(findQuery, [userData.id, userData.email]);
            
            if (findResult.rows.length > 0) {
                // Update existing user (for OIDC users) and mark email as verified
                const updateQuery = `
                    UPDATE users 
                    SET firstname = $1, lastname = $2, picture = $3, email_verified = TRUE, updated_at = CURRENT_TIMESTAMP 
                    WHERE provider_id = $4 OR email = $5
                    RETURNING id, provider_id, email, firstname, lastname, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at
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
                
                return this.transformUserRow(updateResult.rows[0]);
            } else {
                // Create new user (for OIDC users) with email automatically verified
                const insertQuery = `
                    INSERT INTO users (provider_id, email, firstname, lastname, picture, provider, role, email_verified)
                    VALUES ($1, $2, $3, $4, $5, $6, NULL, TRUE)
                    RETURNING id, provider_id, email, firstname, lastname, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at
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
                return this.transformUserRow(insertResult.rows[0]);
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
                RETURNING id, email, firstname, lastname, provider, role, location, email_verified, created_at
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
            return this.transformUserRow(insertResult.rows[0]);
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
            const query = 'SELECT id, provider_id, email, firstname, lastname, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at, updated_at, last_login FROM users WHERE email = $1 AND is_active = TRUE';
            const result = await client.query(query, [email]);
            const user = result.rows[0];
            
            if (user) {
                // Map database fields to camelCase for API response
                return this.transformUserRow(user);
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
            return this.transformUserRow(result.rows[0]);
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
            return this.transformUserRow(result.rows[0]);
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
            const user = result.rows[0];
            
            if (user) {
                return this.transformUserRow(user);
            }
            
            return null;
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
                userData.firstName,
                userData.lastName,
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
            return this.transformUserRow(result.rows[0]);
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
                profileData.firstName,
                profileData.lastName,
                profileData.location || null,
                userId
            ]);
            return this.transformUserRow(result.rows[0]);
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