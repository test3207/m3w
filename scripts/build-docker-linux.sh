#!/bin/bash
# Docker Image Build Script for Linux/CI
# 
# This script:
# 1. Builds artifacts (can run directly on Linux or in container)
# 2. Builds Docker images from the artifacts
#
# Usage:
#   ./scripts/build-docker-linux.sh prod              # Production build
#   ./scripts/build-docker-linux.sh rc 1              # RC build (rc.1)
#   ./scripts/build-docker-linux.sh prod push         # Build and push
#   ./scripts/build-docker-linux.sh prod skip-artifacts  # Skip artifact build

set -e

# Arguments
TYPE="${1:-prod}"
ARG2="${2:-}"
ARG3="${3:-}"

# Parse flags
PUSH=false
SKIP_ARTIFACTS=false
RC_NUMBER=1

case "$TYPE" in
    rc)
        if [[ "$ARG2" =~ ^[0-9]+$ ]]; then
            RC_NUMBER="$ARG2"
            [[ "$ARG3" == "push" ]] && PUSH=true
            [[ "$ARG3" == "skip-artifacts" ]] && SKIP_ARTIFACTS=true
        else
            [[ "$ARG2" == "push" ]] && PUSH=true
            [[ "$ARG2" == "skip-artifacts" ]] && SKIP_ARTIFACTS=true
        fi
        ;;
    prod)
        [[ "$ARG2" == "push" ]] && PUSH=true
        [[ "$ARG2" == "skip-artifacts" ]] && SKIP_ARTIFACTS=true
        [[ "$ARG3" == "push" ]] && PUSH=true
        ;;
    *)
        echo "Usage: $0 <prod|rc> [rc-number] [push|skip-artifacts]"
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

echo ""
echo "✨ Done!"
echo ""
