# Quick Fix for Image Pull Error

## Problem
```
Failed to pull image "iitrkp/dev-kubelens:dev": 
no match for platform in manifest: not found
```

## Solutions

### Solution 1: Build and Push Multi-Platform Image (Recommended)

This ensures the image works on both AMD64 and ARM64 clusters:

```bash
# 1. Login to Docker Hub
docker login

# 2. Build and push multi-platform image
./build-multi-platform.sh
```

Or manually:

```bash
# Enable buildx
docker buildx create --name multiplatform --use
docker buildx inspect --bootstrap

# Build and push for both platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t iitrkp/dev-kubelens:dev \
  --push .
```

### Solution 2: Check if Image Exists

```bash
# Check if image is on Docker Hub
docker pull iitrkp/dev-kubelens:dev

# If it fails, the image wasn't pushed
```

### Solution 3: Verify Image Was Pushed

Go to: https://hub.docker.com/r/iitrkp/dev-kubelens/tags

Check if `dev` tag exists.

### Solution 4: Check Cluster Architecture

```bash
# Check what architecture your cluster needs
kubectl get nodes -o wide
```

Look at the `ARCH` column. If it's `arm64`, you need a multi-platform build.

### Solution 5: Rebuild and Push (If Image Doesn't Exist)

```bash
# Build
docker build -t iitrkp/dev-kubelens:dev .

# Push
docker push iitrkp/dev-kubelens:dev
```

## After Fixing

1. **Rebuild and push the image** (using Solution 1 for multi-platform)
2. **Delete the pod** to force a new pull:
   ```bash
   kubectl delete pod -n apps-sbx-log-browser -l app=log-browser
   ```
3. **Wait for new pod** to start:
   ```bash
   kubectl get pods -n apps-sbx-log-browser -w
   ```

## Verify

```bash
# Check pod status
kubectl get pods -n apps-sbx-log-browser

# Check pod events
kubectl describe pod -n apps-sbx-log-browser -l app=log-browser | grep -A 10 Events
```

Should show: `Successfully pulled image` instead of `ImagePullBackOff`

