# Running the QA Image

## Multi-Platform Image
The `iitrkp/dev-kubelens:qa` image has been built for both `linux/amd64` and `linux/arm64` platforms, so it will work on any system.

## Pull the Image
```bash
docker pull iitrkp/dev-kubelens:qa
```

## Running the Container

### Option 1: Using Docker Desktop (Recommended for local development)

When running in Docker Desktop, you need to ensure the kubeconfig paths are correctly mounted:

```bash
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:qa
```

### Option 2: If kubeconfig paths are different

If your kubeconfig uses different paths, you can:

1. **Copy your kubeconfig to a known location:**
```bash
# Copy kubeconfig
mkdir -p ~/kubelens-config
cp ~/.kube/config ~/kubelens-config/

# Copy minikube certificates if needed
cp -r ~/.minikube ~/kubelens-config/.minikube

# Run with custom mount
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/kubelens-config/.kube:/root/.kube:ro \
  -v ~/kubelens-config/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:qa
```

2. **Or use environment variables to point to your kubeconfig:**
```bash
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  -e KUBECONFIG=/root/.kube/config \
  iitrkp/dev-kubelens:qa
```

### Option 3: For Docker Desktop Kubernetes

If you're using Docker Desktop's built-in Kubernetes, you might need to:

```bash
# Get Docker Desktop kubeconfig
kubectl config view --flatten > ~/.kube/docker-desktop-config

# Run with Docker Desktop config
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/.kube/docker-desktop-config:/root/.kube/config:ro \
  iitrkp/dev-kubelens:qa
```

## Troubleshooting

### Issue: "Certificate file not found" or "Client certificate file not found"

**Solution:** Ensure all minikube certificates are accessible:

```bash
# Check if minikube directory exists and has certificates
ls -la ~/.minikube/
ls -la ~/.minikube/profiles/minikube/

# If certificates exist, ensure they're mounted correctly
docker run -d --name kubelens-qa -p 8089:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  iitrkp/dev-kubelens:qa

# Check container logs
docker logs kubelens-qa
```

### Issue: "Unable to pull iitrkp/dev-kubelens:qa - no matching manifest"

**Solution:** This should be fixed now with the multi-platform build. If you still see this:

```bash
# Pull with explicit platform
docker pull --platform linux/amd64 iitrkp/dev-kubelens:qa
# or
docker pull --platform linux/arm64 iitrkp/dev-kubelens:qa
```

### Issue: Container can't access Kubernetes resources

**Check:**
1. Verify kubeconfig is mounted: `docker exec kubelens-qa ls -la /root/.kube/`
2. Verify minikube certs are mounted: `docker exec kubelens-qa ls -la /root/.minikube/`
3. Check container logs: `docker logs kubelens-qa`
4. Test kubectl inside container: `docker exec kubelens-qa kubectl get nodes`

## Access the Application

Once running, access the application at:
- **URL:** http://localhost:8089
- **Default credentials:** Check your backend configuration

## View Logs

```bash
# View all logs
docker logs kubelens-qa

# Follow logs
docker logs -f kubelens-qa

# View last 100 lines
docker logs --tail 100 kubelens-qa
```

## Stop and Remove

```bash
docker stop kubelens-qa
docker rm kubelens-qa
```

