# Kubernetes Deployment Guide

This guide explains how to deploy KubeLens (Kubernetes Log Viewer) as a Kubernetes application using the provided YAML manifests.

## Prerequisites

1. **Docker Image**: Build and push your Docker image to a container registry
2. **Kubernetes Cluster**: Access to a Kubernetes cluster with appropriate permissions
3. **kubectl**: Configured to access your cluster

## Quick Deployment

### Step 1: Build and Push Docker Image

```bash
# Build the image
docker build -t kubelens:latest .

# Tag for your registry (replace with your registry)
docker tag kubelens:latest your-registry/kubelens:v1.0.0

# Push to registry
docker push your-registry/kubelens:v1.0.0
```

### Step 2: Update the Deployment YAML

Edit `k8s-deployment.yaml` and update the image:

```yaml
image: your-registry/kubelens:v1.0.0
```

**For local clusters (minikube/kind):**
```yaml
image: kubelens:latest
imagePullPolicy: Never
```

### Step 3: Deploy

```bash
kubectl apply -f k8s-deployment.yaml
```

### Step 4: Verify Deployment

```bash
# Check pods
kubectl get pods -n apps-sbx-log-browser

# Check services
kubectl get svc -n apps-sbx-log-browser

# View logs
kubectl logs -f deployment/log-browser -n apps-sbx-log-browser
```

### Step 5: Access the Application

**Option 1: Port Forward (Quick Test)**
```bash
kubectl port-forward -n apps-sbx-log-browser svc/log-browser-service 8081:80
```
Then open: http://localhost:8081

**Option 2: Ingress (Production)**
1. Update the Ingress hostname in `k8s-deployment.yaml`
2. Apply the ingress:
   ```bash
   kubectl apply -f k8s-deployment.yaml
   ```
3. Access via the configured domain

**Option 3: NodePort (Alternative)**
Change the Service type to `NodePort` in the YAML file.

## Deployment Components

### 1. Namespace
- Creates `apps-sbx-log-browser` namespace for isolation

### 2. ServiceAccount
- `log-browser-sa`: Service account for the application

### 3. RBAC (ClusterRole & ClusterRoleBinding)
- **ClusterRole**: Defines permissions needed by the application
- **ClusterRoleBinding**: Binds the role to the service account
- Permissions include:
  - Read pods, namespaces, services, nodes
  - Read pod logs
  - Execute commands in pods
  - Port forward to pods
  - Read deployments, jobs, configmaps, secrets

### 4. Service
- Exposes the application on port 80 (maps to container port 3006)
- Type: `ClusterIP` (internal access only)

### 5. Deployment
- Single replica deployment
- Uses the service account for in-cluster authentication
- Health checks configured (liveness and readiness probes)
- Resource limits defined

### 6. Ingress (Optional)
- Configured for external access
- Update the hostname before applying

## Configuration Options

### Environment Variables

You can add environment variables to the Deployment:

```yaml
env:
- name: PORT
  value: "3006"
- name: NODE_ENV
  value: "production"
- name: LOG_LEVEL
  value: "info"
```

### Resource Limits

Adjust resources based on your needs:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Replicas

For high availability, increase replicas:

```yaml
spec:
  replicas: 3
```

## Image Configuration

### Using Docker Hub

```yaml
image: yourusername/kubelens:latest
```

### Using Private Registry

```yaml
image: registry.example.com/kubelens:v1.0.0
```

You may need to create a secret for private registry:

```bash
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=your-username \
  --docker-password=your-password \
  --docker-email=your-email \
  -n apps-sbx-log-browser
```

Then add to deployment:

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: regcred
```

### Using Local Images (Minikube/Kind)

For local development with minikube or kind:

```yaml
image: kubelens:latest
imagePullPolicy: Never
```

Load image into minikube:
```bash
minikube image load kubelens:latest
```

Or for kind:
```bash
kind load docker-image kubelens:latest
```

## How In-Cluster Mode Works

When deployed inside Kubernetes, the application automatically:

1. **Detects in-cluster configuration** via service account tokens
2. **Uses the service account** (`log-browser-sa`) for authentication
3. **Connects to the API server** using the cluster's internal DNS
4. **No kubeconfig needed** - everything is automatic!

The service account tokens are automatically mounted at:
- `/var/run/secrets/kubernetes.io/serviceaccount/token`
- `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n apps-sbx-log-browser -l app=log-browser

# Check logs
kubectl logs -n apps-sbx-log-browser -l app=log-browser
```

### Permission Errors

Verify RBAC is correctly applied:

```bash
# Check ClusterRoleBinding
kubectl get clusterrolebinding log-browser-binding

# Check ServiceAccount
kubectl get sa -n apps-sbx-log-browser

# Test permissions
kubectl auth can-i list pods --as=system:serviceaccount:apps-sbx-log-browser:log-browser-sa
```

### Image Pull Errors

```bash
# Check image pull policy
kubectl describe pod -n apps-sbx-log-browser -l app=log-browser | grep Image

# For private registry, verify secret
kubectl get secret regcred -n apps-sbx-log-browser
```

### Application Not Connecting

```bash
# Check if service account tokens are mounted
kubectl exec -n apps-sbx-log-browser -l app=log-browser -- ls -la /var/run/secrets/kubernetes.io/serviceaccount/

# Check application logs for connection errors
kubectl logs -n apps-sbx-log-browser -l app=log-browser | grep -i "kubeconfig\|cluster\|connection"
```

## Updating the Deployment

### Update Image

```bash
kubectl set image deployment/log-browser log-browser=your-registry/kubelens:v1.0.1 -n apps-sbx-log-browser
```

### Rollout Status

```bash
kubectl rollout status deployment/log-browser -n apps-sbx-log-browser
```

### Rollback

```bash
kubectl rollout undo deployment/log-browser -n apps-sbx-log-browser
```

## Scaling

### Horizontal Scaling

```bash
kubectl scale deployment/log-browser --replicas=3 -n apps-sbx-log-browser
```

### Vertical Scaling

Edit the resources section in the deployment YAML and reapply.

## Cleanup

To remove everything:

```bash
kubectl delete -f k8s-deployment.yaml
```

Or delete namespace (removes everything):

```bash
kubectl delete namespace apps-sbx-log-browser
```

## Security Considerations

1. **RBAC**: The ClusterRole grants read-only access. Adjust permissions as needed.
2. **Network Policies**: Consider adding network policies to restrict traffic.
3. **Pod Security**: The deployment runs as non-root user (UID 1000).
4. **Secrets**: Never commit sensitive data. Use Kubernetes secrets.
5. **TLS**: Enable TLS in Ingress for production deployments.

## Production Recommendations

1. **Use specific image tags** (not `latest`)
2. **Enable resource limits** (already configured)
3. **Use multiple replicas** for high availability
4. **Configure proper health checks** (already configured)
5. **Set up monitoring** and alerting
6. **Use TLS/HTTPS** for external access
7. **Regular security updates** of the base image
8. **Backup configurations** and secrets

## Example: Complete Deployment Workflow

```bash
# 1. Build image
docker build -t myregistry/kubelens:v1.0.0 .

# 2. Push to registry
docker push myregistry/kubelens:v1.0.0

# 3. Update k8s-deployment.yaml with your image
sed -i 's|image: kubelens:latest|image: myregistry/kubelens:v1.0.0|' k8s-deployment.yaml

# 4. Deploy
kubectl apply -f k8s-deployment.yaml

# 5. Wait for deployment
kubectl wait --for=condition=available --timeout=300s deployment/log-browser -n apps-sbx-log-browser

# 6. Port forward for testing
kubectl port-forward -n apps-sbx-log-browser svc/log-browser-service 8081:80

# 7. Access application
# Open http://localhost:8081 in browser
```

## Support

For issues:
1. Check pod logs: `kubectl logs -n apps-sbx-log-browser -l app=log-browser`
2. Check pod events: `kubectl describe pod -n apps-sbx-log-browser -l app=log-browser`
3. Verify RBAC: `kubectl auth can-i list pods --as=system:serviceaccount:apps-sbx-log-browser:log-browser-sa`

