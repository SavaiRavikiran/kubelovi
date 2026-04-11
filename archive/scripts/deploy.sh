#!/bin/bash

# Kubernetes Log Viewer - Quick Deploy Script
# This script helps you quickly deploy the application with Docker

set -e

echo "=== Kubernetes Log Viewer - Deployment Script ==="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  docker-compose not found. Using docker-compose plugin or docker compose..."
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Check if kubeconfig exists
if [ -f "$HOME/.kube/config" ]; then
    echo "✅ Found kubeconfig at: $HOME/.kube/config"
else
    echo "⚠️  Kubeconfig not found at: $HOME/.kube/config"
    echo "   The application will still start, but you may need to provide kubeconfig manually."
fi

echo ""
echo "Building and starting containers..."
echo ""

# Build and start
$COMPOSE_CMD up -d --build

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Application is running at: http://localhost:8081"
echo ""
echo "To view logs:"
echo "  $COMPOSE_CMD logs -f"
echo ""
echo "To stop:"
echo "  $COMPOSE_CMD down"
echo ""
echo "Default login credentials (from backend/config/teams.json):"
echo "  Username: admin"
echo "  Password: admin123"
echo ""


