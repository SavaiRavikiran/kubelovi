# Fixing Kubeconfig Path Issues in Docker

## Problem

When running the Kubernetes Log Viewer in Docker, you may encounter errors like:
- `ENOENT: no such file or directory, open '/home/user/.minikube/ca.crt'`
- `ECONNREFUSED 127.0.0.1:6443`

This happens because kubeconfig files contain absolute paths to certificate files that don't exist in the container.

## Solution

The entrypoint script now automatically fixes kubeconfig paths. However, you need to ensure:

1. **Mount the minikube directory** (if using minikube):
   ```bash
   docker run -d --name kubelens -p 8081:3006 \
     -v ~/.kube:/root/.kube:ro \
     -v ~/.minikube:/root/.minikube:ro \
     kubelens:latest
   ```

2. **For non-minikube clusters**, ensure certificate files are accessible:
   - If certificates are in `~/.kube/`, they'll be accessible via the mounted volume
   - If certificates are elsewhere, mount that directory too

3. **Rebuild the image** to get the latest fixes:
   ```bash
   docker build -t kubelens:latest .
   ```

## Quick Fix Commands

```bash
# Stop and remove old container
docker stop kubelens
docker rm kubelens

# Rebuild with fixes
docker build -t kubelens:latest .

# Run with proper volume mounts
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest

# Check logs to verify paths are fixed
docker logs kubelens | grep -i "fixed"
```

## Alternative: Use Host Network Mode

If path fixing doesn't work, you can use host network mode (Linux only):

```bash
docker run -d --name kubelens --network host \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

This allows the container to access `localhost` directly.

## Verifying the Fix

Check the container logs:
```bash
docker logs kubelens
```

You should see messages like:
- `Fixed CA path: /home/user/.minikube/ca.crt -> /root/.minikube/ca.crt`
- `Fixed server address: https://127.0.0.1:6443 -> https://192.168.49.2:6443`

## Troubleshooting

### Still getting certificate errors?

1. **Check if certificates exist in mounted volume**:
   ```bash
   docker exec kubelens ls -la /root/.minikube/
   ```

2. **Verify kubeconfig was fixed**:
   ```bash
   docker exec kubelens cat /app/backend/configs/*-kubeconfig | grep -E "(certificate-authority|client-certificate|client-key|server)"
   ```

3. **Check if server address is accessible**:
   ```bash
   docker exec kubelens kubectl config view --minify
   ```

### For Rancher or other clusters

If you're using Rancher or other Kubernetes distributions:

1. Ensure the kubeconfig uses embedded certificates (base64 encoded) instead of file paths
2. Or mount the directory containing the certificate files
3. The entrypoint script will try to fix paths automatically


