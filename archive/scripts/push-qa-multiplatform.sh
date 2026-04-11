#!/bin/bash
# Script to build and push multi-platform image with qa tag

set -e

IMAGE_NAME="iitrkp/dev-kubelens"
IMAGE_TAG="qa"

echo "=== Building and Pushing Multi-Platform Image ==="
echo ""
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Platforms: linux/amd64, linux/arm64"
echo ""

# Check if buildx exists
if ! docker buildx version &>/dev/null; then
    echo "❌ Docker buildx not available"
    echo "Please enable buildx or update Docker Desktop"
    exit 1
fi

echo "✅ Docker buildx available"
echo ""

# Create builder if it doesn't exist
echo "🔧 Setting up buildx builder..."
docker buildx create --name multiplatform --use 2>/dev/null || docker buildx use multiplatform
docker buildx inspect --bootstrap

echo ""
echo "🔨 Building for linux/amd64 and linux/arm64..."
echo "   This will take 5-10 minutes..."
echo ""

# Build and push
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${IMAGE_NAME}:${IMAGE_TAG} \
  --push \
  .

echo ""
echo "✅ Successfully pushed ${IMAGE_NAME}:${IMAGE_TAG}!"
echo ""
echo "The image is now available for both linux/amd64 and linux/arm64 platforms."
echo ""
echo "To pull on another system:"
echo "  docker pull ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "To run on another system:"
echo "  docker run -d --name kubelens -p 8089:3006 \\"
echo "    -v ~/.kube:/root/.kube:ro \\"
echo "    -v ~/.minikube:/root/.minikube:ro \\"
echo "    ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

