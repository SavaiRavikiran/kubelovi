#!/bin/bash

# Fix image pull issue by building and pushing multi-platform image

set -e

IMAGE_NAME="iitrkp/dev-kubelens"
IMAGE_TAG="dev"

echo "=== Fixing Image Pull Issue ==="
echo ""

# Check Docker login - try to pull a test image or check config
if ! docker pull hello-world:latest &>/dev/null 2>&1 && ! test -f ~/.docker/config.json; then
    echo "⚠️  Cannot verify Docker Hub login"
    echo "Attempting to continue - if push fails, run: docker login"
    echo ""
else
    echo "✅ Docker login verified"
    echo ""
fi

# Check if buildx is available
if ! docker buildx version &>/dev/null; then
    echo "⚠️  Docker buildx not available, using regular build"
    echo "Building single-platform image..."
    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
    docker push ${IMAGE_NAME}:${IMAGE_TAG}
    echo ""
    echo "✅ Image pushed (single platform)"
    echo "⚠️  If cluster is different architecture, use buildx for multi-platform"
    exit 0
fi

echo "🔧 Setting up multi-platform builder..."
docker buildx create --name multiplatform --use 2>/dev/null || docker buildx use multiplatform
docker buildx inspect --bootstrap

echo ""
echo "🔨 Building and pushing multi-platform image..."
echo "   Platforms: linux/amd64, linux/arm64"
echo "   This may take 5-10 minutes..."
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
echo "Now delete the pod to force a new pull:"
echo "  kubectl delete pod -n apps-sbx-log-browser -l app=log-browser"
echo ""
echo "Or restart the deployment:"
echo "  kubectl rollout restart deployment/log-browser -n apps-sbx-log-browser"

