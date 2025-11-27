#!/bin/sh
# Docker Build Script
# Builds all artifacts inside a Linux container for consistent cross-platform results
#
# This script runs INSIDE the container. It:
# 1. Copies source to /build (isolated from host node_modules)
# 2. Installs Linux dependencies and builds
# 3. Copies only dist and production node_modules back to /app/docker-build-output
#
# Usage:
#   podman run --rm -v "${PWD}:/app:ro" -v "${PWD}/docker-build-output:/output" \
#     -w /build node:25.2.1-alpine sh /app/scripts/docker-build.sh
#
# Output (in docker-build-output/):
#   - shared/dist/           (compiled shared package)
#   - shared/package.json
#   - backend/dist/          (compiled backend)
#   - backend/node_modules/  (Linux production dependencies)
#   - backend/prisma/
#   - backend/package.json
#   - frontend/dist/         (compiled frontend)

set -e

echo "🔨 M3W Docker Build Script"
echo "=========================="

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
npm run build

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
rm -rf node_modules/prisma
rm -rf node_modules/typescript
rm -rf node_modules/@types
rm -rf node_modules/effect
rm -rf node_modules/fast-check
rm -rf node_modules/.cache

cd ..

# Step 5: Copy output to /output directory
echo ""
echo "📤 Step 5: Copying build output..."

# Clean output directory
rm -rf /output/*

# Copy shared
mkdir -p /output/shared
cp -r /build/shared/dist /output/shared/
cp /build/shared/package.json /output/shared/

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
cp /app/docker/docker-entrypoint-frontend.sh /output/docker/ 2>/dev/null || true
cp /app/docker/nginx.conf /output/docker/ 2>/dev/null || true

# Step 6: Report results
echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Output sizes:"
du -sh /output/shared/dist
du -sh /output/backend/dist
du -sh /output/backend/node_modules
du -sh /output/frontend/dist

echo ""
echo "📁 Output location: docker-build-output/"
echo ""
echo "🐳 Ready to build Docker images with:"
echo "   Windows: .\\scripts\\build-docker.ps1 -Type prod -SkipArtifacts"
echo "   Linux:   ./scripts/build-docker-linux.sh prod skip-artifacts"
