# Kubelens Helm Chart

Policy-driven Kubernetes log browser. **Same image for all clients**; access is controlled by `values.yaml` (policy config).

**Default behavior:** Login `admin` / `Wellcome@2026`, all cluster resources visible, no teams beyond admin, no access or path restrictions. Team creation and access control (allow/restrict) are applied via each client’s Helm values file.

For full system architecture, policy engine, Helm schema, namespace rule design, and multi-tenant model, see [docs/DESIGN_ARCHITECTURE_AND_POLICY.md](../../docs/DESIGN_ARCHITECTURE_AND_POLICY.md).

## Quick start

```bash
# Default values
helm install kubelens ./kubelens

# Client-specific policy (examples included)
helm install kubelens ./kubelens -f novartis-values.yaml
helm install kubelens ./kubelens -f example-client-b-values.yaml
```

## Policy config (client-specific)

All policy is under `policyConfig` in `values.yaml`. It is rendered to a JSON file and mounted at `POLICY_CONFIG_PATH` (default `/app/backend/config/policy.json`). The backend loads it at startup and on SIGHUP.

| What you control | Where in `policyConfig` | Backend behavior |
|------------------|-------------------------|------------------|
| **Namespaces** (who sees which) | `namespaceRules`: `{ pattern, teams }`; per-team `namespaces` / `namespacePattern` / `dynamicNamespaceFiltering` | `hasNamespaceAccess` / `hasNamespaceAccess` (unchanged logic) |
| **Environments / clusters** | Per-team `environments` | `hasEnvironmentAccess` |
| **File paths** | Per-team `allowedPaths` / `blockedPaths` | `validateContainerPath` |
| **Tools** (future) | `tools`: e.g. `["kubernetes"]` | Stub only today |
| **Credentials / secrets** (future) | `credentialsPolicy` | Stub only today |
| **Teams and users** | `teams`, `credentials` | Auth and team resolution |

## Customizing for a client

1. Copy or override `values.yaml`.
2. Set `policyConfig.teams`, `policyConfig.credentials`, and optionally `policyConfig.namespaceRules`, `policyConfig.tools`, `policyConfig.credentialsPolicy`.
3. Set `image.repository` and `image.tag` if using your own registry.
4. Install/upgrade: `helm upgrade --install kubelens ./kubelens -f client-values.yaml`.

To change policy without rebuilding the image, update the ConfigMap (or values and upgrade) and either restart the pod or send SIGHUP to the backend so it reloads policy.

## Values of interest

| Value | Default | Description |
|-------|---------|-------------|
| `policyConfigPath` | `/app/backend/config/policy.json` | Path inside the container where policy JSON is mounted |
| `policyConfig` | (see values.yaml) | Full policy document (teams, credentials, namespaceRules, tools, credentialsPolicy) |
| `replicaCount` | 1 | Number of replicas |
| `image.repository` | kubelens | Image name |
| `image.tag` | latest | Image tag |
| `service.port` | 3006 | Service port |
