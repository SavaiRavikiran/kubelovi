# Fix Image Pull Issue

## Problem
```
Failed to pull image "iitrkp/dev-kubelens:dev": 
no match for platform in manifest: not found
```

This means either:
1. Image not pushed to Docker Hub
2. Image built for wrong platform/architecture

## Solution Options

### Option 1: Push Image to Docker Hub (If Not Pushed)

```bash
# Login to Docker Hub
docker login

# Build and push
docker build -t iitrkp/dev-kubelens:dev .
docker push iitrkp/dev-kubelens:dev
```

### Option 2: Build Multi-Platform Image

If your cluster is ARM64 or different architecture:

```bash
# Build for multiple platforms
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t iitrkp/dev-kubelens:dev \
  --push .
```

### Option 3: Check Cluster Architecture

```bash
# Check what architecture your cluster needs
kubectl get nodes -o wide
```

Look at the `ARCH` column to see what architecture is needed.

### Option 4: Use ImagePullPolicy and Local Registry

If using a private registry or local cluster:

```yaml
image: iitrkp/dev-kubelens:dev
imagePullPolicy: Always  # or IfNotPresent
```

