#!/bin/bash

# Universal Docker Run Script for Kubernetes Log Viewer
# This script automatically detects and mounts the appropriate kubeconfig
# Works on any system (Linux, Mac, Windows with WSL)

set -e

echo "=== Kubernetes Log Viewer - Universal Deployment ==="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Stop and remove existing container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^kubelens$"; then
    echo "🛑 Stopping and removing existing kubelens container..."
    docker stop kubelens 2>/dev/null || true
    docker rm kubelens 2>/dev/null || true
fi

# Build the image
echo "🔨 Building Docker image..."
docker build -t kubelens:latest .

# Detect kubeconfig location
KUBECONFIG_PATH=""
MINIKUBE_PATH=""

# Check common kubeconfig locations
if [ -n "$KUBECONFIG" ]; then
    # Use KUBECONFIG environment variable if set
    KUBECONFIG_PATH="$KUBECONFIG"
    echo "✅ Using KUBECONFIG environment variable: $KUBECONFIG"
elif [ -f "$HOME/.kube/config" ]; then
    # Use default kubeconfig location
    KUBECONFIG_PATH="$HOME/.kube"
    echo "✅ Found kubeconfig at: $HOME/.kube/config"
elif [ -f "/root/.kube/config" ]; then
    # Try root location (for sudo scenarios)
    KUBECONFIG_PATH="/root/.kube"
    echo "✅ Found kubeconfig at: /root/.kube/config"
else
    echo "⚠️  No kubeconfig found in standard locations"
    echo "   The container will start but may not connect to Kubernetes."
    echo "   You can provide kubeconfig later by mounting it."
fi

# Check for minikube (optional)
if [ -d "$HOME/.minikube" ]; then
    MINIKUBE_PATH="$HOME/.minikube"
    echo "✅ Found minikube directory at: $HOME/.minikube"
elif [ -d "/root/.minikube" ]; then
    MINIKUBE_PATH="/root/.minikube"
    echo "✅ Found minikube directory at: /root/.minikube"
else
    echo "ℹ️  Minikube directory not found (optional - only needed for local minikube clusters)"
fi

# Build docker run command
echo ""
echo "🚀 Starting container..."

DOCKER_RUN_CMD="docker run -d --name kubelens -p 8081:3006"

# Add kubeconfig mount if found
if [ -n "$KUBECONFIG_PATH" ]; then
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD -v $KUBECONFIG_PATH:/root/.kube:ro"
fi

# Add minikube mount if found (optional)
if [ -n "$MINIKUBE_PATH" ]; then
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD -v $MINIKUBE_PATH:/root/.minikube:ro"
fi

# Add image name
DOCKER_RUN_CMD="$DOCKER_RUN_CMD kubelens:latest"

# Execute the command
echo "Command: $DOCKER_RUN_CMD"
echo ""
eval $DOCKER_RUN_CMD

# Wait a moment for container to start
sleep 2

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "^kubelens$"; then
    echo ""
    echo "✅ Container started successfully!"
    echo ""
    echo "📊 Application is running at: http://localhost:8081"
    echo ""
    echo "📝 To view logs:"
    echo "   docker logs -f kubelens"
    echo ""
    echo "🛑 To stop:"
    echo "   docker stop kubelens && docker rm kubelens"
    echo ""
    echo "🔍 To check container status:"
    echo "   docker ps | grep kubelens"
    echo ""
    
    # Show recent logs
    echo "📋 Recent container logs:"
    echo "---"
    docker logs kubelens 2>&1 | tail -20
    echo "---"
else
    echo ""
    echo "❌ Container failed to start. Check logs with:"
    echo "   docker logs kubelens"
    exit 1
fi

