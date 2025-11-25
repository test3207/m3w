#!/bin/sh
# All-in-One runtime configuration injection script
# Injects API_BASE_URL into frontend index.html before starting backend

set -e

echo "🚀 M3W All-in-One starting..."
echo "📝 Injecting runtime configuration..."

# Default to current origin if not specified
API_BASE_URL="${API_BASE_URL:-}"

if [ -n "$API_BASE_URL" ]; then
  echo "   API_BASE_URL: $API_BASE_URL"
  
  # Replace placeholder in index.html
  INDEX_FILE="/app/backend/public/index.html"
  
  if [ -f "$INDEX_FILE" ]; then
    sed -i "s|__API_BASE_URL__|$API_BASE_URL|g" "$INDEX_FILE"
    echo "✅ Configuration injected successfully"
  else
    echo "⚠️  Warning: index.html not found at $INDEX_FILE"
  fi
else
  echo "   API_BASE_URL not set, using build-time default"
fi

# Execute the main command
echo "🎵 Starting backend server..."
exec "$@"
