#!/bin/bash
# Quick script to push to Docker Hub

echo "=== Docker Hub Push Script ==="
echo ""

# Check if logged in
if ! docker info 2>/dev/null | grep -q "Username"; then
    echo "❌ Not logged into Docker Hub"
    echo ""
    echo "Please login first:"
    echo "  docker login"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ Logged into Docker Hub"
echo ""

# Check if image exists
if ! docker images | grep -q "iitrkp/dev-kubelens.*dev"; then
    echo "Building image..."
    docker build -t iitrkp/dev-kubelens:dev .
fi

echo "📤 Pushing iitrkp/dev-kubelens:dev to Docker Hub..."
if docker push iitrkp/dev-kubelens:dev; then
    echo ""
    echo "✅ Successfully pushed!"
    echo ""
    echo "Image URL: https://hub.docker.com/r/iitrkp/dev-kubelens"
    echo ""
    echo "You can now use this in Kubernetes:"
    echo "  image: iitrkp/dev-kubelens:dev"
else
    echo ""
    echo "❌ Push failed!"
    echo ""
    echo "Common issues:"
    echo "1. Repository doesn't exist - Create it at https://hub.docker.com/"
    echo "2. Not logged in - Run 'docker login'"
    echo "3. Wrong permissions - Make sure you own the repository"
    exit 1
fi
