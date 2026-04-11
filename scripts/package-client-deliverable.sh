#!/usr/bin/env bash
# Package the client deliverable: Helm chart + client values file (no application source).
# Usage: ./scripts/package-client-deliverable.sh [values-file]
#   values-file: e.g. novartis-values.yaml (default) or minikube-test-values.yaml
# Output: client-deliverable/ folder (and optionally client-deliverable.tar.gz)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALUES_FILE="${1:-novartis-values.yaml}"
CHART_SRC="$REPO_ROOT/helm/kubelens-client"
VALUES_SRC="$REPO_ROOT/helm/kubelens-client/$VALUES_FILE"
OUT_DIR="$REPO_ROOT/client-deliverable"

if [ ! -d "$CHART_SRC" ]; then
  echo "Error: Chart not found at $CHART_SRC"
  exit 1
fi
if [ ! -f "$VALUES_SRC" ]; then
  echo "Error: Values file not found: $VALUES_SRC"
  exit 1
fi

echo "=== Packaging client deliverable ==="
echo "Chart: $CHART_SRC"
echo "Values: $VALUES_FILE"
echo "Output: $OUT_DIR"
echo ""

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Copy entire Helm chart
cp -R "$CHART_SRC" "$OUT_DIR/kubelens-client"
# Copy the chosen values file to a clear name for the client
cp "$VALUES_SRC" "$OUT_DIR/kubelens-client/client-values.yaml"

# Add short test instructions for client machine
cat > "$OUT_DIR/TEST_ON_CLIENT.md" << 'INSTRUCTIONS'
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
INSTRUCTIONS

echo "Created: $OUT_DIR/"
echo "  - kubelens-client/     (Helm chart)"
echo "  - kubelens-client/client-values.yaml  (copy of $VALUES_FILE)"
echo "  - TEST_ON_CLIENT.md    (steps to test on client machine)"
echo ""
echo "To create a tarball for transfer:"
echo "  tar -czvf client-deliverable.tar.gz -C $REPO_ROOT client-deliverable"
echo ""
echo "On the client machine, extract and run:"
echo "  tar -xzvf client-deliverable.tar.gz && cd client-deliverable && cat TEST_ON_CLIENT.md"
echo ""
