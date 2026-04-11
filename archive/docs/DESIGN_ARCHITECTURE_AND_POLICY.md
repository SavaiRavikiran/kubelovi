# Kubelens: Full System Design — Multi-Tenant, Policy-Driven

This document describes the architecture, policy engine, Helm configuration, and multi-tenant model for Kubelens. The same container image is used for all clients; all client-specific data is provided via Helm `values.yaml`.

---

## 1. Kubernetes Auto-Discovery

When a client deploys the application in their Kubernetes cluster, the application **automatically detects and displays** cluster resources using the Kubernetes API. All data is **dynamically read** from the cluster; nothing is hardcoded.

### Resources Displayed

| Resource | API / Behaviour | Policy Applied |
|----------|-----------------|----------------|
| **Environments (clusters/contexts)** | Discovered from kubeconfig; only connected contexts returned | User sees only environments their team can access |
| **Nodes** | `GET /api/nodes/:environment` → `coreApi.listNode()` | `hasEnvironmentAccess` only |
| **Namespaces** | `coreApi.listNamespace()` | Filtered by `hasNamespaceAccess` (namespace rules + team pattern) |
| **Pods** | `coreApi.listNamespacedPod(namespace)` | User must have env + namespace access |
| **Containers** | From pod spec (`readNamespacedPod`) | Same as pods |
| **Container filesystem paths** | Exec + list/read paths in container | `validateContainerPath` (allowedPaths / blockedPaths) |
| **Logs** | Kubernetes Logs API + log file paths | Path policy applied to log paths |
| **File download** | Read file in container and stream | `validateContainerPath` before serving |

### Implementation Notes

- **Environments:** `GET /api/environments` — builds list from kubeconfig, tests connectivity, filters by team’s `environments` and (if `dynamicNamespaceFiltering`) by presence of matching namespaces.
- **Nodes:** `GET /api/nodes/:environment` — lists cluster nodes for the environment; access controlled by `hasEnvironmentAccess(team, environment)`.
- **Namespaces:** `GET /api/namespaces/:environment` — lists all namespaces for the environment, then filters with `hasNamespaceAccess(team, environment, namespace)`.
- **Pods / Containers / Paths / Logs / File download:** All relevant routes call `hasEnvironmentAccess`, `hasNamespaceAccess`, and (for paths) `validateContainerPath` before calling the Kubernetes API. Discovery is dynamic; policy only filters what the user is allowed to see.

---

## 2. Client Configuration via Helm

**Principle:** All client-specific configuration is provided through the **Helm `values.yaml`** file. The application image remains **generic**.

### What Clients Configure in values.yaml

- **Teams** — names, list of users per team
- **Users** — membership in teams (via `teams.<id>.users`)
- **Passwords** — in `policyConfig.credentials` (for production, prefer Secrets; see Security Model)
- **Roles** — optional; can be represented as team names or a future `roles` field in the schema
- **Access policies** — environments, namespaces (including patterns), allowed/blocked paths

### Updating Configuration

1. Client edits `values.yaml` (or a client-specific override file, e.g. `novartis-values.yaml`).
2. Run: `helm upgrade --install kubelens ./helm/kubelens -f values.yaml`
3. Helm renders the policy into a ConfigMap and mounts it at `POLICY_CONFIG_PATH`.
4. Backend reads the policy at startup (and on SIGHUP), so new policy is applied after pod restart or reload.

No code changes or client-specific builds are required.

---

## 3. Team-Based Access Control

Clients define **teams** and **access permissions** entirely in `values.yaml`.

### Capabilities

- **Create teams** — add entries under `policyConfig.teams`.
- **Assign users to teams** — set `teams.<teamId>.users: ["user1", "user2"]`.
- **Define what each team can access** — per team:
  - **Environments:** `environments: "*"` or list of environment names.
  - **Namespaces:** `namespaces: "*"` or per-env list, plus optional `dynamicNamespaceFiltering` + `namespacePattern` (and global `namespaceRules`).
  - **Paths:** `allowedPaths` and `blockedPaths` for container filesystem and logs.

### What Is Restricted or Allowed

| Resource | How | Config Key(s) |
|----------|-----|----------------|
| Namespaces | Which namespaces the team can see | `namespaceRules`, `namespaces`, `namespacePattern`, `dynamicNamespaceFiltering` |
| Pods | Implicit: only in allowed namespaces | Same as namespaces |
| Containers | Implicit: only in allowed pods | Same |
| Container filesystem paths | Explicit allow/block list | `allowedPaths`, `blockedPaths` |
| Logs | Same as path access | `allowedPaths`, `blockedPaths` |
| File downloads | Same as path access | `allowedPaths`, `blockedPaths` |

The application **only interprets and enforces** these rules; it does not contain client-specific team or namespace names.

---

## 4. Namespace Matching Logic (Client-Defined)

Clients define **namespace matching rules** in `values.yaml`. The application does **not** hardcode namespace names or patterns.

### Example: Team “esops” Sees All Namespaces Containing “esops”

**Requirement:** Team `esops` should see namespaces such as `dev-esops`, `qa-esops`, `prod-esops`.

**Configuration in values.yaml:**

```yaml
policyConfig:
  teams:
    esops:
      name: Esops Team
      users: ["esops-user", "esops-lead"]
      environments: "*"
      namespaces: "*"
      dynamicNamespaceFiltering: true
      namespacePattern: "esops"   # → namespace must contain "esops"
      includeEnvironmentPattern: true  # optional: also match env name in namespace
```

**Behaviour:**

- The backend uses `team.namespacePattern` and `team.dynamicNamespaceFiltering` in `hasNamespaceAccess` and when filtering lists (e.g. environments, namespaces).
- A namespace is allowed if its name (lowercased) **contains** the pattern (e.g. `esops`). So `dev-esops`, `qa-esops`, `prod-esops` all match.
- No “esops” string is hardcoded in application code; the pattern comes only from config.

### Alternative: Global Namespace Rules

For shared or cross-team namespace rules, use `namespaceRules`:

```yaml
policyConfig:
  namespaceRules:
    - pattern: ".*esops.*"
      teams: ["esops"]
    - pattern: ".*otds.*"
      teams: ["*"]
```

- **pattern** — regex or substring (if regex fails, substring match is used).
- **teams** — list of team ids, or `["*"]` for all teams.

Evaluation order in the backend: (1) global `namespaceRules`, (2) team prefix in namespace name, (3) per-team `namespacePattern` / `dynamicNamespaceFiltering`, (4) static `team.namespaces` list, (5) `namespaces: "*"`.

---

## 5. Configuration Separation

The application code **must not** contain:

- Client usernames  
- Client passwords  
- Team definitions  
- Namespace rules  
- Access policies (path allow/block, env/ns lists)

**All of these** come from the policy file that Helm generates from `values.yaml` and mounts at `POLICY_CONFIG_PATH`. The code only:

- Loads policy from that path.
- Resolves the current user to a team using policy data.
- Applies generic logic: “does this team have access to this environment/namespace/path?” using policy fields.

This keeps the **same container image** usable for multiple clients with different policies.

---

## 6. Policy Engine

The policy engine is the set of logic that **reads configuration from Helm** (via the mounted policy file) and **applies** it to every relevant request.

### Data Flow

```
Helm values.yaml (policyConfig)
        ↓
ConfigMap (policy.json) mounted at POLICY_CONFIG_PATH
        ↓
Backend: loadPolicyConfig() at startup / SIGHUP
        ↓
In-memory policy: getPolicyConfig()
        ↓
For each request: resolve user → team → check env / ns / path
```

### Components

| Component | Responsibility |
|-----------|----------------|
| **getPolicyConfigPath()** | Returns `process.env.POLICY_CONFIG_PATH` or default path (e.g. `../config/teams.json` for dev). |
| **loadPolicyConfig()** | Reads and parses JSON; returns `{ teams, credentials, namespaceRules, tools?, credentialsPolicy? }`. |
| **getPolicyConfig()** | Returns current in-memory policy. |
| **resolve user → team** | Login checks `credentials[username]`; team is determined by which `teams.<id>.users` contains the username. |
| **hasEnvironmentAccess(team, environment)** | Uses `team.environments` (`"*"` or list). |
| **hasNamespaceAccess(team, environment, namespace)** | Uses `namespaceRules`, team prefix, `team.namespacePattern` / `dynamicNamespaceFiltering`, `team.namespaces`. |
| **validateContainerPath(path, userTeam)** | Uses `team.allowedPaths` and `team.blockedPaths`. |

### UI Visibility and API Permissions

- **Backend API:** Every endpoint that exposes environments, namespaces, pods, paths, logs, or file download calls the above helpers. No policy data is hardcoded; visibility is fully driven by policy.
- **UI:** The frontend typically calls the same APIs; the backend returns only what the user is allowed to see (e.g. filtered list of environments and namespaces). Optionally, the backend can expose a minimal “my permissions” summary for UI hints.

---

## 7. Security Model

| Concern | Approach |
|--------|----------|
| **Role-Based Access Control** | Teams act as roles; permissions are defined per team in policy (env, ns, paths). Optional future: explicit `roles` field and role-based checks. |
| **Secure authentication** | Session-based auth; credentials checked against policy. Use HTTPS and secure cookies in production. |
| **Encrypted credentials** | Passwords in values end up in ConfigMaps (base64 in etcd). For production: store credentials in Kubernetes Secrets or use an external secret store (e.g. Vault, External Secrets Operator) and inject into the policy or env. |
| **Controlled Kubernetes API access** | The application uses a single kubeconfig or in-cluster ServiceAccount. Restrict that identity with Kubernetes RBAC (list/read only where needed; no write unless required). |

---

## 8. Expected Outputs

### 8.1 Full System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT A / B / C (each has own values.yaml)                     │
│  teams, users, credentials, namespace rules, allowedPaths, etc.  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ helm install / helm upgrade
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  KUBERNETES CLUSTER                                              │
│  ┌──────────────────┐    ┌────────────────────────────────────┐  │
│  │ ConfigMap        │    │ Deployment (same image)             │  │
│  │ policy.json      │───▶│ POLICY_CONFIG_PATH                 │  │
│  │ (from values)    │    │ Backend + Frontend                  │  │
│  └──────────────────┘    │ • Load policy at startup / SIGHUP   │  │
│                          │ • Policy engine enforces every API  │  │
│                          │ • K8s API: envs, ns, pods, logs,    │  │
│                          │   files (filtered by policy)        │  │
│                          └────────────────────────────────────┘  │
│                                          │                       │
│                                          ▼                       │
│                          ┌────────────────────────────────────┐  │
│                          │ Kubernetes API                       │  │
│                          │ (Nodes, Namespaces, Pods, Logs,     │  │
│                          │  Exec for paths/files)               │  │
│                          └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Policy Engine Architecture

```
                    ┌─────────────────────────────────────┐
                    │  Helm values.yaml (per client)       │
                    │  policyConfig: teams, credentials, │
                    │  namespaceRules, allowedPaths, ...   │
                    └─────────────────┬───────────────────┘
                                      │ render & mount
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  POLICY_CONFIG_PATH (policy.json)   │
                    └─────────────────┬───────────────────┘
                                      │ read at startup / SIGHUP
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  POLICY ENGINE (application)                                          │
│  • getPolicyConfig()           → in-memory policy                    │
│  • resolve user → team        → credentials + teams[].users         │
│  • hasEnvironmentAccess(team, env)                                   │
│  • hasNamespaceAccess(team, env, ns) ← namespaceRules + pattern      │
│  • validateContainerPath(path, team) ← allowedPaths / blockedPaths    │
└─────────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
     API: env/ns          API: pods/paths       UI visibility
     filtered by policy   filtered by policy    (data from API)
```

### 8.3 Helm values.yaml Schema

```yaml
# Optional: override mount path
policyConfigPath: "/app/backend/config/policy.json"

policyConfig:
  # Global namespace rules (pattern + teams)
  namespaceRules:
    - pattern: ".*regex-or-substring.*"
      teams: ["teamId1", "teamId2"]  # or ["*"] for all teams

  # Optional: allowed tools (future)
  tools: ["kubernetes"]
  credentialsPolicy: {}

  teams:
    <teamId>:
      name: "Display Name"
      users: ["user1", "user2"]
      environments: "*" | ["env1", "env2"]
      namespaces: "*" | { "env1": ["ns1"], "env2": ["ns2"] }
      # Client-defined namespace matching (e.g. *esops*)
      dynamicNamespaceFiltering: true
      namespacePattern: "esops"
      includeEnvironmentPattern: true
      allowedPaths: ["/app/*", "/data/*/logs/*"]
      blockedPaths: []

  credentials:
    <username>: "<password>"
```

### 8.4 Example values.yaml for Two Different Clients

**Client 1 (Novartis-style):** See `helm/kubelens/novartis-values.yaml` — multiple teams (otds, subway, apqr, aronda, condor, coredox, d4n, esops, midocs, switchgear, toqdox, admin, explorer) with per-team `namespacePattern`, shared `namespaceRules`, and path lists.

**Client 2 (minimal):**

```yaml
policyConfig:
  namespaceRules: []
  tools: ["kubernetes"]
  credentialsPolicy: {}
  teams:
    esops:
      name: Esops Team
      users: ["esops-user"]
      environments: "*"
      namespaces: "*"
      dynamicNamespaceFiltering: true
      namespacePattern: "esops"
      includeEnvironmentPattern: true
      allowedPaths: ["/app/*", "/var/log/*"]
      blockedPaths: []
    admin:
      name: Admin
      users: ["admin"]
      environments: "*"
      namespaces: "*"
      allowedPaths: ["*"]
      blockedPaths: []
  credentials:
    esops-user: "SecurePassword123"
    admin: "AdminPassword"
```

Same image; only the values file (or override) differs.

### 8.5 Namespace Rule Matching Design

**Order of evaluation in `hasNamespaceAccess`:**

1. **Global `namespaceRules`:** For each rule, if the namespace matches `pattern` (regex or substring) and `teams` includes the user’s team (or `"*"`), **allow**.
2. **Team name prefix:** If the namespace (lowercased) starts with the team’s first word (e.g. “condor”) or contains `-<prefix>`, **allow**.
3. **Per-team pattern:** If `team.dynamicNamespaceFiltering` and `team.namespacePattern` are set, **allow** if the namespace (and optionally environment) contains that pattern (e.g. `esops` → `dev-esops`, `qa-esops`).
4. **Static list:** If `team.namespaces` is an object keyed by environment, **allow** if the namespace is in the list for that environment.
5. **Wildcard:** If `team.namespaces === "*"` and none of the above applied, **allow**.
6. Otherwise **deny**.

All patterns and team names come from the policy file (Helm values); nothing is hardcoded.

### 8.6 Folder Structure (Application)

```
kubelens/
├── backend/
│   ├── api/
│   │   ├── server.js              # Policy load, auth, env/ns/path checks, main APIs
│   │   ├── explorer-routes.js     # Explorer (nodes, deployments, etc.)
│   │   └── public/                # Frontend build
│   ├── config/
│   │   ├── teams.json             # Default policy (dev only; overridden by Helm)
│   │   └── configs/               # Kubeconfig(s)
│   └── ...
├── src/
│   ├── App.tsx
│   ├── components/                # LogBrowser, LoginForm, AdminDashboard, ...
│   └── pages/                     # Explorer
├── helm/
│   └── kubelens/
│       ├── Chart.yaml
│       ├── values.yaml            # Default policy schema
│       ├── novartis-values.yaml   # Example client 1
│       ├── example-client-b-values.yaml  # Example client 2
│       └── templates/
│           ├── configmap-policy.yaml
│           ├── deployment.yaml
│           ├── service.yaml
│           └── _helpers.tpl
├── docs/
│   └── DESIGN_ARCHITECTURE_AND_POLICY.md  # This document
└── ...
```

### 8.7 Multi-Tenant Deployment Model

- **One image:** Single container image for all clients.
- **One chart:** Same `helm/kubelens` chart.
- **Per-tenant:** One Helm release per client (or per cluster), each with its own values file (e.g. `novartis-values.yaml`, `client-b-values.yaml`).
- **Per-tenant policy:** The chart renders `policyConfig` into a ConfigMap and mounts it at `POLICY_CONFIG_PATH`. The backend loads it at startup and on SIGHUP.
- **Kubernetes access:** Either in-cluster (one cluster per tenant) or kubeconfig pointing at the tenant’s cluster; the policy then restricts what each team can see within that cluster.

The result is multiple clients using the **same application image** with **different configurations and security policies** defined only in Helm values.
