#!/bin/bash

# Script to build and push KubeLens image to Docker Hub

set -e

IMAGE_NAME="iitrkp/dev-kubelens"
IMAGE_TAG="dev"

echo "=== Building and Pushing KubeLens to Docker Hub ==="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if logged into Docker Hub
if ! docker info | grep -q "Username"; then
    echo "⚠️  Not logged into Docker Hub"
    echo "Please login first:"
    echo "  docker login"
    echo ""
    read -p "Press Enter after logging in, or Ctrl+C to cancel..."
fi

# Build the image
echo "🔨 Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# Also tag as latest (optional)
echo "🏷️  Tagging as latest..."
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest

# Push the image
echo "📤 Pushing ${IMAGE_NAME}:${IMAGE_TAG} to Docker Hub..."
docker push ${IMAGE_NAME}:${IMAGE_TAG}

echo "📤 Pushing ${IMAGE_NAME}:latest to Docker Hub..."
docker push ${IMAGE_NAME}:latest

echo ""
echo "✅ Successfully pushed to Docker Hub!"
echo ""
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Image: ${IMAGE_NAME}:latest"
echo ""
echo "You can now use this image in your Kubernetes deployment:"
echo "  image: ${IMAGE_NAME}:${IMAGE_TAG}"

