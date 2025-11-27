#!/bin/sh
# Frontend runtime configuration injection script
# Replaces __API_BASE_URL__ placeholder with actual value from environment

set -e

echo "🚀 M3W Frontend starting..."
echo "📝 Injecting runtime configuration..."

# Default to relative path if not specified
API_BASE_URL="${API_BASE_URL:-/api}"

echo "   API_BASE_URL: $API_BASE_URL"

# Replace placeholder in index.html
# Only replace the value inside quotes to preserve variable name
INDEX_FILE="/usr/share/nginx/html/index.html"

if [ -f "$INDEX_FILE" ]; then
  sed -i "s|'__API_BASE_URL__'|'$API_BASE_URL'|g" "$INDEX_FILE"
  echo "✅ Configuration injected successfully"
else
  echo "⚠️  Warning: index.html not found at $INDEX_FILE"
fi

# Execute the main command
echo "🎵 Starting Nginx..."
exec "$@"
