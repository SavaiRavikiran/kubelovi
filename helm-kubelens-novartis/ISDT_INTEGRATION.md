# Using this chart with company ISDT / Ansible (1117 patch)

This document describes what to change so the **current** Novartis Helm chart (`helm-kubelens-novartis`) works with the company deployment pipeline (patch 1117: Ansible/ISDT, KUBELENS.yml, component_kubelens.yml).

---

## 1. What the patch expects

From `1117.patch` and `KUBELENS.yml`:

- **OCI registry:** `oci://gitlab-registry.d4n-isdt.eu.novartis.net/platform/helm-kubelens-logging`
- **Chart name:** `kubelens` (from `kubelens_helm_name: "kubelens"`)
- **Host (ingress URL):** From `component_kubelens.yml` → `kubelens_host` (e.g. `kubelens.d4n-qa.eu.novartis.net` for non-prod, `kubelens.d4n.eu.novartis.net` for prod)
- **Values passed from KUBELENS.yml** (under key `kubelens:` in the playbook):
  - `image.repository`, `image.tag`, `image.pullPolicy`
  - `replicaCount`
  - `ingress_class` (e.g. `'{{ platf_ingress_class_name }}'` or `nginx`)
  - `ingress.enabled`, `ingress.annotations`
  - `kubelens_host` (single host for ingress)
  - `livenessProbe` / `readinessProbe` (path, initialDelaySeconds, periodSeconds)
  - `serviceAccount.create`, `serviceAccount.name`
  - `rbac.create`, `rbac.clusterWide`
  - `env` (e.g. NODE_ENV, PORT, NODE_TLS_REJECT_UNAUTHORIZED)
  - `resources` (requests/limits)
  - `uploads` (optional)

---

## 2. Changes made in this chart for the platform

So that the **current** chart can be driven by the same values the patch passes, the following are supported:

| Platform key (from KUBELENS.yml) | Chart behavior |
|----------------------------------|-----------------|
| `ingress_class` | Used as **ingress class** when set; overrides `ingress.className`. |
| `kubelens_host` | When set, used as the **single ingress host** (and TLS host); overrides `ingress.hosts` and `ingress.tls.hosts`. |
| `livenessProbe` / `readinessProbe` | Path and timings are read from values; defaults remain `/` and existing delays/periods if not set. |
| `resources` | Applied to the app container when present in values. |
| `env` | Merged into the deployment as extra env vars (e.g. NODE_TLS_REJECT_UNAUTHORIZED). |

So the platform can keep passing `ingress_class`, `kubelens_host`, probes, `resources`, and `env`; the chart will use them.

---

## 3. What you need to do to use this chart

### A. Publish this chart to the OCI path the patch uses

The patch pulls:

- **Repository:** `oci://gitlab-registry.d4n-isdt.eu.novartis.net/platform/helm-kubelens-logging`
- **Chart name:** `kubelens` (this chart’s `name` in `Chart.yaml` is already `kubelens`)

So you need to **publish this chart** (e.g. from this directory) to that OCI location as the chart named `kubelens` (or whatever the playbook uses when running `helm install`). Example (path/version depend on your CI):

```bash
helm package .
helm push kubelens-1.0.0.tgz oci://gitlab-registry.d4n-isdt.eu.novartis.net/platform/helm-kubelens-logging
```

Adjust registry path and version to match your company’s conventions.

### B. Ensure values are merged at **root** (not under `kubelens`)

The playbook may pass values **nested under** `kubelens:` (e.g. `kubelens.image.repository`). This chart expects **root-level** keys: `image.repository`, `ingress_class`, `kubelens_host`, etc.

You have two options:

- **Option 1 (recommended):** In the Ansible/Helm flow, merge the contents of `kubelens:` to the **root** of the values passed to `helm install`/`helm upgrade`, so the chart receives `image`, `ingress_class`, `kubelens_host`, etc. at the top level.
- **Option 2:** Keep passing a file where the top-level key is `kubelens` and the chart is installed with a **subchart or wrapper** that maps `kubelens.*` → root (e.g. a parent chart that sets values from `kubelens`). This chart itself does not read `kubelens.*`.

### C. KUBELENS.yml shape that matches this chart

So that the same file works with this chart, pass **root-level** keys. Example (aligned with patch + this chart):

```yaml
# Values for helm-kubelens-novartis (root-level keys)
image:
  repository: iitrkp/kubelovi
  tag: "latest"
  pullPolicy: IfNotPresent

replicaCount: 1
ingress_class: '{{ platf_ingress_class_name }}'
kubelens_host: '{{ kubelens_host }}'

ingress:
  enabled: true
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "false"

livenessProbe:
  path: /api/health
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  path: /api/health
  initialDelaySeconds: 5
  periodSeconds: 5

serviceAccount:
  create: true
  name: kubelens-sa
rbac:
  create: true

env:
  NODE_ENV: "production"
  PORT: "3006"
  NODE_TLS_REJECT_UNAUTHORIZED: "0"

resources:
  requests:
    memory: "512Mi"
    cpu: "300m"
  limits:
    memory: "2Gi"
    cpu: "1500m"
```

- `kubelens_host` and `ingress_class` come from your inventory (e.g. `component_kubelens.yml` and platform vars).
- Policy (teams, credentials, namespace rules) stays in the chart’s default `values.yaml`; the platform only overrides image, ingress, probes, resources, env.

### D. component_kubelens.yml

Keep (or set) the repository and chart name so they point at the chart you published:

```yaml
kubelens_helm_repository: "oci://gitlab-registry.d4n-isdt.eu.novartis.net/platform/helm-kubelens-logging"
kubelens_helm_name: "kubelens"
kubelens_host: "{% if env_name == 'prod' %}kubelens.{{ host_instance }}{{ company_domain }}{% else %}kubelens.{{ host_instance }}-{{ env_name }}{{ company_domain }}{% endif %}"
```

No change needed if the playbook already uses these variables to run Helm and to pass `kubelens_host` into the values.

---

## 4. Summary: what to change

| Where | What to change |
|-------|----------------|
| **This chart** | Already updated: supports `ingress_class`, `kubelens_host`, configurable probes, `resources`, `env`. |
| **CI / release** | Publish this chart to `oci://.../platform/helm-kubelens-logging` (or the path your patch uses) as chart name `kubelens`. |
| **Ansible / playbook** | Ensure the values passed to Helm are at **root** (not under `kubelens:`), or add a wrapper that maps `kubelens.*` → root. |
| **KUBELENS.yml** | Use root-level keys as in the example above; keep `ingress_class` and `kubelens_host` from inventory. |
| **component_kubelens.yml** | Point `kubelens_helm_repository` / `kubelens_helm_name` at the published chart; keep `kubelens_host` as today. |

After that, the **current** company Helm chart (this repo) can be used with the same pipeline as in the 1117 patch.
