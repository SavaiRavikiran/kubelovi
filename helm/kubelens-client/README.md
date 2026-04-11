# Kubelens Client Helm Chart

Use this chart to deploy **Kubelens from Docker Hub only**. You do **not** need the application source code. The **same image** is used for all clients; each client configures teams, credentials, and access via their own Helm values file.

---

## Default behavior (out of the box)

With the built-in default values (no override file):

- **Login:** Username `admin`, Password `Wellcome@2026`
- **Resources:** All Kubernetes resources in the cluster are visible (no access restrictions)
- **Teams:** Only the built-in admin team; no custom teams
- **Paths:** No container path restrictions (allowedPaths: `["*"]`)

To add custom teams, user credentials, namespace rules, or container path allow/restrict per team, use your own values file (e.g. `my-client-values.yaml`) and override `policyConfig` as described below.

---

## What you get

- **This Helm chart** (the `kubelens-client` folder)
- **A pre-built image** from Docker Hub: `YOUR_DOCKERHUB_ORG/kubelens:<tag>`
- **A values file** (e.g. `novartis-values.yaml`) with your teams, users, and access policies

You do **not** receive or build the application code.

---

## What you need to do

### 1. Get the chart and values

- Obtain the `kubelens-client` Helm chart (this folder).
- Obtain the Novartis values file: `novartis-values.yaml` (in this folder).

### 2. Set your Docker Hub image

In `novartis-values.yaml` (or your copy), set the image your vendor provided:

```yaml
image:
  repository: YOUR_DOCKERHUB_ORG/kubelens   # Replace with actual image, e.g. acme/kubelens
  tag: latest                               # Or a specific version, e.g. 1.0.0
  pullPolicy: IfNotPresent
```

If the image is in a **private registry**, add an imagePullSecret to the Deployment (see Optional below).

### 3. Configure access (policy)

All access control is in `policyConfig` in the values file:

| What to configure | Where in `novartis-values.yaml` |
|-------------------|----------------------------------|
| Teams             | `policyConfig.teams`            |
| Users per team    | `policyConfig.teams.<teamId>.users` |
| Passwords         | `policyConfig.credentials`      |
| Namespace rules   | `policyConfig.namespaceRules` and per-team `namespacePattern` / `dynamicNamespaceFiltering` |
| Allowed/blocked paths | `policyConfig.teams.<teamId>.allowedPaths` and `blockedPaths` |

Edit `novartis-values.yaml` to match your teams, usernames, passwords, and namespace/path rules. The application reads this at startup; no code changes are required.

### 4. Provide kubeconfig to the app (cluster access)

The application needs Kubernetes API access (to list namespaces, pods, logs, files). Use the chart’s optional kubeconfig mount:

1. Create a Secret with your kubeconfig (key must be `config` so the app sees ` /root/.kube/config`):
   ```bash
   kubectl create secret generic novartis-kubeconfig --from-file=config=/path/to/your/kubeconfig -n <namespace>
   ```
2. In `novartis-values.yaml`, set:
   ```yaml
   kubeconfig:
     secretName: "novartis-kubeconfig"
     mountPath: /root/.kube
   ```

If Kubelens runs **in the same cluster** it inspects (e.g. minikube), you can use **in-cluster config** (no kubeconfig mount). The chart creates RBAC (ServiceAccount, ClusterRole, ClusterRoleBinding) by default (`rbac.create: true`) so the app can list namespaces, pods, logs, and run exec. If you deploy with a mounted kubeconfig instead, you can set `rbac.create: false`. Otherwise, the kubeconfig Secret or in-cluster RBAC is required to see any Kubernetes resources.

### 5. Install or upgrade

From the directory that **contains** the `kubelens-client` folder:

```bash
# Install
helm install kubelens ./kubelens-client -f kubelens-client/novartis-values.yaml

# Or upgrade (if already installed)
helm upgrade --install kubelens ./kubelens-client -f kubelens-client/novartis-values.yaml
```

### 6. Apply configuration changes later

To change teams, users, passwords, or access rules:

1. Edit `novartis-values.yaml` (or your override file).
2. Run:

   ```bash
   helm upgrade kubelens ./kubelens-client -f kubelens-client/novartis-values.yaml
   ```

3. Restart the pod (or send SIGHUP if the app supports policy reload) so the new policy is loaded.

---

## Optional

- **Private Docker registry:** Create a Secret and reference it in the Deployment:
  ```bash
  kubectl create secret docker-registry regcred --docker-server=<registry> --docker-username=... --docker-password=...
  ```
  Then in values add something like (and the chart may need a small template change to use it):
  ```yaml
  imagePullSecrets: ["regcred"]
  ```
  If the chart does not support `imagePullSecrets`, add a `deployment.yaml` patch or ask the vendor for a chart that does.

- **Ingress:** To expose the app via Ingress, add an Ingress template to the chart or apply your own Ingress manifest pointing to the Kubelens Service (port 3006).

- **Secrets for passwords:** For production, you can store credentials in a Kubernetes Secret and reference it (e.g. env from Secret) if the application supports it, or use a values file that is itself stored as a Secret and not committed to Git.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Get this chart + `novartis-values.yaml` |
| 2 | Set `image.repository` (and `image.tag`) to your Docker Hub image |
| 3 | Edit `policyConfig` (teams, users, credentials, namespace rules, paths) |
| 4 | Ensure the app has kubeconfig / cluster access (mount or in-cluster) |
| 5 | Run `helm install` or `helm upgrade` with your values file |
| 6 | For future changes, edit values and run `helm upgrade` again |

No application source code is required; everything is driven by the Docker image and the Helm values file.
