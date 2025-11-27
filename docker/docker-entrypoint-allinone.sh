#!/bin/sh
# All-in-One runtime configuration injection script
# 1. Runs database migrations
# 2. Injects API_BASE_URL into frontend index.html
# 3. Starts backend server

set -e

echo "🚀 M3W All-in-One starting..."

# Step 1: Run database migrations
echo "📦 Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma
echo "✅ Migrations complete"

# Step 2: Inject runtime configuration
echo "📝 Injecting runtime configuration..."

# Enable AIO mode for backend (affects OAuth redirects)
export SERVE_FRONTEND=true

# Default to current origin if not specified
API_BASE_URL="${API_BASE_URL:-}"

INDEX_FILE="/app/backend/public/index.html"

# Escape special characters for sed replacement (|, &, \, /)
escape_sed() {
  printf '%s' "$1" | sed 's/[|\&/\]/\\&/g'
}

if [ -f "$INDEX_FILE" ]; then
  if [ -n "$API_BASE_URL" ]; then
    echo "   API_BASE_URL: $API_BASE_URL"
    # Escape the URL for safe sed replacement
    ESCAPED_URL=$(escape_sed "$API_BASE_URL")
    # Replace only the value inside quotes, not the variable name
    # Pattern: '__API_BASE_URL__' -> '$API_BASE_URL'
    sed -i "s|'__API_BASE_URL__'|'$ESCAPED_URL'|g" "$INDEX_FILE"
    echo "✅ Configuration injected successfully"
  else
    # Default: use empty string (frontend will use relative URLs)
    echo "   API_BASE_URL not set, using relative URLs"
    sed -i "s|'__API_BASE_URL__'|''|g" "$INDEX_FILE"
    echo "✅ Configuration set to relative URLs"
  fi
else
  echo "⚠️  Warning: index.html not found at $INDEX_FILE"
fi

# Execute the main command
echo "🎵 Starting backend server..."
exec "$@"
