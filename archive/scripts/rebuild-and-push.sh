#!/bin/bash

# Quick rebuild and push after code fix

set -e

IMAGE_NAME="iitrkp/dev-kubelens"
IMAGE_TAG="dev"

echo "=== Rebuilding and Pushing Fixed Image ==="
echo ""

# Use existing buildx builder
docker buildx use multiplatform 2>/dev/null || docker buildx create --name multiplatform --use
docker buildx inspect --bootstrap

echo "🔨 Building multi-platform image with fix..."
echo ""

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${IMAGE_NAME}:${IMAGE_TAG} \
  -t ${IMAGE_NAME}:latest \
  --push \
  .

echo ""
echo "✅ Fixed image pushed!"
echo ""
echo "Now pull the new image on your other system:"
echo "  docker pull ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "Or if using Kubernetes, restart the deployment:"
echo "  kubectl rollout restart deployment/log-browser -n apps-sbx-log-browser"

