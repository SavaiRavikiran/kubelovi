#!/bin/bash

# Quick script to access the remote deployment

NAMESPACE="apps-sbx-log-browser"
SERVICE="log-browser-service"
PORT="8081"

echo "=== Accessing Remote Deployment ==="
echo ""
echo "Image: iitrkp/dev-kubelens:dev"
echo "Namespace: $NAMESPACE"
echo ""
echo "Setting up port forwarding..."
echo "Access at: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop"
echo ""

kubectl port-forward -n $NAMESPACE svc/$SERVICE $PORT:80

