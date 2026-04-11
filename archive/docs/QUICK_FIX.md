# Quick Fix for "Failed to fetch namespaces" Error

## The Problem

Your kubeconfig files contain absolute paths like `/home/ravikiran_savai/.minikube/ca.crt` that don't exist inside the Docker container.

## The Solution

1. **Rebuild the image** with the updated entrypoint script that fixes paths:
   ```bash
   docker stop kubelens
   docker rm kubelens
   docker build -t kubelens:latest .
   ```

2. **Run with minikube volume mounted**:
   ```bash
   docker run -d --name kubelens -p 8081:3006 \
     -v ~/.kube:/root/.kube:ro \
     -v ~/.minikube:/root/.minikube:ro \
     kubelens:latest
   ```

3. **Check the logs** to verify paths are being fixed:
   ```bash
   docker logs kubelens | grep -i "fixed"
   ```

You should see output like:
```
Fixed CA path: /home/ravikiran_savai/.minikube/ca.crt -> /root/.minikube/ca.crt
Fixed server address: https://127.0.0.1:6443 -> https://192.168.49.2:6443
```

## What Changed

- Added automatic kubeconfig path fixing in the entrypoint script
- Installed Python3 and PyYAML in the Docker image for YAML processing
- Added logic to fix certificate paths and server addresses
- The script now maps host paths to container paths automatically

## If It Still Doesn't Work

Try using host network mode (Linux only):
```bash
docker run -d --name kubelens --network host \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest
```

This allows the container to access `localhost` directly.


