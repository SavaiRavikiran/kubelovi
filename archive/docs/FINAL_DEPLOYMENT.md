# Final Deployment Instructions

## ✅ What's Fixed

1. **Kubeconfig path fixing** - Automatically fixes certificate paths from host to container
2. **Server address fixing** - Converts localhost addresses to container-accessible addresses
3. **All kubeconfig files processed** - Both newly copied and existing files are fixed

## 🚀 Deployment Steps

### 1. Rebuild the Image
```bash
docker build -t kubelens:latest .
```

### 2. Run with Proper Volume Mounts
```bash
docker run -d --name kubelens -p 8081:3006 \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.minikube:/root/.minikube:ro \
  kubelens:latest
```

### 3. Verify Paths Are Fixed
```bash
docker logs kubelens | grep -i "fixed"
```

You should see:
```
Fixed CA path: /home/user/.minikube/ca.crt -> /root/.minikube/ca.crt
Fixed client cert path: ... -> /root/.minikube/profiles/minikube/client.crt
Fixed client key path: ... -> /root/.minikube/profiles/minikube/client.key
Fixed server address: https://127.0.0.1:6443 -> https://172.17.0.1:6443
```

## ⚠️ Important Notes

### For Minikube Users

**If you get `ENOENT: no such file or directory` errors**, it means the certificate files aren't in the expected location. Check:

1. **Verify minikube is running**:
   ```bash
   minikube status
   ```

2. **Check certificate file locations**:
   ```bash
   ls -la ~/.minikube/ca.crt
   ls -la ~/.minikube/profiles/minikube/client.crt
   ```

3. **If files are in different locations**, you may need to:
   - Copy them to the expected locations, OR
   - Mount the specific directories where they actually are

### For Rancher Desktop / Docker Desktop Kubernetes

The server addresses are automatically converted from `127.0.0.1` to `172.17.0.1` (Docker bridge IP). If this doesn't work:

1. **Try using `host.docker.internal`** by setting an environment variable:
   ```bash
   docker run -d --name kubelens -p 8081:3006 \
     -v ~/.kube:/root/.kube:ro \
     -v ~/.minikube:/root/.minikube:ro \
     -e USE_HOST_DOCKER_INTERNAL=true \
     kubelens:latest
   ```

2. **Or use host network mode** (Linux only):
   ```bash
   docker run -d --name kubelens --network host \
     -v ~/.kube:/root/.kube:ro \
     -v ~/.minikube:/root/.minikube:ro \
     kubelens:latest
   ```

## 🔍 Troubleshooting

### Check if paths were fixed:
```bash
docker exec kubelens cat /app/backend/configs/minikube-kubeconfig | grep certificate-authority
```

Should show: `certificate-authority: /root/.minikube/ca.crt`

### Check if certificate files exist:
```bash
docker exec kubelens ls -la /root/.minikube/ca.crt
```

### Check connection status:
```bash
docker logs kubelens | grep "Connection test"
```

### Test API:
```bash
curl http://localhost:8081/api/health
```

## 📝 Summary

The application now:
- ✅ Automatically fixes kubeconfig certificate paths
- ✅ Fixes server addresses for container networking
- ✅ Processes all kubeconfig files (new and existing)
- ✅ Works with multiple Kubernetes environments

**Access the UI at**: http://localhost:8081

**Default login**: `admin` / `admin123`


