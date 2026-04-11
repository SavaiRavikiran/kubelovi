# Local Testing Guide

## ✅ Current Status

**Local test container is running:**
- Container: `kubelens-test`
- Port: `8090` (http://localhost:8090)
- Image: `kubelens:devint-local`
- Status: ✅ Running and connected to Kubernetes

## 🧪 Testing the Fix

### Current Behavior (Local Docker)
When running locally with volume mounts, it uses kubeconfig files, so you'll see:
- Environments: `minikube, rancher-desktop, docker, kind` (from your kubeconfig)

### Fixed Behavior (Kubernetes Deployment)
When deployed in Kubernetes (in-cluster mode), the environment name will be:
- **Before fix:** `inclustercontext` ❌
- **After fix:** 
  - `docker-desktop` (if Docker Desktop Kubernetes)
  - `minikube` (if minikube)
  - `kind` (if kind)
  - `current-cluster` (fallback)
  - Or custom name from `CLUSTER_NAME` env var ✅

## 📋 Test Steps

### 1. Test Locally (Current)
```bash
# Container is already running
docker logs kubelens-test

# Access the app
open http://localhost:8090

# Check environment names in UI
# Should show: minikube, rancher-desktop, docker, kind
```

### 2. Test In-Cluster Mode (After Deployment)

To test the in-cluster name fix, you need to deploy in Kubernetes:

```bash
# Deploy to Kubernetes
kubectl apply -f v11-deployment-optimized.yaml

# Check logs
kubectl logs -n apps-sbxkubelovi -l app=kubelovi

# Look for:
# ✅ Environment name: <should be docker-desktop, current-cluster, or custom>
# (NOT inclustercontext)
```

### 3. Set Custom Name (Optional)

Add to your deployment YAML:
```yaml
env:
- name: CLUSTER_NAME
  value: "production-cluster"  # Your custom name
```

## 🔍 Verify the Fix

### Check Code Changes
The fix is in: `backend/api/kubeconfig-handler.js` lines 33-89

**What it does:**
1. Checks `CLUSTER_NAME` or `KUBERNETES_CLUSTER_NAME` env var
2. Extracts from API server URL (docker-desktop, minikube, kind, etc.)
3. Falls back to namespace name
4. Final fallback: `current-cluster`

### Expected Logs (In-Cluster Mode)
```
Detected in-cluster Kubernetes configuration
✅ Using in-cluster configuration with context: <context>
   Environment name: docker-desktop  # <-- Should show good name, not inclustercontext
```

## 🚀 Next Steps

1. **Test locally** (current): ✅ Working
2. **Push to Docker Hub** with `devint` tag:
   ```bash
   ./push-devint-multiplatform.sh
   ```
3. **Deploy in Kubernetes** and verify the environment name shows correctly

## 📝 Summary

- ✅ Local test: Working (shows kubeconfig environments)
- ✅ Code fix: Applied (will work in Kubernetes)
- ⏳ Push to Docker Hub: Ready (use `push-devint-multiplatform.sh`)
- ⏳ Deploy in Kubernetes: Will show proper environment name

The fix will work when deployed in Kubernetes - the local test uses kubeconfig files, so it won't show the in-cluster name fix.

