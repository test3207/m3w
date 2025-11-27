#!/bin/sh
# All-in-One runtime configuration injection script
# Injects API_BASE_URL into frontend index.html before starting backend

set -e

echo "🚀 M3W All-in-One starting..."
echo "📝 Injecting runtime configuration..."

# Enable AIO mode for backend (affects OAuth redirects)
export SERVE_FRONTEND=true

# Default to current origin if not specified
API_BASE_URL="${API_BASE_URL:-}"

INDEX_FILE="/app/backend/public/index.html"

if [ -f "$INDEX_FILE" ]; then
  if [ -n "$API_BASE_URL" ]; then
    echo "   API_BASE_URL: $API_BASE_URL"
    # Replace only the value inside quotes, not the variable name
    # Pattern: '__API_BASE_URL__' -> '$API_BASE_URL'
    sed -i "s|'__API_BASE_URL__'|'$API_BASE_URL'|g" "$INDEX_FILE"
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
