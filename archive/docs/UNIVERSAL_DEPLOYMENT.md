# Universal Deployment Guide

This guide explains how to deploy Kubernetes Log Viewer (KubeLens) on any system. The Docker image automatically detects and uses the system's Kubernetes configuration, making it work seamlessly across different environments.

## Quick Start

The easiest way to deploy is using the provided script:

```bash
./docker-run.sh
```

This script automatically:
- Detects your kubeconfig location
- Detects minikube (if present)
- Builds the Docker image
- Starts the container with proper volume mounts

## Manual Deployment

### Basic Deployment (Works on Any System)

```bash
# Build the image
docker build -t kubelens:latest .

# Run with automatic kubeconfig detection
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

### With Minikube (Local Development)

If you're using minikube, also mount the minikube directory:

```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest
```

### Using Custom KUBECONFIG Path

If your kubeconfig is in a non-standard location:

```bash
docker run -d --name kubelens -p 8081:3006 \
  -e KUBECONFIG=/root/.kube/config \
  -v /path/to/your/.kube:/root/.kube:ro \
  kubelens:latest
```

### Multiple Kubeconfig Files

You can provide multiple kubeconfig files by mounting a directory:

```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v /path/to/configs:/app/backend/configs:ro \
  kubelens:latest
```

## How It Works

The application automatically discovers Kubernetes configuration in this order:

1. **In-Cluster Mode** (if running inside Kubernetes)
   - Automatically uses service account tokens
   - No configuration needed

2. **KUBECONFIG Environment Variable**
   - Uses the path specified in `KUBECONFIG`
   - Supports colon-separated list of paths

3. **Default Kubeconfig Location**
   - `/root/.kube/config` (mounted from host)

4. **Configs Directory**
   - `/app/backend/configs/` (for additional kubeconfig files)

### Automatic Path Fixing

The application automatically fixes certificate paths in kubeconfig files:
- Maps host paths to container paths (e.g., `/home/user/.minikube` → `/root/.minikube`)
- Fixes server addresses for Docker Desktop (localhost → host.docker.internal)
- Handles certificate file locations

## Deployment Scenarios

### Local Development (Minikube/Kind)

```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest
```

### Cloud Kubernetes (GKE, EKS, AKS)

```bash
# Just mount your kubeconfig
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

### In-Cluster Deployment

Deploy as a Kubernetes pod - no volume mounts needed:

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
      serviceAccountName: kubelens
      containers:
      - name: kubelens
        image: kubelens:latest
        ports:
        - containerPort: 3006
        # No volume mounts needed - uses in-cluster config
```

### Different Operating Systems

#### Linux
```bash
docker run -d --name kubelens -p 8081:3006 \
  -v $HOME/.kube:/root/.kube:ro \
  kubelens:latest
```

#### macOS
```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest
```

#### Windows (WSL)
```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

## Troubleshooting

### Container Can't Connect to Kubernetes

1. **Check if kubeconfig is mounted:**
   ```bash
   docker exec kubelens ls -la /root/.kube
   ```

2. **Check container logs:**
   ```bash
   docker logs kubelens
   ```

3. **Verify kubeconfig on host:**
   ```bash
   kubectl config view
   ```

### Certificate Path Errors

The application automatically fixes certificate paths. If you see errors:
- Ensure minikube directory is mounted (if using minikube)
- Check that certificate files exist in the mounted directories

### Server Address Issues

For local clusters (minikube, kind), the application automatically:
- Maps `localhost` to `host.docker.internal` (Mac/Windows)
- Maps `127.0.0.1` to `host.docker.internal`
- Sets `insecure-skip-tls-verify` for local development

## Advanced Configuration

### Custom Port

```bash
docker run -d --name kubelens -p 9090:3006 \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

### Environment Variables

```bash
docker run -d --name kubelens -p 8081:3006 \
  -e KUBECONFIG=/root/.kube/config \
  -e PORT=3006 \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

### Persistent Storage

If you want to persist application data:

```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v kubelens-data:/app/backend/data \
  kubelens:latest
```

## Stopping and Cleaning Up

```bash
# Stop the container
docker stop kubelens

# Remove the container
docker rm kubelens

# Remove the image (optional)
docker rmi kubelens:latest
```

## Accessing the Application

Once the container is running, access the application at:
- **URL:** http://localhost:8081
- **Default credentials:** (check `backend/config/teams.json`)

## Features

✅ **Automatic kubeconfig detection** - Works with any standard kubeconfig location  
✅ **Path fixing** - Automatically fixes certificate paths for Docker  
✅ **Multi-context support** - Handles multiple Kubernetes contexts  
✅ **In-cluster mode** - Works when deployed inside Kubernetes  
✅ **Cross-platform** - Works on Linux, macOS, and Windows (WSL)  
✅ **Cloud-ready** - Works with GKE, EKS, AKS, and other cloud providers  

## Support

For issues or questions:
1. Check container logs: `docker logs kubelens`
2. Verify kubeconfig: `kubectl config view`
3. Check application logs in the container

