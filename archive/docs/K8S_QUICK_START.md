# Kubernetes Deployment - Quick Start

## Deploy in 3 Steps

### 1. Build and Push Image

```bash
# Build
docker build -t kubelens:latest .

# For local clusters (minikube/kind)
minikube image load kubelens:latest
# OR
kind load docker-image kubelens:latest

# For remote clusters (push to registry)
docker tag kubelens:latest your-registry/kubelens:v1.0.0
docker push your-registry/kubelens:v1.0.0
```

### 2. Update Image in YAML

Edit `k8s-deployment.yaml` or `k8s-deployment-quick.yaml`:

```yaml
image: your-registry/kubelens:v1.0.0
# OR for local:
# image: kubelens:latest
# imagePullPolicy: Never
```

### 3. Deploy

```bash
kubectl apply -f k8s-deployment.yaml
```

### 4. Access

```bash
# Port forward
kubectl port-forward -n apps-sbx-log-browser svc/log-browser-service 8081:80

# Open http://localhost:8081
```

## Files

- **`k8s-deployment.yaml`** - Full deployment with health checks, ingress, etc.
- **`k8s-deployment-quick.yaml`** - Minimal deployment for quick testing
- **`K8S_DEPLOYMENT_GUIDE.md`** - Complete documentation

## Verify

```bash
# Check pods
kubectl get pods -n apps-sbx-log-browser

# Check logs
kubectl logs -f -n apps-sbx-log-browser -l app=log-browser

# Check service
kubectl get svc -n apps-sbx-log-browser
```

## Cleanup

```bash
kubectl delete -f k8s-deployment.yaml
```

## How It Works

When deployed in Kubernetes:
- ✅ **Automatically uses in-cluster config** (no kubeconfig needed!)
- ✅ **Uses ServiceAccount** for authentication
- ✅ **RBAC permissions** for reading pods, logs, etc.
- ✅ **Works exactly like your local Docker deployment**

The application automatically detects it's running inside Kubernetes and uses the service account tokens for authentication.

