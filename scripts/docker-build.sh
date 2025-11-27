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

echo "🔨 M3W Docker Build Script"
echo "=========================="
echo "   Build Target: $BUILD_TARGET"

# Step 1: Copy source files to isolated build directory (exclude node_modules)
echo ""
echo "📋 Step 1: Copying source files to /build..."
mkdir -p /build
cd /app

# Copy files using tar to exclude node_modules and dist
tar -c --exclude='node_modules' --exclude='dist' --exclude='.git' \
    -f - shared frontend backend scripts package.json package-lock.json | \
    tar -x -C /build -f -

cd /build

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

# Step 5: Copy output to /output directory
echo ""
echo "📤 Step 5: Copying build output..."

# Clean output directory
# Note: This runs inside a container with /output as a mounted volume.
# The container isolation ensures this is safe. If running outside container,
# ensure OUTPUT_DIR is properly set and validated.
rm -rf /output/*

# Note: shared package is bundled into backend via tsup noExternal config
# No need to copy shared separately

# Copy backend
mkdir -p /output/backend
cp -r /build/backend/dist /output/backend/
cp -r /build/backend/node_modules /output/backend/
cp -r /build/backend/prisma /output/backend/
cp /build/backend/package.json /output/backend/

# Copy frontend
mkdir -p /output/frontend
cp -r /build/frontend/dist /output/frontend/

# Copy docker entrypoint scripts
mkdir -p /output/docker
cp /app/docker/docker-entrypoint-allinone.sh /output/docker/ 2>/dev/null || true
cp /app/docker/docker-entrypoint-backend.sh /output/docker/ 2>/dev/null || true
cp /app/docker/docker-entrypoint-frontend.sh /output/docker/ 2>/dev/null || true
cp /app/docker/nginx.conf /output/docker/ 2>/dev/null || true

# Step 6: Report results
echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Output sizes:"
du -sh /output/backend/dist
du -sh /output/backend/node_modules
du -sh /output/frontend/dist

echo ""
echo "📁 Output location: docker-build-output/"
echo ""
echo "🐳 Ready to build Docker images with:"
echo "   Windows: .\\scripts\\build-docker.ps1 -Type prod -SkipArtifacts"
echo "   Linux:   ./scripts/build-docker.sh prod skip-artifacts"
