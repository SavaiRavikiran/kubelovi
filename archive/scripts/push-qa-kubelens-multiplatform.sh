#!/bin/bash
# Script to build and push multi-platform image for qa-kubelens:qa

# Don't use set -e since we handle errors manually with retries

IMAGE_NAME="iitrkp/qa-kubelens"
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

# Check Docker Hub authentication
echo "🔐 Checking Docker Hub authentication..."
if ! docker info | grep -q "Username"; then
  echo "⚠️  Warning: Not logged into Docker Hub"
  echo "   Run: docker login"
  echo "   Or the push may fail"
  echo ""
fi

echo ""
echo "🔨 Building and pushing for linux/amd64 and linux/arm64..."
echo "   This will take 5-10 minutes..."
echo ""

# Retry logic for push (sometimes Docker Hub has transient errors)
MAX_RETRIES=3
RETRY_COUNT=0
SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$SUCCESS" = false ]; do
  if [ $RETRY_COUNT -gt 0 ]; then
    echo ""
    echo "🔄 Retry attempt $RETRY_COUNT of $MAX_RETRIES..."
    sleep 5
  fi
  
  # Build and push (multi-platform requires --push)
  if docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t ${IMAGE_NAME}:${IMAGE_TAG} \
    --push \
    . 2>&1 | tee /tmp/docker-build.log; then
    SUCCESS=true
    echo ""
    echo "✅ Build and push successful!"
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo ""
      echo "⚠️  Push failed, will retry..."
      # Check if it's an auth issue
      if grep -q "unauthorized\|authentication" /tmp/docker-build.log 2>/dev/null; then
        echo "❌ Authentication error detected"
        echo "   Please run: docker login"
        exit 1
      fi
    fi
  fi
done

if [ "$SUCCESS" = false ]; then
  echo ""
  echo "⚠️  Combined push failed. Trying to push platforms separately..."
  echo ""
  
  # Try pushing platforms one at a time
  for platform in linux/amd64 linux/arm64; do
    echo "Pushing ${platform}..."
    if docker buildx build \
      --platform ${platform} \
      -t ${IMAGE_NAME}:${IMAGE_TAG}-$(echo ${platform} | tr '/' '-') \
      --push \
      .; then
      echo "✅ ${platform} pushed successfully"
    else
      echo "❌ Failed to push ${platform}"
    fi
  done
  
  echo ""
  echo "⚠️  Note: Images pushed with platform suffix"
  echo "   Use: docker pull ${IMAGE_NAME}:${IMAGE_TAG}-linux-amd64"
  echo "   Or: docker pull ${IMAGE_NAME}:${IMAGE_TAG}-linux-arm64"
  exit 1
fi

echo ""
echo "✅ Successfully pushed ${IMAGE_NAME}:${IMAGE_TAG}!"
echo ""
echo "The image is now available for both linux/amd64 and linux/arm64 platforms."
echo ""
echo "To pull on another system:"
echo "  docker pull ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "To use in Kubernetes deployment:"
echo "  Update your deployment YAML:"
echo "    image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

