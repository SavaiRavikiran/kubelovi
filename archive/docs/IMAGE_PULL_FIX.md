# Fix Image Pull Error

## Error
```
Failed to pull image "iitrkp/dev-kubelens:dev": 
no match for platform in manifest: not found
```

## Root Cause
The image either:
1. **Not pushed to Docker Hub** - Image only exists locally
2. **Wrong platform** - Image built for amd64 but cluster needs arm64 (or vice versa)

## Quick Fix

### Step 1: Build and Push Multi-Platform Image

```bash
# Login to Docker Hub
docker login

# Build and push (supports both amd64 and arm64)
./fix-and-push-image.sh
```

This will:
- Build image for both `linux/amd64` and `linux/arm64`
- Push to Docker Hub
- Work on any Kubernetes cluster architecture

### Step 2: Restart Deployment

After pushing, restart the deployment:

```bash
# Option 1: Delete pod (will recreate automatically)
kubectl delete pod -n apps-sbx-log-browser -l app=log-browser

# Option 2: Restart deployment
kubectl rollout restart deployment/log-browser -n apps-sbx-log-browser

# Watch the new pod
kubectl get pods -n apps-sbx-log-browser -w
```

### Step 3: Verify

```bash
# Check pod status
kubectl get pods -n apps-sbx-log-browser

# Check events (should show "Successfully pulled image")
kubectl describe pod -n apps-sbx-log-browser -l app=log-browser | grep -A 5 Events
```

## Manual Steps (If Script Doesn't Work)

### 1. Enable Buildx
```bash
docker buildx create --name multiplatform --use
docker buildx inspect --bootstrap
```

### 2. Build Multi-Platform
```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t iitrkp/dev-kubelens:dev \
  --push .
```

### 3. Verify on Docker Hub
Visit: https://hub.docker.com/r/iitrkp/dev-kubelens/tags

You should see the `dev` tag with multi-platform support.

## Alternative: Single Platform Build

If you know your cluster architecture:

```bash
# For AMD64 clusters
docker build -t iitrkp/dev-kubelens:dev .
docker push iitrkp/dev-kubelens:dev

# For ARM64 clusters
docker build --platform linux/arm64 -t iitrkp/dev-kubelens:dev .
docker push iitrkp/dev-kubelens:dev
```

## Check Cluster Architecture

```bash
kubectl get nodes -o wide
```

Look at the `ARCH` column to see what architecture your cluster uses.

## After Fix

Once the image is pushed correctly:
1. Pod will automatically pull the new image
2. Application will start successfully
3. You'll see logs showing in-cluster mode detection

## Troubleshooting

### Still Getting Error?

1. **Verify image exists on Docker Hub:**
   ```bash
   docker pull iitrkp/dev-kubelens:dev
   ```

2. **Check image manifest:**
   ```bash
   docker manifest inspect iitrkp/dev-kubelens:dev
   ```
   Should show both `linux/amd64` and `linux/arm64` platforms.

3. **Check pod events:**
   ```bash
   kubectl describe pod -n apps-sbx-log-browser -l app=log-browser
   ```

4. **Try pulling manually on a node:**
   ```bash
   kubectl debug node/<node-name> -it --image=busybox
   # Then inside: docker pull iitrkp/dev-kubelens:dev
   ```

