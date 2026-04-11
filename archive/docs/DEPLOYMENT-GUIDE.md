# Deployment Guide - Automatic Kubeconfig Detection

The `iitrkp/dev-kubelens:qa` image automatically detects and uses Kubernetes configurations based on how it's deployed. Here's how it works in different scenarios:

## 🎯 Automatic Detection Priority

The application detects kubeconfig in this order:

1. **In-Cluster Mode** (Kubernetes deployment) - ✅ **Fully Automatic**
2. **KUBECONFIG Environment Variable** - ✅ **Automatic if set**
3. **Default Location** (`/root/.kube/config`) - ✅ **Automatic if mounted**
4. **Additional Configs** (`/root/.kube/*`) - ✅ **Automatic if mounted**
5. **Configs Directory** (`/app/backend/configs/*`) - ✅ **Automatic if mounted**

---

## 📦 Deployment Scenarios

### 1. **Docker Desktop / Docker Run** (Current System)

**Status:** ⚠️ **Requires Volume Mounts**

The image will automatically detect kubeconfig **IF** you mount the volumes:

```bash
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:qa
```

**What happens automatically:**
- ✅ Detects `/root/.kube/config` if mounted
- ✅ Scans `/root/.kube/` for additional config files
- ✅ Fixes certificate paths automatically (e.g., `/home/user/.minikube` → `/root/.minikube`)
- ✅ Discovers all contexts and creates environments
- ✅ Tests connections and reports status

**Use the provided script:**
```bash
./run-qa-container.sh
```

---

### 2. **Kubernetes Deployment (In-Cluster Mode)**

**Status:** ✅ **Fully Automatic - No Configuration Needed!**

When deployed as a Pod in Kubernetes, it automatically uses the cluster's service account:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubelens
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kubelens
  template:
    metadata:
      labels:
        app: kubelens
    spec:
      serviceAccountName: kubelens-sa  # Service account with RBAC permissions
      containers:
      - name: kubelens
        image: iitrkp/dev-kubelens:qa
        ports:
        - containerPort: 3006
        # No volume mounts needed! Uses in-cluster config automatically
```

**What happens automatically:**
- ✅ Detects `/var/run/secrets/kubernetes.io/serviceaccount/` tokens
- ✅ Uses in-cluster Kubernetes API automatically
- ✅ No kubeconfig files needed
- ✅ Works with the cluster it's running in

**Required RBAC:**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kubelens-sa
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubelens-role
rules:
- apiGroups: [""]
  resources: ["namespaces", "pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kubelens-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kubelens-role
subjects:
- kind: ServiceAccount
  name: kubelens-sa
  namespace: default
```

---

### 3. **Docker Compose**

**Status:** ✅ **Automatic with Volume Mounts**

```yaml
version: '3.8'
services:
  kubelens:
    image: iitrkp/dev-kubelens:qa
    ports:
      - "8089:3006"
    volumes:
      - ~/.kube:/root/.kube:ro
      - ~/.minikube:/root/.minikube:ro
    # Automatically detects kubeconfig from mounted volumes
```

---

### 4. **Different System / Different User**

**Status:** ✅ **Automatic if Paths are Mounted**

The image automatically fixes paths! If your kubeconfig has:
- `/home/john/.minikube/ca.crt` → Automatically fixed to `/root/.minikube/ca.crt`
- `/home/jane/.kube/config` → Automatically fixed to `/root/.kube/config`

**Just mount the directories:**
```bash
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:qa
```

The entrypoint script will:
1. ✅ Find all kubeconfig files
2. ✅ Fix all certificate paths automatically
3. ✅ Update server addresses (127.0.0.1 → host.docker.internal)
4. ✅ Enable insecure-skip-tls-verify for local clusters if needed
5. ✅ Create fixed versions in `/app/backend/configs/`

---

## 🔍 What Gets Detected Automatically

### From `/root/.kube/config`:
- ✅ All contexts in the kubeconfig
- ✅ Multiple clusters/environments
- ✅ Certificate paths (auto-fixed)
- ✅ Server addresses (auto-fixed for Docker)

### From `/root/.kube/*`:
- ✅ Additional kubeconfig files
- ✅ Each file becomes a separate environment
- ✅ All paths auto-fixed

### From In-Cluster Mode:
- ✅ Current cluster automatically
- ✅ No configuration needed
- ✅ Uses service account tokens

---

## 🚀 Quick Start for Different Systems

### System A (Your Current System):
```bash
./run-qa-container.sh
```

### System B (Different User/Path):
```bash
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:qa
```

### System C (Kubernetes Cluster):
```bash
kubectl apply -f kubelens-deployment.yaml
# No volume mounts needed - uses in-cluster config automatically!
```

---

## ✅ Summary

| Deployment Type | Automatic? | What's Needed |
|----------------|------------|---------------|
| **Docker Desktop** | ✅ Yes (with mounts) | Mount `~/.kube` and `~/.minikube` |
| **Docker Run** | ✅ Yes (with mounts) | Mount `~/.kube` and `~/.minikube` |
| **Kubernetes Pod** | ✅ **Fully Automatic** | Just deploy - uses in-cluster config |
| **Docker Compose** | ✅ Yes (with mounts) | Define volumes in compose file |
| **Different System** | ✅ Yes (with mounts) | Paths auto-fixed, just mount volumes |

---

## 🎯 Key Points

1. **For Docker:** Always mount `~/.kube` and `~/.minikube` - then it's automatic
2. **For Kubernetes:** Deploy with service account - fully automatic, no mounts needed
3. **Path Fixing:** The image automatically fixes all certificate paths regardless of host system
4. **Multi-Environment:** Automatically discovers all contexts and creates environments
5. **Connection Testing:** Automatically tests all connections and reports status

---

## 📝 Example: Deploy on Any System

The same command works on **any system** as long as volumes are mounted:

```bash
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:qa
```

The image will:
- ✅ Find kubeconfig automatically
- ✅ Fix all paths automatically  
- ✅ Discover all environments automatically
- ✅ Test connections automatically
- ✅ Work with whatever Kubernetes clusters are configured

**It's that simple!** 🎉

