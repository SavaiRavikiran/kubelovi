#!/bin/bash

# Script to test the remote Docker Hub image deployment

set -e

NAMESPACE="apps-sbx-log-browser"
SERVICE="log-browser-service"
PORT="8081"

echo "=== Testing Remote Image Deployment ==="
echo ""

# Check if pod is running
echo "📊 Checking deployment status..."
POD_STATUS=$(kubectl get pods -n $NAMESPACE -l app=log-browser -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Not Found")

if [ "$POD_STATUS" != "Running" ]; then
    echo "⚠️  Pod is not running. Current status: $POD_STATUS"
    echo ""
    echo "Checking pod details..."
    kubectl get pods -n $NAMESPACE -l app=log-browser
    echo ""
    echo "Checking pod logs..."
    kubectl logs -n $NAMESPACE -l app=log-browser --tail=30
    exit 1
fi

echo "✅ Pod is running"
echo ""

# Check if service exists
if ! kubectl get svc -n $NAMESPACE $SERVICE &>/dev/null; then
    echo "❌ Service $SERVICE not found"
    exit 1
fi

echo "✅ Service exists"
echo ""

# Check pod logs for startup
echo "📋 Recent application logs:"
echo "---"
kubectl logs -n $NAMESPACE -l app=log-browser --tail=10
echo "---"
echo ""

# Check which image is being used
echo "🔍 Checking deployed image:"
kubectl get deployment -n $NAMESPACE log-browser -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""
echo ""

# Port forward in background
echo "🚀 Setting up port forwarding..."
echo "   Local: http://localhost:$PORT"
echo "   Remote: $SERVICE.$NAMESPACE:80"
echo ""
echo "Port forwarding is running in the background."
echo "Press Ctrl+C to stop port forwarding."
echo ""
echo "Access the application at: http://localhost:$PORT"
echo ""

# Port forward
kubectl port-forward -n $NAMESPACE svc/$SERVICE $PORT:80

