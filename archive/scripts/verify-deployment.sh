#!/bin/bash

# Verify the deployment is working correctly

NAMESPACE="apps-sbx-log-browser"

echo "=== Verifying Deployment ==="
echo ""

# Check pod status
echo "📊 Pod Status:"
kubectl get pods -n $NAMESPACE -l app=log-browser
echo ""

# Check service
echo "🌐 Service:"
kubectl get svc -n $NAMESPACE
echo ""

# Check logs for in-cluster mode
echo "📋 Application Logs (checking for in-cluster mode):"
kubectl logs -n $NAMESPACE -l app=log-browser --tail=20 | grep -i "in-cluster\|kubeconfig\|connection\|namespaces" || kubectl logs -n $NAMESPACE -l app=log-browser --tail=10
echo ""

# Check if health endpoint works
echo "🏥 Health Check:"
kubectl exec -n $NAMESPACE -l app=log-browser -- wget -q -O- http://localhost:3006/api/health 2>/dev/null || echo "Health endpoint not ready yet"
echo ""

# Check service account
echo "🔐 Service Account:"
kubectl get pod -n $NAMESPACE -l app=log-browser -o jsonpath='{.items[0].spec.serviceAccountName}'
echo ""
echo ""

# Check if service account tokens are mounted
echo "🔑 Service Account Tokens:"
kubectl exec -n $NAMESPACE -l app=log-browser -- ls -la /var/run/secrets/kubernetes.io/serviceaccount/ 2>/dev/null || echo "Tokens not mounted"
echo ""

echo "✅ Verification complete!"
echo ""
echo "To access the application:"
echo "  kubectl port-forward -n $NAMESPACE svc/log-browser-service 8081:80"
echo "  Then open: http://localhost:8081"

