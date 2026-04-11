# Automatic Deployment - Works Everywhere

This document explains how the KubeLens application automatically works on any Kubernetes cluster without manual configuration.

## How It Works

When deployed using `k8s-deployment.yaml`, the application **automatically**:

1. ✅ **Detects in-cluster mode** - No kubeconfig needed!
2. ✅ **Uses service account tokens** - Automatically mounted by Kubernetes
3. ✅ **Uses cluster CA certificate** - Automatically available
4. ✅ **Connects to the API server** - Uses internal cluster DNS
5. ✅ **No volume mounts required** - Everything is automatic!

## Automatic Detection Priority

The application detects Kubernetes configuration in this order:

### Priority 1: In-Cluster Mode (Automatic in Kubernetes)
- **When:** Running inside a Kubernetes pod
- **How:** Detects service account tokens at `/var/run/secrets/kubernetes.io/serviceaccount/`
- **What it uses:**
  - Service account token for authentication
  - Cluster CA certificate for TLS
  - Internal API server address
- **No configuration needed!** ✅

### Priority 2: KUBECONFIG Environment Variable
- **When:** `KUBECONFIG` env var is set
- **Use case:** Custom configuration or multiple clusters

### Priority 3: Default Kubeconfig Location
- **When:** Running locally (Docker Desktop, etc.)
- **Location:** `/root/.kube/config`
- **Requires:** Volume mount from host

## Deployment Scenarios

### ✅ Scenario 1: Kubernetes Deployment (Automatic)

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      serviceAccountName: log-browser-sa  # Service account with RBAC
      containers:
      - name: log-browser
        image: iitrkp/dev-kubelens:dev
        # NO volume mounts needed!
        # NO kubeconfig needed!
        # NO certificates needed!
```

**What happens:**
1. Kubernetes automatically mounts service account tokens
2. Application detects in-cluster mode
3. Uses service account for authentication
4. Connects to API server automatically
5. **Works on ANY Kubernetes cluster!** 🎉

### Scenario 2: Local Docker (Requires Mounts)

```bash
# Only needed when running locally, NOT in Kubernetes
docker run -d --name kubelens -p 8080:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:dev
```

**Note:** This is only for local development. When deployed in Kubernetes, mounts are NOT needed!

## Service Account Setup

The deployment YAML includes:

1. **ServiceAccount** - `log-browser-sa`
2. **ClusterRole** - Permissions to read pods, logs, exec, etc.
3. **ClusterRoleBinding** - Binds role to service account

This gives the application the permissions it needs to:
- List namespaces, pods, services
- Read pod logs
- Execute commands in pods
- Port forward to pods

## Verification

After deployment, check logs:

```bash
kubectl logs -n apps-sbx-log-browser -l app=log-browser
```

You should see:
```
✅ Detected in-cluster Kubernetes configuration
✅ Using in-cluster configuration with context: ...
   Service account token: /var/run/secrets/kubernetes.io/serviceaccount/token
   CA certificate: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
✅ Connection successful for in-cluster - Found X namespaces
```

## Why It Works Automatically

### Kubernetes Service Account Tokens

When a pod runs in Kubernetes:
- Kubernetes **automatically** mounts service account tokens
- Location: `/var/run/secrets/kubernetes.io/serviceaccount/`
- Contains:
  - `token` - JWT token for authentication
  - `ca.crt` - Cluster CA certificate
  - `namespace` - Current namespace

### In-Cluster API Server

- Kubernetes provides internal DNS
- API server is accessible at: `https://kubernetes.default.svc`
- Service account tokens are automatically valid
- No manual configuration needed!

## Testing Automatic Deployment

### Deploy to Any Cluster

```bash
# 1. Update image if needed (already set to iitrkp/dev-kubelens:dev)
# 2. Deploy
kubectl apply -f k8s-deployment.yaml

# 3. Wait for pod
kubectl wait --for=condition=ready pod -l app=log-browser -n apps-sbx-log-browser --timeout=60s

# 4. Check logs (should show in-cluster mode)
kubectl logs -n apps-sbx-log-browser -l app=log-browser | grep -i "in-cluster"

# 5. Port forward and access
kubectl port-forward -n apps-sbx-log-browser svc/log-browser-service 8081:80
```

### Verify It's Working

```bash
# Check service account is mounted
kubectl exec -n apps-sbx-log-browser -l app=log-browser -- \
  ls -la /var/run/secrets/kubernetes.io/serviceaccount/

# Should show:
# token
# ca.crt
# namespace
```

## Troubleshooting

### Issue: "No kubeconfig found"

**If running in Kubernetes:**
- ✅ This is normal! In-cluster mode doesn't need kubeconfig
- Check logs for "Detected in-cluster Kubernetes configuration"

**If running locally:**
- Mount kubeconfig: `-v ~/.kube:/root/.kube:ro`

### Issue: "Connection failed"

**Check:**
1. Service account exists: `kubectl get sa -n apps-sbx-log-browser`
2. RBAC is correct: `kubectl get clusterrolebinding log-browser-binding`
3. Pod has service account: `kubectl get pod -n apps-sbx-log-browser -o jsonpath='{.spec.serviceAccountName}'`

### Issue: "Permission denied"

**Check RBAC:**
```bash
kubectl auth can-i list pods \
  --as=system:serviceaccount:apps-sbx-log-browser:log-browser-sa
```

## Summary

✅ **Deploy anywhere** - Works on any Kubernetes cluster  
✅ **No configuration** - Fully automatic  
✅ **No volumes** - Service account tokens are automatic  
✅ **No certificates** - Cluster CA is automatic  
✅ **No kubeconfig** - In-cluster mode is automatic  

Just deploy and it works! 🚀

