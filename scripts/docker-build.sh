#!/bin/sh
# Docker Build Script
# Builds all artifacts inside a Linux container for consistent cross-platform results
#
# This script runs INSIDE the container. It:
# 1. Copies source to /build (isolated from host node_modules)
# 2. Installs Linux dependencies and builds
# 3. Copies only dist and production node_modules back to /app/docker-build-output
#
# Usage (with docker or podman - image version from docker/.docker-version):
#   # Production build (default)
#   docker run --rm -v "${PWD}:/app:ro" -v "${PWD}/docker-build-output:/output" \
#     <NODE_IMAGE> sh /app/scripts/docker-build.sh
#
#   # RC build (includes demo mode code)
#   docker run --rm -v "${PWD}:/app:ro" -v "${PWD}/docker-build-output:/output" \
#     -e BUILD_TARGET=rc <NODE_IMAGE> sh /app/scripts/docker-build.sh
#
# Output (in docker-build-output/):
#   - backend/dist/          (compiled backend)
#   - backend/node_modules/  (Linux production dependencies with Prisma)
#   - backend/prisma/
#   - backend/package.json
#   - frontend/dist/         (compiled frontend)

set -e

# Build target: prod (default) or rc (includes demo mode)
BUILD_TARGET="${BUILD_TARGET:-prod}"

# Determine paths based on environment
# - In container: /app (source), /build (temp), /output (output)
# - In CI/host: current dir (source), ./build-temp (temp), ./docker-build-output (output)
if [ -d "/app" ] && [ -d "/output" ]; then
    # Running in container with mounted volumes
    SOURCE_DIR="/app"
    BUILD_DIR="/build"
    OUTPUT_DIR="/output"
else
    # Running directly on CI/host
    SOURCE_DIR="$(pwd)"
    BUILD_DIR="$(pwd)/build-temp"
    OUTPUT_DIR="$(pwd)/docker-build-output"
fi

echo "🔨 M3W Docker Build Script"
echo "=========================="
echo "   Build Target: $BUILD_TARGET"
echo "   Source Dir: $SOURCE_DIR"
echo "   Build Dir: $BUILD_DIR"
echo "   Output Dir: $OUTPUT_DIR"

# Step 1: Copy source files to isolated build directory (exclude node_modules)
echo ""
echo "📋 Step 1: Copying source files to $BUILD_DIR..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$SOURCE_DIR"

# Copy files using tar to exclude node_modules and dist
tar -c --exclude='node_modules' --exclude='dist' --exclude='.git' \
    -f - shared frontend backend scripts package.json package-lock.json | \
    tar -x -C "$BUILD_DIR" -f -

cd "$BUILD_DIR"

# Step 2: Install all dependencies
echo ""
echo "📦 Step 2: Installing dependencies..."

# Install root dependencies
npm ci

# Install shared package dependencies
cd shared && npm ci && cd ..

# Install frontend dependencies
cd frontend && npm ci && cd ..

# Install backend dependencies (full, for build)
cd backend && npm ci && cd ..

# Step 3: Build all packages
echo ""
echo "🔨 Step 3: Building application..."

# Build shared and frontend (same for all targets)
npm run build:shared
npm run build:frontend

# Build backend with target-specific config (affects demo mode tree-shaking)
cd backend
BUILD_TARGET=$BUILD_TARGET npm run build:$BUILD_TARGET
cd ..

# Step 4: Prepare backend production dependencies
echo ""
echo "📦 Step 4: Preparing backend production dependencies..."

cd backend

# Remove dev dependencies and reinstall production only
rm -rf node_modules
npm ci --omit=dev

# Generate Prisma client for Linux
npx prisma generate

# Clean up unnecessary packages after Prisma generation
echo "   Cleaning up unnecessary packages..."
rm -rf node_modules/typescript
rm -rf node_modules/@types
rm -rf node_modules/.cache

# Clean up Prisma runtime - remove unused database engines (keep only PostgreSQL)
# This saves ~50MB by removing MySQL, SQLite, CockroachDB, SQL Server WASM engines
echo "   Removing unused Prisma database engines..."
PRISMA_RUNTIME="node_modules/@prisma/client/runtime"
if [ -d "$PRISMA_RUNTIME" ]; then
  # Remove non-PostgreSQL WASM engines (each ~3MB)
  rm -f "$PRISMA_RUNTIME"/query_engine_bg.mysql.* 2>/dev/null || true
  rm -f "$PRISMA_RUNTIME"/query_engine_bg.sqlite.* 2>/dev/null || true
  rm -f "$PRISMA_RUNTIME"/query_engine_bg.cockroachdb.* 2>/dev/null || true
  rm -f "$PRISMA_RUNTIME"/query_engine_bg.sqlserver.* 2>/dev/null || true
  rm -f "$PRISMA_RUNTIME"/query_compiler_bg.mysql.* 2>/dev/null || true
  rm -f "$PRISMA_RUNTIME"/query_compiler_bg.sqlite.* 2>/dev/null || true
  rm -f "$PRISMA_RUNTIME"/query_compiler_bg.cockroachdb.* 2>/dev/null || true
  rm -f "$PRISMA_RUNTIME"/query_compiler_bg.sqlserver.* 2>/dev/null || true
  # Remove sourcemaps (not needed in production)
  rm -f "$PRISMA_RUNTIME"/*.map 2>/dev/null || true
  echo "   ✓ Prisma runtime cleaned (kept PostgreSQL only)"
fi

cd ..

# Step 5: Copy output to output directory
echo ""
echo "📤 Step 5: Copying build output..."

# Clean output directory
rm -rf "$OUTPUT_DIR"/*
mkdir -p "$OUTPUT_DIR"

# Note: shared package is bundled into backend via tsup noExternal config
# No need to copy shared separately

# Copy backend
mkdir -p "$OUTPUT_DIR/backend"
cp -r "$BUILD_DIR/backend/dist" "$OUTPUT_DIR/backend/"
cp -r "$BUILD_DIR/backend/node_modules" "$OUTPUT_DIR/backend/"
cp -r "$BUILD_DIR/backend/prisma" "$OUTPUT_DIR/backend/"
cp "$BUILD_DIR/backend/package.json" "$OUTPUT_DIR/backend/"

# Copy frontend
mkdir -p "$OUTPUT_DIR/frontend"
cp -r "$BUILD_DIR/frontend/dist" "$OUTPUT_DIR/frontend/"

# Copy docker entrypoint scripts
mkdir -p "$OUTPUT_DIR/docker"
cp "$SOURCE_DIR/docker/docker-entrypoint-allinone.sh" "$OUTPUT_DIR/docker/" 2>/dev/null || true
cp "$SOURCE_DIR/docker/docker-entrypoint-backend.sh" "$OUTPUT_DIR/docker/" 2>/dev/null || true
cp "$SOURCE_DIR/docker/docker-entrypoint-frontend.sh" "$OUTPUT_DIR/docker/" 2>/dev/null || true
cp "$SOURCE_DIR/docker/nginx.conf" "$OUTPUT_DIR/docker/" 2>/dev/null || true

# Clean up build directory if not in container (CI environment)
if [ "$BUILD_DIR" != "/build" ]; then
    echo "   Cleaning up temporary build directory..."
    rm -rf "$BUILD_DIR"
fi

# Step 6: Report results
echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Output sizes:"
du -sh "$OUTPUT_DIR/backend/dist"
du -sh "$OUTPUT_DIR/backend/node_modules"
du -sh "$OUTPUT_DIR/frontend/dist"

echo ""
echo "📁 Output location: docker-build-output/"
echo ""
echo "🐳 Ready to build Docker images with:"
echo "   Windows: .\\scripts\\build-docker.ps1 -Type prod -SkipArtifacts"
echo "   Linux:   ./scripts/build-docker.sh prod skip-artifacts"
