#!/bin/bash
# Script to tag and push the current kubelens:latest image as dev-kubelens:qa

set -e

SOURCE_IMAGE="kubelens:latest"
TARGET_IMAGE="dev-kubelens:qa"

echo "=== Tagging and Pushing Image ==="
echo ""
echo "Source: ${SOURCE_IMAGE}"
echo "Target: ${TARGET_IMAGE}"
echo ""

# Check if source image exists
if ! docker images ${SOURCE_IMAGE} | grep -q kubelens; then
    echo "❌ Error: Source image ${SOURCE_IMAGE} not found"
    exit 1
fi

# Tag the image
echo "📦 Tagging image..."
docker tag ${SOURCE_IMAGE} ${TARGET_IMAGE}

echo "✅ Image tagged successfully"
echo ""

# Check if user is logged into Docker Hub
if ! docker info | grep -q "Username"; then
    echo "⚠️  Warning: Not logged into Docker Hub"
    echo "   You may need to run: docker login"
    echo ""
fi

# Ask for confirmation
read -p "Do you want to push to Docker Hub now? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Push cancelled. Image is tagged locally as ${TARGET_IMAGE}"
    echo ""
    echo "To push manually later, run:"
    echo "  docker push ${TARGET_IMAGE}"
    exit 0
fi

# Push the image
echo ""
echo "🚀 Pushing image to registry..."
docker push ${TARGET_IMAGE}

echo ""
echo "✅ Successfully pushed ${TARGET_IMAGE}!"
echo ""
echo "To pull this image on another system, run:"
echo "  docker pull ${TARGET_IMAGE}"
echo ""

