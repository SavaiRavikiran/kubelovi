# Quick Start - Universal Deployment

## One-Command Deployment

```bash
./docker-run.sh
```

This script automatically:
- ✅ Detects your kubeconfig location
- ✅ Detects minikube (if present)
- ✅ Builds and runs the container
- ✅ Shows you the access URL

## Manual Deployment

### Simple (Works Everywhere)

```bash
docker stop kubelens && docker rm kubelens
docker build -t kubelens:latest .
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest
```

### Access

Open your browser: **http://localhost:8081**

### View Logs

```bash
docker logs -f kubelens
```

### Stop

```bash
docker stop kubelens && docker rm kubelens
```

## How It Works

The Docker image automatically:
1. **Detects** your Kubernetes configuration
2. **Fixes** certificate paths for Docker
3. **Connects** to your cluster
4. **Shows** all your Kubernetes resources

No manual configuration needed! 🎉

## What Gets Mounted

- `~/.kube` → Your kubeconfig (required)
- `~/.minikube` → Minikube certificates (optional, only for minikube)

## Works On

- ✅ Linux
- ✅ macOS
- ✅ Windows (WSL)
- ✅ Cloud Kubernetes (GKE, EKS, AKS)
- ✅ Local clusters (minikube, kind, k3d)
- ✅ Inside Kubernetes (in-cluster mode)

## Troubleshooting

**Can't connect?**
```bash
# Check logs
docker logs kubelens

# Verify kubeconfig
kubectl config view
```

**See full documentation:** [UNIVERSAL_DEPLOYMENT.md](./UNIVERSAL_DEPLOYMENT.md)

