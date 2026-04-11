# Kubernetes Log Viewer - Docker Deployment Guide

This guide explains how to deploy the Kubernetes Log Viewer using Docker with automatic kubeconfig detection.

## Features

- **Automatic Kubeconfig Detection**: Automatically discovers and uses kubeconfig files from standard locations
- **Multi-Environment Support**: Can connect to multiple Kubernetes clusters
- **UI Resource Display**: Shows environments, namespaces, pods, containers, and logs
- **Team-based Access Control**: Role-based access with environment and namespace restrictions

## Prerequisites

- Docker and Docker Compose installed
- Kubernetes cluster access (kubeconfig file)
- Node.js 18+ (for local development)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Ensure your kubeconfig is accessible**:
   ```bash
   # Your kubeconfig should be at ~/.kube/config
   ls -la ~/.kube/config
   ```

2. **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application**:
   - Open your browser to: `http://localhost:8081`
   - Login with credentials from `backend/config/teams.json`
   - Example: `admin` / `admin123`

### Option 2: Using Docker directly

1. **Build the Docker image**:
   ```bash
   docker build -t kubelens:latest .
   ```

2. **Run the container with kubeconfig mounting**:
   ```bash
   docker run -d \
     --name kubelens \
     -p 8081:3006 \
     -v ~/.kube:/root/.kube:ro \
     -v ~/.minikube:/root/.minikube:ro \
     kubelens:latest
   ```

3. **Access the application**:
   - Open your browser to: `http://localhost:8081`

## Kubeconfig Detection Methods

The application automatically detects kubeconfig files using the following methods (in order):

### Method 1: KUBECONFIG Environment Variable
```bash
docker run -d \
  --name kubelens \
  -p 8081:3006 \
  -e KUBECONFIG=/root/.kube/config \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

For multiple kubeconfig files:
```bash
docker run -d \
  --name kubelens \
  -p 8081:3006 \
  -e KUBECONFIG=/root/.kube/config:/root/.kube/config2 \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

### Method 2: Standard Kubeconfig Location
The application automatically checks `/root/.kube/config` when mounted:
```bash
docker run -d \
  --name kubelens \
  -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  kubelens:latest
```

### Method 3: Custom Configs Directory
Mount a directory with multiple kubeconfig files:
```bash
docker run -d \
  --name kubelens \
  -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v /path/to/your/configs:/app/backend/configs:ro \
  kubelens:latest
```

Kubeconfig files should be named with the pattern: `{environment-name}-kubeconfig` or `config`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KUBECONFIG` | Path to kubeconfig file(s), colon-separated for multiple | - |
| `DISABLE_CONFIG_DISCOVERY` | Set to `true` to use only KUBECONFIG env var | `false` |
| `KUBECONFIG_PATH` | Custom path for kubeconfig directory | `/app/backend/configs` |
| `PORT` | Backend server port | `3006` |
| `NODE_ENV` | Node environment | `production` |

## Using with Minikube

If you're using Minikube, the kubeconfig is automatically detected:

```bash
docker-compose up -d
```

The docker-compose.yml already mounts `~/.minikube` directory.

## Using with Multiple Clusters

To connect to multiple Kubernetes clusters:

1. **Create a configs directory**:
   ```bash
   mkdir -p ./backend/configs
   ```

2. **Copy your kubeconfig files**:
   ```bash
   cp ~/.kube/config-dev ./backend/configs/dev-kubeconfig
   cp ~/.kube/config-prod ./backend/configs/prod-kubeconfig
   ```

3. **Run with Docker Compose** (already configured):
   ```bash
   docker-compose up -d
   ```

The application will automatically discover all kubeconfig files in the `backend/configs` directory.

## Verifying Deployment

1. **Check container logs**:
   ```bash
   docker logs kubelens
   ```

   You should see output like:
   ```
   === Kubernetes Log Viewer - Docker Entrypoint ===
   Starting with automatic kubeconfig detection...
   Found kubeconfig at /root/.kube/config
   === Discovered Kubeconfig Files ===
   ...
   ✅ Initialized Kubernetes client for environment: minikube
   Backend API running on port 3006
   ```

2. **Check if kubeconfig was detected**:
   ```bash
   docker exec kubelens ls -la /app/backend/configs
   ```

3. **Test API health**:
   ```bash
   curl http://localhost:8081/api/health
   ```

## Accessing the UI

1. Open browser: `http://localhost:8081`
2. Login with credentials from `backend/config/teams.json`
3. Navigate through:
   - **Environments** → Select your Kubernetes cluster
   - **Namespaces** → Select a namespace
   - **Pods** → Select a pod
   - **Containers** → Select a container
   - **Logs** → View container logs

## Troubleshooting

### No kubeconfig files found

**Problem**: Container logs show "WARNING: No kubeconfig files found!"

**Solution**:
1. Verify kubeconfig exists on host: `ls -la ~/.kube/config`
2. Check volume mount: `docker exec kubelens ls -la /root/.kube`
3. Ensure read permissions: `chmod 644 ~/.kube/config`

### Cannot connect to cluster

**Problem**: Application starts but cannot connect to Kubernetes cluster

**Solution**:
1. Test kubeconfig locally: `kubectl get nodes`
2. Check network connectivity from container
3. Verify cluster is accessible from Docker network
4. Check container logs for specific error messages

### Multiple environments not showing

**Problem**: Only one environment appears in UI

**Solution**:
1. Ensure multiple kubeconfig files are in `backend/configs/`
2. Files should be named: `{env-name}-kubeconfig`
3. Check logs for discovery messages
4. Verify each kubeconfig has a valid context

### Permission denied errors

**Problem**: Permission errors when accessing kubeconfig

**Solution**:
1. Ensure kubeconfig has correct permissions: `chmod 644 ~/.kube/config`
2. Check Docker volume mount permissions
3. Verify user in container has read access

## Production Deployment

For production deployment:

1. **Use environment-specific configuration**
2. **Set up proper secrets management** for credentials
3. **Configure reverse proxy** (nginx/traefik) for HTTPS
4. **Set up monitoring** and logging
5. **Use Kubernetes secrets** for sensitive data

Example production docker-compose:
```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3006:3006"
    environment:
      - NODE_ENV=production
      - PORT=3006
    volumes:
      - /etc/kubernetes:/root/.kube:ro
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3006/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Stopping the Application

```bash
# Using Docker Compose
docker-compose down

# Using Docker directly
docker stop kubelens
docker rm kubelens
```

## Support

For issues or questions:
1. Check container logs: `docker logs kubelens`
2. Verify kubeconfig: `kubectl config view`
3. Test API endpoints: `curl http://localhost:8081/api/health`


