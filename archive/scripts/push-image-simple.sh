#!/bin/bash
# Simple script to build and push multi-platform image

set -e

IMAGE_NAME="iitrkp/dev-kubelens"
IMAGE_TAG="dev"

echo "=== Building and Pushing Multi-Platform Image ==="
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
  -t ${IMAGE_NAME}:latest \
  --push \
  .

echo ""
echo "✅ Successfully pushed!"
echo ""
echo "Now restart the deployment:"
echo "  kubectl delete pod -n apps-sbx-log-browser -l app=log-browser"
