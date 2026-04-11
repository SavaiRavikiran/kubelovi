# Complete Deployment Guide - Automatic Kubeconfig Detection

## Overview

The application has been completely rewritten to automatically detect and use the system's kubeconfig wherever the Docker image is deployed. It will:

1. **Automatically discover** kubeconfig from standard locations
2. **Use the system's kubeconfig directly** without modification
3. **Show all Kubernetes resources** (namespaces, pods, containers, logs) in the UI
4. **Work on any system** where kubeconfig is mounted

## Key Changes

### 1. New KubeConfigHandler
- Smart discovery of kubeconfig files
- Automatic context detection
- No file modification - uses kubeconfig as-is
- Handles multiple contexts and environments

### 2. Simplified Entrypoint
- No longer modifies kubeconfig files
- Just sets up environment and starts the app
- Uses system kubeconfig directly

### 3. Automatic Path Resolution
- Kubernetes client library handles certificate paths automatically
- Works with mounted volumes
- No manual path fixing needed

## Deployment

### Basic Deployment

```bash
# Build the image
docker build -t kubelens:latest .

# Run with kubeconfig mounted
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

### With Minikube

```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest
```

### Using KUBECONFIG Environment Variable

```bash
docker run -d --name kubelens -p 8081:3006 \
  -e KUBECONFIG=/root/.kube/config \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

## How It Works

1. **On Startup**:
   - Discovers kubeconfig from:
     - `KUBECONFIG` environment variable
     - `/root/.kube/config` (default location)
     - `/app/backend/configs/` directory
   - Loads all contexts from discovered kubeconfigs
   - Initializes Kubernetes clients for each context
   - Tests connections (non-blocking)

2. **When Accessing Resources**:
   - Uses the appropriate Kubernetes client
   - Fetches namespaces, pods, containers from the actual cluster
   - Displays real data in the UI

## Verification

### Check Initialization

```bash
docker logs kubelens | grep -E "Initialized|Discovered|environments"
```

Should show:
```
✅ Initialized X Kubernetes environments
Available environments: context1, context2, ...
```

### Test API

```bash
# Health check
curl http://localhost:8081/api/health

# List environments (requires auth)
curl -H "x-session-id: YOUR_SESSION" http://localhost:8081/api/environments
```

### Access UI

1. Open: http://localhost:8081
2. Login: `admin` / `admin123`
3. Select environment
4. Browse namespaces → pods → containers → logs

## Troubleshooting

### No Environments Found

**Check kubeconfig exists:**
```bash
docker exec kubelens ls -la /root/.kube/config
```

**Check logs:**
```bash
docker logs kubelens | grep -i "kubeconfig\|discover\|error"
```

### Environments Found But No Resources

**Check connection:**
```bash
docker logs kubelens | grep -i "connection\|test"
```

**Verify cluster is accessible:**
```bash
docker exec kubelens kubectl get namespaces
```

### Certificate Errors

The new code uses the Kubernetes client library's built-in path resolution, which should handle certificates automatically. If you still see errors:

1. Ensure certificate files are in mounted volumes
2. Check kubeconfig uses correct paths for container
3. Verify certificates are readable

## Features

✅ **Automatic Discovery**: Finds kubeconfig automatically  
✅ **Multiple Contexts**: Supports multiple Kubernetes contexts  
✅ **Real Resources**: Shows actual namespaces, pods, containers  
✅ **No Modification**: Doesn't modify your kubeconfig files  
✅ **Works Anywhere**: Deploy on any system with kubeconfig  

## What You'll See in UI

- **Environments**: All discovered Kubernetes contexts
- **Namespaces**: Real namespaces from your cluster
- **Pods**: Actual running pods
- **Containers**: Real containers in pods
- **Logs**: Live log streaming
- **Files**: Browse container filesystems

The application now connects directly to your Kubernetes cluster and shows real data!


