# AWS RDS PostgreSQL Sync Guide

This guide will help you sync your local PostgreSQL data to AWS RDS PostgreSQL database.

## Prerequisites

1. **AWS RDS PostgreSQL Database**: `cloud-db.ch6u6omcg104.ap-southeast-2.rds.amazonaws.com`
2. **Local PostgreSQL**: Running in Docker container
3. **Database credentials**: Username and password for AWS RDS

## Setup Steps

### 1. Configure Environment Variables

Create a `.env.local` file with your AWS RDS credentials:

```bash
# Copy the template and update with real credentials
cp .env.local.template .env.local
```

Update `.env.local` with your actual AWS RDS credentials:

```env
# Local Development Environment Variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kampungconnect
DB_USER=admin
DB_PASSWORD=password

# AWS RDS Configuration
AWS_DB_HOST=cloud-db.ch6u6omcg104.ap-southeast-2.rds.amazonaws.com
AWS_DB_PORT=5432
AWS_DB_NAME=kampungconnect
AWS_DB_USER=your_actual_aws_username
AWS_DB_PASSWORD=your_actual_aws_password

# Admin Panel Security
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme123
```

### 2. Test Connections

Before syncing, test both local and AWS RDS connections:

```bash
npm run test-aws
```

This will:
- ✅ Test local PostgreSQL connection
- ✅ Test AWS RDS PostgreSQL connection
- 📊 Show database versions and current time

### 3. Compare Databases (Optional)

Check current record counts in both databases:

```bash
npm run compare-dbs
```

### 4. Sync Data to AWS RDS

Perform full synchronization from local to AWS RDS:

```bash
npm run sync-to-aws
```

This process will:
1. 🏗️ Create tables in AWS RDS (if they don't exist)
2. 🔄 Sync data for each table in dependency order:
   - `users` (first - no dependencies)
   - `requests` (depends on users)
   - `matches` (depends on requests and users)
   - `ratings` (depends on matches and users)
3. 🔢 Reset auto-increment sequences
4. ✅ Verify successful sync

### 5. Access AWS RDS Database Viewer

View and manage your AWS RDS data through the web interface:

```bash
npm run db-viewer-aws
```

Then open: http://localhost:3002

Login with:
- Username: `admin`
- Password: `changeme123`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run test-aws` | Test both local and AWS RDS connections |
| `npm run compare-dbs` | Compare record counts between databases |
| `npm run sync-to-aws` | Full synchronization from local to AWS RDS |
| `npm run db-viewer` | Local PostgreSQL database viewer (port 3001) |
| `npm run db-viewer-aws` | AWS RDS database viewer (port 3002) |

## Sync Process Details

### Data Flow
```
Local PostgreSQL (Docker) → AWS RDS PostgreSQL
     localhost:5432      →  cloud-db.ch6u6omcg104.ap-southeast-2.rds.amazonaws.com:5432
```

### Table Sync Order
1. **users** - Base table with user information
2. **requests** - Help requests (references users.id)
3. **matches** - Helper assignments (references requests.id and users.id)
4. **ratings** - User ratings (references matches.id and users.id)

### Safety Features
- ✅ **Connection Testing**: Validates both databases before sync
- ✅ **Table Whitelisting**: Only syncs allowed tables
- ✅ **Dependency Order**: Syncs tables in correct order
- ✅ **Sequence Reset**: Maintains auto-increment integrity
- ✅ **Progress Tracking**: Shows sync progress for large tables
- ✅ **Error Handling**: Detailed error messages and recovery

## Troubleshooting

### Connection Issues

**Error**: `Connection failed to AWS RDS`

**Solutions**:
1. Check AWS RDS credentials in `.env.local`
2. Verify RDS security group allows your IP address
3. Ensure RDS instance is running and publicly accessible
4. Test network connectivity: `telnet cloud-db.ch6u6omcg104.ap-southeast-2.rds.amazonaws.com 5432`

### SSL Certificate Issues

**Error**: `SSL certificate verification failed`

**Solution**: The sync script uses `rejectUnauthorized: false` for AWS RDS SSL connections. This is acceptable for development but should be properly configured for production.

### Permission Issues

**Error**: `Permission denied for table`

**Solutions**:
1. Ensure AWS RDS user has CREATE, INSERT, UPDATE, DELETE permissions
2. Grant sequence permissions: `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO username;`

### Large Data Sets

For tables with many records (>1000), the sync shows progress:
```
📝 Inserted 500/1000 records
📝 Inserted 1000/1000 records
```

## Security Considerations

### Development vs Production

**Current Setup (Development)**:
- Basic authentication for database viewer
- SSL with `rejectUnauthorized: false`
- Hardcoded credentials in environment files

**Production Recommendations**:
- Use AWS IAM database authentication
- Properly configure SSL certificates
- Use AWS Secrets Manager for credentials
- Implement proper RBAC for database access
- Enable AWS RDS audit logging

### Network Security

- Ensure RDS security group restricts access to specific IP ranges
- Use VPN or bastion host for production access
- Enable encryption at rest and in transit

## Monitoring and Maintenance

### Regular Sync Schedule

For ongoing development, consider:
1. Manual sync when needed: `npm run sync-to-aws`
2. Automated sync via GitHub Actions or AWS Lambda
3. Incremental sync for large datasets (future enhancement)

### Data Validation

After sync, validate data integrity:
```bash
npm run compare-dbs
```

Check for:
- ✅ Matching record counts
- ✅ Data consistency
- ✅ Sequence values
- ✅ Foreign key constraints

## Next Steps

1. **Configure AWS RDS credentials** in `.env.local`
2. **Test connection** with `npm run test-aws`
3. **Perform initial sync** with `npm run sync-to-aws`
4. **Verify data** using `npm run db-viewer-aws`
5. **Set up regular sync process** as needed

## Support

If you encounter issues:
1. Check the console output for detailed error messages
2. Verify network connectivity to AWS RDS
3. Ensure all environment variables are correctly set
4. Test connections individually with `npm run test-aws`