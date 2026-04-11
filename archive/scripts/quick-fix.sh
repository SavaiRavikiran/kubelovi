#!/bin/bash
# Quick fix: Restart container with minikube mount

echo "🛑 Stopping existing container..."
docker stop kubelens 2>/dev/null && docker rm kubelens 2>/dev/null || true

echo "🚀 Starting with minikube mount..."
docker run -d --name kubelens -p 8080:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:dev

echo ""
echo "✅ Container restarted!"
echo "📊 Access at: http://localhost:8080"
echo "📋 Logs: docker logs -f kubelens"
