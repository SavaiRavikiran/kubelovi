#!/bin/bash

# Build and push multi-platform Docker image
# This ensures the image works on both AMD64 and ARM64 clusters

set -e

IMAGE_NAME="iitrkp/dev-kubelens"
IMAGE_TAG="dev"

echo "=== Building Multi-Platform Docker Image ==="
echo ""

# Check if logged into Docker Hub
if ! docker info 2>/dev/null | grep -q "Username"; then
    echo "⚠️  Not logged into Docker Hub"
    echo "Please login first:"
    echo "  docker login"
    exit 1
fi

echo "✅ Logged into Docker Hub"
echo ""

# Check if buildx is available
if ! docker buildx version &>/dev/null; then
    echo "❌ Docker buildx not available"
    echo "Please enable buildx or update Docker"
    exit 1
fi

# Create and use buildx builder
echo "🔧 Setting up buildx builder..."
docker buildx create --name multiplatform-builder --use 2>/dev/null || true
docker buildx use multiplatform-builder
docker buildx inspect --bootstrap

echo ""
echo "🔨 Building for multiple platforms (linux/amd64, linux/arm64)..."
echo "   This may take several minutes..."
echo ""

# Build and push for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${IMAGE_NAME}:${IMAGE_TAG} \
  -t ${IMAGE_NAME}:latest \
  --push \
  .

echo ""
echo "✅ Successfully built and pushed multi-platform image!"
echo ""
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Platforms: linux/amd64, linux/arm64"
echo ""
echo "The image will now work on both AMD64 and ARM64 Kubernetes clusters."

