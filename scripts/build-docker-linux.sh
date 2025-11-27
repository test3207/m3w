#!/bin/bash
# Docker Image Build Script for Linux/CI
# 
# This script:
# 1. Builds artifacts (can run directly on Linux or in container)
# 2. Builds Docker images from the artifacts
# 3. Optionally tests the built images
#
# Usage:
#   ./scripts/build-docker-linux.sh prod              # Production build
#   ./scripts/build-docker-linux.sh rc 1              # RC build (rc.1)
#   ./scripts/build-docker-linux.sh prod push         # Build and push
#   ./scripts/build-docker-linux.sh prod test         # Build and test AIO image
#   ./scripts/build-docker-linux.sh prod skip-artifacts  # Skip artifact build

set -e

# Arguments
TYPE="${1:-prod}"
ARG2="${2:-}"
ARG3="${3:-}"

# Parse flags
PUSH=false
TEST=false
SKIP_ARTIFACTS=false
RC_NUMBER=1

case "$TYPE" in
    rc)
        if [[ "$ARG2" =~ ^[0-9]+$ ]]; then
            RC_NUMBER="$ARG2"
            [[ "$ARG3" == "push" ]] && PUSH=true
            [[ "$ARG3" == "test" ]] && TEST=true
            [[ "$ARG3" == "skip-artifacts" ]] && SKIP_ARTIFACTS=true
        else
            [[ "$ARG2" == "push" ]] && PUSH=true
            [[ "$ARG2" == "test" ]] && TEST=true
            [[ "$ARG2" == "skip-artifacts" ]] && SKIP_ARTIFACTS=true
        fi
        ;;
    prod)
        [[ "$ARG2" == "push" ]] && PUSH=true
        [[ "$ARG2" == "test" ]] && TEST=true
        [[ "$ARG2" == "skip-artifacts" ]] && SKIP_ARTIFACTS=true
        [[ "$ARG3" == "push" ]] && PUSH=true
        [[ "$ARG3" == "test" ]] && TEST=true
        ;;
    *)
        echo "Usage: $0 <prod|rc> [rc-number] [push|test|skip-artifacts]"
        exit 1
        ;;
esac

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/docker-build-output"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/test3207}"

# Read version from package.json
BASE_VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")

# Build version string and tags
if [[ "$TYPE" == "rc" ]]; then
    VERSION="v${BASE_VERSION}-rc.${RC_NUMBER}"
    ADDITIONAL_TAGS=("rc")
else
    VERSION="v${BASE_VERSION}"
    MINOR_VERSION=$(echo "$BASE_VERSION" | sed 's/\.[0-9]*$//')
    MAJOR_VERSION=$(echo "$BASE_VERSION" | sed 's/\.[0-9]*\.[0-9]*$//')
    ADDITIONAL_TAGS=("v${MINOR_VERSION}" "v${MAJOR_VERSION}" "latest")
fi

ALL_TAGS=("$VERSION" "${ADDITIONAL_TAGS[@]}")

echo ""
echo "========================================"
echo "  M3W Docker Build Script (Linux/CI)"
echo "========================================"
echo ""
echo "  Version:  $VERSION"
echo "  Type:     $TYPE"
echo "  Registry: $REGISTRY"
echo ""

# ============================================
# Step 1: Build artifacts
# ============================================
if [[ "$SKIP_ARTIFACTS" == "false" ]]; then
    echo "📦 Step 1: Building artifacts..."
    echo ""
    
    # Clean output directory
    rm -rf "$OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
    
    # Check if we're already in a container (CI) or need to spawn one
    if [[ -f /.dockerenv ]] || [[ -n "$CI" ]]; then
        # Running in container or CI - build directly
        echo "   Running build directly (CI/container environment)..."
        cd "$PROJECT_ROOT"
        
        # Run the build script
        sh "$PROJECT_ROOT/scripts/docker-build.sh"
    else
        # Running on host - use container for consistency
        echo "   Running build in container..."
        
        docker run --rm \
            -v "$PROJECT_ROOT:/app:ro" \
            -v "$OUTPUT_DIR:/output" \
            node:25.2.1-alpine \
            sh -c "mkdir -p /build && sh /app/scripts/docker-build.sh"
    fi
    
    if [[ $? -ne 0 ]]; then
        echo "❌ Artifact build failed!"
        exit 1
    fi
    
    echo ""
    echo "✅ Artifacts built successfully"
    echo ""
else
    echo "⏭️  Skipping artifact build (skip-artifacts)"
    echo ""
    
    if [[ ! -d "$OUTPUT_DIR" ]]; then
        echo "❌ Output directory not found: $OUTPUT_DIR"
        echo "   Run without skip-artifacts first"
        exit 1
    fi
fi

# ============================================
# Step 2: Build Docker images
# ============================================
echo "🐳 Step 2: Building Docker images..."
echo ""

# Function to build image with tags
build_image() {
    local name="$1"
    local dockerfile="$2"
    
    echo "  Building $name..."
    
    local tag_args=""
    for tag in "${ALL_TAGS[@]}"; do
        tag_args="$tag_args -t ${REGISTRY}/${name}:${tag}"
    done
    
    docker build $tag_args -f "$PROJECT_ROOT/$dockerfile" "$OUTPUT_DIR"
    
    if [[ $? -ne 0 ]]; then
        echo "❌ Failed to build $name"
        exit 1
    fi
    
    echo "  ✅ $name built"
}

# Build all images
build_image "m3w" "docker/Dockerfile"
build_image "m3w-backend" "docker/Dockerfile.backend"
build_image "m3w-frontend" "docker/Dockerfile.frontend"

echo ""
echo "✅ All images built successfully"

# ============================================
# Step 3: Show results
# ============================================
echo ""
echo "========================================"
echo "  Build Results"
echo "========================================"
echo ""

echo "📊 Image sizes:"
docker images --filter "reference=${REGISTRY}/m3w*" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | head -12

echo ""
echo "📋 Built tags:"
for img in m3w m3w-backend m3w-frontend; do
    echo "  ${REGISTRY}/${img}: ${ALL_TAGS[*]}"
done

# ============================================
# Step 4: Push (optional)
# ============================================
if [[ "$PUSH" == "true" ]]; then
    echo ""
    echo "🚀 Pushing images to registry..."
    echo ""
    
    for img in m3w m3w-backend m3w-frontend; do
        for tag in "${ALL_TAGS[@]}"; do
            echo "  Pushing ${REGISTRY}/${img}:${tag}..."
            docker push "${REGISTRY}/${img}:${tag}"
            if [[ $? -ne 0 ]]; then
                echo "❌ Failed to push ${img}:${tag}"
                exit 1
            fi
        done
    done
    
    echo ""
    echo "✅ All images pushed"
else
    echo ""
    echo "💡 To push: $0 $TYPE push"
fi

# ============================================
# Step 5: Test (optional)
# ============================================
if [[ "$TEST" == "true" ]]; then
    echo ""
    echo "========================================"
    echo "  Testing AIO Image"
    echo "========================================"
    echo ""
    
    # Check prerequisites
    ENV_DOCKER_FILE="$PROJECT_ROOT/backend/.env.docker"
    if [[ ! -f "$ENV_DOCKER_FILE" ]]; then
        echo "⚠️  backend/.env.docker not found"
        
        ENV_FILE="$PROJECT_ROOT/backend/.env"
        ENV_EXAMPLE="$PROJECT_ROOT/backend/.env.docker.example"
        
        if [[ -f "$ENV_FILE" ]]; then
            echo "   Creating from backend/.env..."
            # Copy from .env and update endpoints for Docker network
            sed -e 's|DATABASE_URL=postgresql://[^@]*@localhost:|DATABASE_URL=postgresql://postgres:postgres@m3w-postgres:|' \
                -e 's|MINIO_ENDPOINT=localhost|MINIO_ENDPOINT=m3w-minio|' \
                -e 's|CORS_ORIGIN=http://localhost:3000|CORS_ORIGIN=http://localhost:4000|' \
                "$ENV_FILE" > "$ENV_DOCKER_FILE"
            echo "   ✅ Created with Docker network settings"
        elif [[ -f "$ENV_EXAMPLE" ]]; then
            echo "   Creating from .env.docker.example..."
            cp "$ENV_EXAMPLE" "$ENV_DOCKER_FILE"
            echo "   ✅ Created from template"
            echo "   ⚠️  Please update GitHub OAuth credentials in backend/.env.docker"
        else
            echo "❌ Neither .env nor .env.docker.example found"
            exit 1
        fi
    fi
    
    # Check if m3w_default network exists
    if ! docker network ls --format "{{.Name}}" | grep -q "^m3w_default$"; then
        echo "⚠️  Docker network 'm3w_default' not found"
        echo "   Starting PostgreSQL and MinIO with docker-compose..."
        
        cd "$PROJECT_ROOT"
        docker-compose up -d
        sleep 5
    fi
    
    # Stop existing test container
    if docker ps -a --format "{{.Names}}" | grep -q "^m3w-test$"; then
        echo "   Stopping existing test container..."
        docker stop m3w-test 2>/dev/null || true
        docker rm m3w-test 2>/dev/null || true
    fi
    
    # Start test container using docker-compose.test.yml
    echo ""
    echo "🚀 Starting AIO container..."
    
    export M3W_IMAGE="${REGISTRY}/m3w:${VERSION}"
    
    cd "$PROJECT_ROOT"
    docker-compose -f docker/docker-compose.test.yml up -d
    
    if [[ $? -ne 0 ]]; then
        echo "❌ Failed to start test container"
        exit 1
    fi
    
    # Wait for container to be ready
    echo "   Waiting for container to be ready..."
    sleep 5
    
    # Health check
    echo ""
    echo "🔍 Running health checks..."
    
    MAX_RETRIES=10
    RETRY_COUNT=0
    HEALTHY=false
    
    while [[ $RETRY_COUNT -lt $MAX_RETRIES ]] && [[ "$HEALTHY" == "false" ]]; do
        if curl -s -f "http://localhost:4000/api/health" > /dev/null 2>&1; then
            HEALTHY=true
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; then
                echo "   Retry $RETRY_COUNT/$MAX_RETRIES..."
                sleep 2
            fi
        fi
    done
    
    if [[ "$HEALTHY" == "true" ]]; then
        echo "   ✅ API health check passed"
        
        # Test frontend
        if curl -s "http://localhost:4000/" | grep -q "<!DOCTYPE html>"; then
            echo "   ✅ Frontend serving correctly"
        else
            echo "   ⚠️  Frontend check failed"
        fi
        
        echo ""
        echo "========================================"
        echo "  Test Passed! 🎉"
        echo "========================================"
        echo ""
        echo "  AIO container running at: http://localhost:4000"
        echo ""
        echo "  Commands:"
        echo "    View logs:  docker logs -f m3w-test"
        echo "    Stop:       docker-compose -f docker/docker-compose.test.yml down"
        echo ""
    else
        echo "   ❌ Health check failed after $MAX_RETRIES retries"
        echo ""
        echo "   Container logs:"
        docker logs m3w-test 2>&1 | tail -30
        exit 1
    fi
fi

echo ""
echo "✨ Done!"
echo ""
