#!/bin/bash
# Script to run the QA kubelens container with proper volume mounts

set -e

CONTAINER_NAME="qa-kubelens"
IMAGE_NAME="iitrkp/dev-kubelens:qa"
PORT="8089"

echo "=== Running QA Kubelens Container ==="
echo ""

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "⚠️  Container ${CONTAINER_NAME} already exists"
    read -p "Do you want to stop and remove it? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker stop ${CONTAINER_NAME} 2>/dev/null || true
        docker rm ${CONTAINER_NAME} 2>/dev/null || true
        echo "✅ Container removed"
    else
        echo "Exiting. Please remove the container manually first."
        exit 1
    fi
fi

# Check if kubeconfig exists
if [ ! -f ~/.kube/config ]; then
    echo "⚠️  Warning: ~/.kube/config not found"
    echo "   The container may not be able to connect to Kubernetes"
fi

# Check if minikube directory exists
if [ ! -d ~/.minikube ]; then
    echo "⚠️  Warning: ~/.minikube directory not found"
    echo "   Minikube contexts may not work properly"
fi

echo ""
echo "🚀 Starting container with volume mounts..."
echo "   Container name: ${CONTAINER_NAME}"
echo "   Image: ${IMAGE_NAME}"
echo "   Port: ${PORT}:3006"
echo "   Mounts:"
echo "     - ~/.kube -> /root/.kube:ro"
echo "     - ~/.minikube -> /root/.minikube:ro"
echo ""

# Run the container
docker run -d \
  --name ${CONTAINER_NAME} \
  -p ${PORT}:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  ${IMAGE_NAME}

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Container started successfully!"
    echo ""
    echo "📋 Container info:"
    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "📝 View logs:"
    echo "   docker logs -f ${CONTAINER_NAME}"
    echo ""
    echo "🌐 Access the application:"
    echo "   http://localhost:${PORT}"
    echo ""
    echo "🔍 Verify mounts:"
    echo "   docker exec ${CONTAINER_NAME} ls -la /root/.kube/"
    echo "   docker exec ${CONTAINER_NAME} ls -la /root/.minikube/"
else
    echo ""
    echo "❌ Failed to start container"
    exit 1
fi

