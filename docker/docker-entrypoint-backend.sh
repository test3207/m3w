#!/bin/sh
# Backend-only runtime entrypoint
# Runs database migrations before starting the server

set -e

echo "🚀 M3W Backend starting..."

# Step 1: Run database migrations
echo "📦 Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma
echo "✅ Migrations complete"

# Execute the main command
echo "🎵 Starting backend server..."
exec "$@"
