#!/bin/sh
# Create Release Archives Script
#
# Creates tar.gz and zip archives from docker-build-output/ directory
# for distribution via GitHub Releases.
#
# Usage:
#   ./scripts/create-archives.sh <version>
#   ./scripts/create-archives.sh v0.1.0-rc.1
#
# Output (in project root):
#   - m3w-<version>.tar.gz          (All-in-One)
#   - m3w-<version>.zip
#   - m3w-backend-<version>.tar.gz  (Backend only)
#   - m3w-backend-<version>.zip
#   - m3w-frontend-<version>.tar.gz (Frontend only)
#   - m3w-frontend-<version>.zip

set -e

# Arguments
VERSION="${1:-}"

if [ -z "$VERSION" ]; then
    echo "❌ Error: Version argument required"
    echo "   Usage: $0 <version>"
    echo "   Example: $0 v0.1.0-rc.1"
    exit 1
fi

# Determine project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/docker-build-output"

echo ""
echo "📦 Creating Release Archives"
echo "============================"
echo "   Version: $VERSION"
echo "   Source:  $OUTPUT_DIR"
echo ""

# Verify output directory exists
if [ ! -d "$OUTPUT_DIR" ]; then
    echo "❌ Error: docker-build-output/ directory not found"
    echo "   Run build-docker.sh first to create build artifacts"
    exit 1
fi

# Verify required directories exist
if [ ! -d "$OUTPUT_DIR/backend" ]; then
    echo "❌ Error: backend/ not found in docker-build-output/"
    exit 1
fi

if [ ! -d "$OUTPUT_DIR/frontend" ]; then
    echo "❌ Error: frontend/ not found in docker-build-output/"
    exit 1
fi

# Create archives
cd "$OUTPUT_DIR"

echo "📁 Creating AIO archives..."
tar -czvf "$PROJECT_ROOT/m3w-${VERSION}.tar.gz" .
zip -r "$PROJECT_ROOT/m3w-${VERSION}.zip" .

echo ""
echo "📁 Creating Backend archives..."
tar -czvf "$PROJECT_ROOT/m3w-backend-${VERSION}.tar.gz" backend/
zip -r "$PROJECT_ROOT/m3w-backend-${VERSION}.zip" backend/

echo ""
echo "📁 Creating Frontend archives..."
tar -czvf "$PROJECT_ROOT/m3w-frontend-${VERSION}.tar.gz" frontend/
zip -r "$PROJECT_ROOT/m3w-frontend-${VERSION}.zip" frontend/

cd "$PROJECT_ROOT"

echo ""
echo "✅ Archives created successfully!"
echo ""
echo "📊 Archive sizes:"
ls -lh "$PROJECT_ROOT"/m3w-*.tar.gz "$PROJECT_ROOT"/m3w-*.zip 2>/dev/null | awk '{print "   " $9 ": " $5}'

echo ""
echo "📋 Files created:"
for f in m3w-${VERSION}.tar.gz m3w-${VERSION}.zip \
         m3w-backend-${VERSION}.tar.gz m3w-backend-${VERSION}.zip \
         m3w-frontend-${VERSION}.tar.gz m3w-frontend-${VERSION}.zip; do
    if [ -f "$PROJECT_ROOT/$f" ]; then
        echo "   ✓ $f"
    else
        echo "   ✗ $f (missing)"
    fi
done
