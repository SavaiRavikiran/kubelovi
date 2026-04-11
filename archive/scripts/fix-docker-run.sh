#!/bin/bash

# Script to run kubelens with proper minikube mounts

set -e

echo "=== Fixing Docker Run for Minikube ==="
echo ""

# Stop existing container
if docker ps -a --format '{{.Names}}' | grep -q "^kubelens$"; then
    echo "🛑 Stopping existing kubelens container..."
    docker stop kubelens 2>/dev/null || true
    docker rm kubelens 2>/dev/null || true
fi

# Check if minikube directory exists
if [ ! -d "$HOME/.minikube" ]; then
    echo "⚠️  Minikube directory not found at $HOME/.minikube"
    echo "   The container will start but may not connect to minikube cluster."
    echo ""
    MINIKUBE_MOUNT=""
else
    echo "✅ Found minikube directory"
    MINIKUBE_MOUNT="-v $HOME/.minikube:/root/.minikube:ro"
fi

# Check if kubeconfig exists
if [ ! -f "$HOME/.kube/config" ]; then
    echo "⚠️  Kubeconfig not found at $HOME/.kube/config"
    echo "   The container will start but may not connect to Kubernetes."
    echo ""
    KUBECONFIG_MOUNT=""
else
    echo "✅ Found kubeconfig"
    KUBECONFIG_MOUNT="-v $HOME/.kube:/root/.kube:ro"
fi

echo ""
echo "🚀 Starting kubelens container with proper mounts..."
echo ""

# Build docker run command
DOCKER_RUN_CMD="docker run -d --name kubelens -p 8080:3006"

# Add mounts
if [ -n "$KUBECONFIG_MOUNT" ]; then
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD $KUBECONFIG_MOUNT"
fi

if [ -n "$MINIKUBE_MOUNT" ]; then
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD $MINIKUBE_MOUNT"
fi

# Add image
DOCKER_RUN_CMD="$DOCKER_RUN_CMD iitrkp/dev-kubelens:dev"

# Execute
echo "Command: $DOCKER_RUN_CMD"
echo ""
eval $DOCKER_RUN_CMD

# Wait a moment
sleep 2

# Check status
if docker ps --format '{{.Names}}' | grep -q "^kubelens$"; then
    echo ""
    echo "✅ Container started successfully!"
    echo ""
    echo "📊 Access the application at: http://localhost:8080"
    echo ""
    echo "📋 View logs:"
    echo "   docker logs -f kubelens"
    echo ""
    
    # Show recent logs
    echo "Recent logs:"
    echo "---"
    docker logs kubelens 2>&1 | tail -10
    echo "---"
else
    echo ""
    echo "❌ Container failed to start"
    echo "Check logs: docker logs kubelens"
    exit 1
fi

