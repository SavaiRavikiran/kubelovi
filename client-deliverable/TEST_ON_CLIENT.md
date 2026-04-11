# Test Kubelens on client machine

You have received the **Kubelens Helm chart** and a **values file**. No application source code is included.

## Prerequisites on client machine

- Kubernetes cluster (or minikube) with `kubectl` and `helm` installed
- Network access to pull the image (Docker Hub or your registry)

## Steps

### 1. Go to the deliverable folder

```bash
cd client-deliverable
```

### 2. (Optional) Edit the values file

Edit `kubelens-client/client-values.yaml` to:

- Set `image.repository` and `image.tag` if your vendor gave you a different image
- Adjust `policyConfig.teams` and `policyConfig.credentials` for your teams and passwords
- Adjust `policyConfig.namespaceRules` and per-team `namespacePattern` / `allowedPaths` / `blockedPaths` as needed

### 3. Install or upgrade Kubelens

```bash
helm upgrade --install kubelens ./kubelens-client -f ./kubelens-client/client-values.yaml -n kubelens --create-namespace
```

### 4. If using in-cluster (e.g. minikube or same cluster)

RBAC is created by default (`rbac.create: true`). No kubeconfig mount is required; the app uses the cluster’s service account.

### 5. If connecting to a different cluster

Create a Secret with your kubeconfig and set in `client-values.yaml`:

```yaml
kubeconfig:
  secretName: "your-kubeconfig-secret"
  mountPath: /root/.kube
```

Create the secret:

```bash
kubectl create secret generic your-kubeconfig-secret --from-file=config=/path/to/kubeconfig -n kubelens
```

### 6. Access the application

- **ClusterIP (default):**  
  `kubectl port-forward svc/kubelens-kubelens-client 3006:3006 -n kubelens`  
  Then open http://localhost:3006

- **If you set `service.type: NodePort`:**  
  `kubectl get svc -n kubelens` to get the NodePort, or  
  `minikube service kubelens-kubelens-client -n kubelens` (minikube)

### 7. Log in

Use the username and password from `policyConfig.credentials` in your values file (e.g. admin, or any team user you defined).
