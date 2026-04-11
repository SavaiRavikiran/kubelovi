# Tool Code vs Client Deliverable

This document defines what stays in the **product/tool repository** (your codebase) and what you **give to the client** (e.g. Novartis) so they can deploy and customize Kubelens on their machine without any application source code.

---

## 1. KEEP IN TOOL REPO (product code)

Everything needed to **build, release, and maintain** the application. The client never needs this.

| Location | Purpose |
|----------|---------|
| **`src/`** | Frontend (React, UI, LogPortal, LogBrowser, AdminDashboard, Explorer) |
| **`backend/`** | Backend API (server.js, kubeconfig-handler, explorer-routes, middleware, utils) |
| **`public/`** | Static assets (favicon, etc.) |
| **`index.html`**, **`vite.config.ts`**, **`tailwind.config.ts`**, **`tsconfig*.json`**, **`postcss.config.js`**, **`eslint.config.js`** | Frontend build config |
| **`package.json`**, **`package-lock.json`** | Frontend dependencies |
| **`backend/package.json`**, **`backend/package-lock.json`** | Backend dependencies |
| **`Dockerfile`** (repo root) | Builds the image used by all clients |
| **`backend/config/teams.json`** | Default policy shipped inside the image (admin / Wellcome@2026, no restrictions) |
| **`backend/docker-entrypoint*.sh`** | Container entrypoints |
| **`helm/kubelens/`** | Optional: main chart if you use it for building/release; not required for client deploy |
| **`helm/kubelens-client/`** | **Chart source** – you maintain it here, but you **also copy this to the client package** (see below) |
| **`archive/`**, **`docs/`** (other than client instructions) | Historical docs and scripts |

---

## 2. GIVE TO THE CLIENT (client deliverable)

The client only needs:

1. **The Helm chart** to install/upgrade the application (no source code).
2. **Their values file** with teams, credentials, namespace rules, and path restrictions.
3. **Access to the image** (Docker Hub or your registry) – they do not build the image.

### What to put on the client machine

| Item | Description |
|------|-------------|
| **`kubelens-client/`** (entire folder) | Helm chart: `Chart.yaml`, `values.yaml`, `templates/`, `_helpers.tpl`, `README.md` |
| **`kubelens-client/<client>-values.yaml`** | Client-specific values, e.g. `novartis-values.yaml` (teams, credentials, namespace rules, path access) |
| **Optional:** `TEST_ON_CLIENT.md` | Short steps to install and test on their cluster |

The client does **not** receive:

- `src/`, `backend/`, `public/`, root `Dockerfile`, root `package.json`
- Your internal scripts, `archive/`, or application source

### How the client runs it

- They have a Kubernetes cluster (or minikube) and `kubectl` + `helm` installed.
- They copy the chart + their values file to their machine (or you give them a tarball).
- They run:
  ```bash
  helm upgrade --install kubelens ./kubelens-client -f ./kubelens-client/novartis-values.yaml -n kubelens --create-namespace
  ```
- Image is pulled from Docker Hub (or your registry) as specified in their values file; no build on client side.

---

## 3. Summary

| | Tool repo (keep) | Client machine (give) |
|---|------------------|------------------------|
| **Application source** | ✅ Yes | ❌ No |
| **Dockerfile / build** | ✅ Yes | ❌ No |
| **Default policy (teams.json)** | ✅ Yes (in image) | ❌ No |
| **Helm chart `kubelens-client`** | ✅ Yes (maintained here) | ✅ Yes (copy for deploy) |
| **Client values file** | ✅ Yes (e.g. novartis-values.yaml as template) | ✅ Yes (their copy to edit) |
| **Image** | You build and push to registry | They pull (no build) |

---

## 4. Packaging the client deliverable for testing

From the repo root:

```bash
./scripts/package-client-deliverable.sh novartis-values.yaml
```

This creates **`client-deliverable/`** with:

- **`kubelens-client/`** – full Helm chart (templates, Chart.yaml, values.yaml, README)
- **`kubelens-client/client-values.yaml`** – copy of the chosen values file (e.g. Novartis) for the client to edit
- **`TEST_ON_CLIENT.md`** – steps to install and test on the client machine

Create a tarball to transfer to the client:

```bash
tar -czvf client-deliverable.tar.gz client-deliverable
```

Copy **`client-deliverable.tar.gz`** to the client machine. There they run:

```bash
tar -xzvf client-deliverable.tar.gz && cd client-deliverable && cat TEST_ON_CLIENT.md
```

Then follow the steps in `TEST_ON_CLIENT.md` to install with Helm (no application source or image build on the client).
