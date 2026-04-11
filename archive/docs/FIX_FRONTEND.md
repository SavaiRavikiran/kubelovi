# Fixing "Frontend files not found" Error

## Problem

The error "Frontend files not found" occurs when the frontend build files aren't in the expected location in the Docker container.

## Solution

The code has been updated to:
1. **Fix kubeconfig paths automatically** in Node.js (no need for Python)
2. **Better error messages** showing where files are expected
3. **Path fixing** for certificate files in kubeconfig

## Quick Fix

### 1. Rebuild the Image

```bash
docker build -t kubelens:latest .
```

### 2. Run with Proper Mounts

```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest
```

### 3. Check Logs

```bash
docker logs kubelens | head -30
```

You should see:
- "Serving static files from: /app/backend/api/public"
- "Public directory exists: true"
- "Fixed CA path: ..." (if paths needed fixing)

## What Was Fixed

1. **Kubeconfig Path Fixing**: Now done in Node.js using js-yaml
   - Automatically fixes certificate paths
   - Fixes server addresses
   - No Python dependencies needed

2. **Better Static File Serving**: 
   - More logging to debug issues
   - Checks multiple locations
   - Better error messages

3. **Automatic Discovery**:
   - Uses system kubeconfig directly
   - Fixes paths on-the-fly
   - Works with any kubeconfig

## Verification

After rebuilding and running:

1. **Check frontend files exist**:
   ```bash
   docker exec kubelens ls -la /app/backend/api/public/
   ```

2. **Check kubeconfig paths are fixed**:
   ```bash
   docker logs kubelens | grep "Fixed"
   ```

3. **Access UI**: http://localhost:8081

## If Still Not Working

Check the build output for frontend build errors:
```bash
docker build -t kubelens:latest . 2>&1 | grep -i "error\|frontend\|build"
```

The frontend should build during the Docker build process. If it fails, you'll see errors in the build output.

