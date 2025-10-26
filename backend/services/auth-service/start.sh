#!/bin/sh
set -e

# Run admin user creation script
echo "📝 Creating admin user..."
node create-admin.js

# Start the main auth service
echo "🔐 Starting Auth Service..."
exec node src/index.js