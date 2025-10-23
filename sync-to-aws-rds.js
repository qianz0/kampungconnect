const { Pool } = require('pg');
require('dotenv').config();

// Local database configuration
const localConfig = {
    host: 'localhost', // Local Docker container
    port: 5432,
    database: process.env.DB_NAME || 'kampungconnect',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    ssl: false
};

// AWS RDS configuration
const awsConfig = {
    host: 'cloud-db.ch6u6omcg104.ap-southeast-2.rds.amazonaws.com',
    port: 5432,
    database: process.env.AWS_DB_NAME || 'postgres', // Update this if needed
    user: process.env.AWS_DB_USER, // Set in .env file
    password: process.env.AWS_DB_PASSWORD, // Set in .env file
    ssl: {
        rejectUnauthorized: false // For AWS RDS SSL connection
    }
};

const localPool = new Pool(localConfig);
const awsPool = new Pool(awsConfig);

// Tables to sync (in order of dependencies)
const TABLES_TO_SYNC = [
    'users',      // Must be first (no dependencies)
    'requests',   // Depends on users (user_id)
    'matches',    // Depends on requests and users
    'ratings'     // Depends on matches and users
];

async function testConnections() {
    console.log('🔌 Testing database connections...\n');

    try {
        // Test local connection
        const localClient = await localPool.connect();
        const localResult = await localClient.query('SELECT NOW() as current_time, version()');
        localClient.release();
        console.log('✅ Local PostgreSQL connection successful');
        console.log(`   Time: ${localResult.rows[0].current_time}`);
        console.log(`   Version: ${localResult.rows[0].version.split(',')[0]}\n`);

        // Test AWS RDS connection
        const awsClient = await awsPool.connect();
        const awsResult = await awsClient.query('SELECT NOW() as current_time, version()');
        awsClient.release();
        console.log('✅ AWS RDS PostgreSQL connection successful');
        console.log(`   Time: ${awsResult.rows[0].current_time}`);
        console.log(`   Version: ${awsResult.rows[0].version.split(',')[0]}\n`);

        return true;
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        return false;
    }
}

async function getTableSchema(pool, tableName) {
    const query = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `;
    const result = await pool.query(query, [tableName]);
    return result.rows;
}

async function tableExists(pool, tableName) {
    const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    )
  `;
    const result = await pool.query(query, [tableName]);
    return result.rows[0].exists;
}

async function createTablesIfNotExist() {
    console.log('🏗️  Checking and creating tables in AWS RDS...\n');

    // Read the init.sql file to create tables
    const fs = require('fs');
    const path = require('path');
    const initSqlPath = path.join(__dirname, 'backend', 'db', 'init.sql');

    if (!fs.existsSync(initSqlPath)) {
        console.error('❌ init.sql file not found at:', initSqlPath);
        return false;
    }

    const initSql = fs.readFileSync(initSqlPath, 'utf8');

    try {
        const awsClient = await awsPool.connect();
        await awsClient.query(initSql);
        awsClient.release();
        console.log('✅ Tables created/verified in AWS RDS\n');
        return true;
    } catch (error) {
        console.error('❌ Failed to create tables in AWS RDS:', error.message);
        return false;
    }
}

async function getTableCount(pool, tableName) {
    try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        return parseInt(result.rows[0].count);
    } catch (error) {
        return 0;
    }
}

async function syncTable(tableName) {
    console.log(`🔄 Syncing table: ${tableName}`);

    try {
        // Get local data
        const localData = await localPool.query(`SELECT * FROM ${tableName} ORDER BY id`);
        console.log(`   📊 Local records: ${localData.rows.length}`);

        if (localData.rows.length === 0) {
            console.log(`   ⏭️  No data to sync for ${tableName}\n`);
            return true;
        }

        // Get AWS data count
        const awsCount = await getTableCount(awsPool, tableName);
        console.log(`   📊 AWS records before sync: ${awsCount}`);

        // Clear existing data in AWS (for clean sync)
        if (awsCount > 0) {
            await awsPool.query(`DELETE FROM ${tableName}`);
            console.log(`   🗑️  Cleared existing AWS data`);
        }

        // Prepare bulk insert
        if (localData.rows.length > 0) {
            const sampleRow = localData.rows[0];
            const columns = Object.keys(sampleRow);
            const placeholders = columns.map((_, colIndex) =>
                `(${columns.map((_, paramIndex) => `$${colIndex * columns.length + paramIndex + 1}`).join(', ')})`
            ).join(', ');

            // Build values array for bulk insert
            const values = [];
            localData.rows.forEach(row => {
                columns.forEach(col => {
                    values.push(row[col]);
                });
            });

            // Create individual insert statements to avoid parameter limits
            for (let i = 0; i < localData.rows.length; i++) {
                const row = localData.rows[i];
                const rowValues = columns.map(col => row[col]);
                const rowPlaceholders = columns.map((_, index) => `$${index + 1}`).join(', ');

                const insertQuery = `
          INSERT INTO ${tableName} (${columns.join(', ')}) 
          VALUES (${rowPlaceholders})
        `;

                await awsPool.query(insertQuery, rowValues);

                // Show progress for large tables
                if ((i + 1) % 100 === 0 || i === localData.rows.length - 1) {
                    process.stdout.write(`\r   📝 Inserted ${i + 1}/${localData.rows.length} records`);
                }
            }
            console.log(); // New line after progress
        }

        // Reset sequence for auto-increment fields
        if (localData.rows.length > 0) {
            const maxId = Math.max(...localData.rows.map(row => row.id || 0));
            if (maxId > 0) {
                await awsPool.query(`SELECT setval('${tableName}_id_seq', ${maxId})`);
                console.log(`   🔢 Reset sequence to ${maxId}`);
            }
        }

        // Verify sync
        const finalAwsCount = await getTableCount(awsPool, tableName);
        console.log(`   ✅ Sync complete: ${finalAwsCount} records in AWS\n`);

        return true;
    } catch (error) {
        console.error(`   ❌ Failed to sync ${tableName}:`, error.message);
        return false;
    }
}

async function performFullSync() {
    console.log('🚀 Starting full database synchronization...\n');

    // Test connections first
    if (!(await testConnections())) {
        console.error('❌ Connection tests failed. Please check your configuration.');
        process.exit(1);
    }

    // Create tables in AWS if they don't exist
    if (!(await createTablesIfNotExist())) {
        console.error('❌ Failed to create tables in AWS RDS.');
        process.exit(1);
    }

    // Sync each table in dependency order
    let successCount = 0;
    for (const tableName of TABLES_TO_SYNC) {
        const success = await syncTable(tableName);
        if (success) successCount++;
    }

    console.log('📋 Synchronization Summary:');
    console.log(`   ✅ Successfully synced: ${successCount}/${TABLES_TO_SYNC.length} tables`);

    if (successCount === TABLES_TO_SYNC.length) {
        console.log('🎉 Full synchronization completed successfully!');
    } else {
        console.log('⚠️  Some tables failed to sync. Check the logs above.');
    }
}

async function compareDatabases() {
    console.log('🔍 Comparing local and AWS databases...\n');

    for (const tableName of TABLES_TO_SYNC) {
        try {
            const localCount = await getTableCount(localPool, tableName);
            const awsCount = await getTableCount(awsPool, tableName);

            const status = localCount === awsCount ? '✅' : '⚠️';
            console.log(`${status} ${tableName}: Local(${localCount}) vs AWS(${awsCount})`);
        } catch (error) {
            console.log(`❌ ${tableName}: Error - ${error.message}`);
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'sync';

    try {
        switch (command) {
            case 'test':
                await testConnections();
                break;
            case 'compare':
                await compareDatabases();
                break;
            case 'sync':
                await performFullSync();
                break;
            default:
                console.log('Usage: node sync-to-aws-rds.js [test|compare|sync]');
                console.log('  test    - Test database connections');
                console.log('  compare - Compare record counts between databases');
                console.log('  sync    - Perform full synchronization (default)');
        }
    } catch (error) {
        console.error('💥 Unexpected error:', error);
    } finally {
        await localPool.end();
        await awsPool.end();
    }
}

if (require.main === module) {
    main();
}

module.exports = { testConnections, performFullSync, compareDatabases };