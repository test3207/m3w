#!/bin/sh
# Backend-only runtime entrypoint
# Runs database migrations before starting the server

set -e

echo "🚀 M3W Backend starting..."

# Step 1: Run database migrations (skip if SKIP_MIGRATIONS is set)
if [ "${SKIP_MIGRATIONS:-false}" = "true" ]; then
  echo "⏭️  Skipping database migrations (SKIP_MIGRATIONS=true)"
else
  echo "📦 Running database migrations..."
  node node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma
  echo "✅ Migrations complete"
fi

# Execute the main command
echo "🎵 Starting backend server..."
exec "$@"
