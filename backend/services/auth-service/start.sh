#!/bin/sh

echo "Creating admin user..."
node create-admin.js || echo "Warning: Admin user creation failed or skipped"

echo "Starting Auth Service..."
exec node src/index.js