# Migrate Old Helm Chart (helm-kubelens-logging) to New (kubelens-client)

This guide lists **all changes** needed to turn the old `helm-kubelens-logging` chart into the new policy-driven `kubelens-client` chart so that:

- The **same image** is used for all clients (no app source on client).
- **Teams, credentials, namespace rules, and container path access** are configured only via `values.yaml` / client values files (e.g. `novartis-values.yaml`).

---

## 1. High-level differences

| Aspect | Old chart (helm-kubelens-logging) | New chart (kubelens-client) |
|--------|-----------------------------------|-----------------------------|
| **Policy / teams** | None in chart; app may use defaults | `policyConfig` in values → ConfigMap `policy.json` mounted in pod |
| **Values files** | `values.yaml` + env-specific (`values-sbx.yaml`, `values-devint.yaml`, etc.) with namespace, image, ingress | Single `values.yaml` + client override (e.g. `novartis-values.yaml`) with `policyConfig` (teams, credentials, namespaceRules, paths) |
| **RBAC** | `rbac.create` + `rbac.clusterWide`; SA name from `serviceAccount.name` | `rbac.create` only; SA name = release fullname; ClusterRole includes nodes, batch, networking, custom resources |
| **Deployment** | `env` from values map; uploads volume; probes use `livenessProbe.path` / `readinessProbe.path` | `POLICY_CONFIG_PATH` env; policy ConfigMap volume; optional kubeconfig volume; probes use path `/` |
| **Service** | Fixed name `kubelens-svc`, selector `app: kubelens` | Name and selector from Helm fullname/labels |
| **Ingress** | In chart; uses `kubelens_host`, `ingress_class` | Not in chart; client can add their own Ingress |
| **Chart name** | `kubelens` | `kubelens-client` (or keep name, optional) |

---

## 2. Add new files

### 2.1 ConfigMap for policy

**New file:** `templates/configmap-policy.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "kubelens.fullname" . }}-policy
  labels:
    {{- include "kubelens.labels" . | nindent 4 }}
data:
  policy.json: |
{{ .Values.policyConfig | toJson | indent 4 }}
```

This mounts the policy (teams, credentials, namespace rules, path access) into the pod.

---

## 3. Changes to existing templates

### 3.1 `templates/deployment.yaml`

- **ServiceAccount:** Use the same name as the one created by the chart (fullname), and only when RBAC is enabled:
  - Replace `serviceAccountName: {{ .Values.serviceAccount.name }}` with:
    ```yaml
    {{- if .Values.rbac.create }}
    serviceAccountName: {{ include "kubelens.fullname" . }}
    {{- end }}
    ```
- **Env:** Keep `NODE_ENV` and `PORT`; **add**:
  ```yaml
  - name: POLICY_CONFIG_PATH
    value: {{ .Values.policyConfigPath | quote }}
  ```
  Remove the `{{- range $k, $v := .Values.env }}` block if you drive everything from policy; otherwise keep it and add `POLICY_CONFIG_PATH` as above.
- **Volume mounts:** Add policy config mount (required):
  ```yaml
  - name: policy-config
    mountPath: {{ .Values.policyConfigPath | quote }}
    subPath: policy.json
    readOnly: true
  ```
  Add optional kubeconfig mount when ` .Values.kubeconfig.secretName` is set:
  ```yaml
  {{- if .Values.kubeconfig.secretName }}
  - name: kubeconfig
    mountPath: {{ .Values.kubeconfig.mountPath | quote }}
    readOnly: true
  {{- end }}
  ```
- **Volumes:** Add:
  ```yaml
  - name: policy-config
    configMap:
      name: {{ include "kubelens.fullname" . }}-policy
  {{- if .Values.kubeconfig.secretName }}
  - name: kubeconfig
    secret:
      secretName: {{ .Values.kubeconfig.secretName | quote }}
  {{- end }}
  ```
- **Probes:** Use path `/` and port name `http` (and container port 3006) so they work without `/api/health`. Optionally keep probe paths/timings in values.
- **Uploads volume:** Can stay for backward compatibility, or remove if the app no longer needs it.

### 3.2 `templates/service.yaml`

- **Name:** Use `{{ include "kubelens.fullname" . }}` instead of fixed `kubelens-svc`.
- **Selector:** Use standard labels so they match the new deployment:
  ```yaml
  selector:
    app.kubernetes.io/name: {{ include "kubelens.name" . }}
    app.kubernetes.io/instance: {{ .Release.Name }}
  ```
- **Port/spec:** Use values for type and port, e.g.:
  ```yaml
  spec:
    type: {{ .Values.service.type }}
    ports:
      - port: {{ .Values.service.port }}
        targetPort: http
        protocol: TCP
        name: http
  ```

### 3.3 `templates/serviceaccount.yaml`

- **Name:** Use `{{ include "kubelens.fullname" . }}` instead of `{{ .Values.serviceAccount.name }}` so it matches the deployment’s `serviceAccountName`.
- **Condition:** Create only when RBAC is enabled: `{{- if .Values.rbac.create }}` … `{{- end }}`.

### 3.4 `templates/clusterrole.yaml`

- **Condition:** Use only `{{- if .Values.rbac.create }}` (remove ` .Values.rbac.clusterWide` so one flag controls RBAC).
- **Name:** Use `{{ include "kubelens.fullname" . }}` (no `-role` suffix) so it matches the new binding.
- **Rules:** Align with new chart so the app can list namespaces, pods, logs, exec, and Explorer resources. Add if missing:
  - `nodes` (get, list, watch)
  - `pods/exec` (create)
  - apps: `daemonsets`, `statefulsets`
  - `batch`: `jobs`, `cronjobs`
  - `networking.k8s.io`: `ingresses`, `networkpolicies`
  - `persistentvolumes`, `persistentvolumeclaims`
  - Custom resources: `apiGroups: ["*"], resources: ["*"], verbs: ["get", "list", "watch"]`

(You can copy the full `rules` block from the new chart’s `templates/clusterrole.yaml`.)

### 3.5 `templates/clusterrolebinding.yaml`

- **Condition:** `{{- if .Values.rbac.create }}` (remove dependency on `rbac.clusterWide`).
- **Name:** `{{ include "kubelens.fullname" . }}` (no `-binding` suffix if you want to match new chart).
- **roleRef.name:** `{{ include "kubelens.fullname" . }}` (same as ClusterRole name).
- **subjects:** Use the same SA as in deployment:
  ```yaml
  subjects:
    - kind: ServiceAccount
      name: {{ include "kubelens.fullname" . }}
      namespace: {{ .Release.Namespace }}
  ```

### 3.6 `templates/ingress.yaml`

- **Option A (recommended):** Remove from the chart so the new chart is “client-only” (no ingress). Clients add their own Ingress if needed.
- **Option B:** Keep ingress but make it optional and use a structure like `ingress.enabled`, `ingress.className`, `ingress.hosts`, `ingress.tls` (and avoid chart-specific names like `kubelens_host` / `ingress_class`). Prefer `ingress.className` and list of hosts so env-specific values (e.g. `values-sbx.yaml`) can override.

### 3.7 `templates/_helpers.tpl`

- **Labels:** Prefer the new style so selectors and discovery are consistent:
  ```yaml
  {{- define "kubelens.labels" -}}
  helm.sh/chart: {{ include "kubelens.name" . }}
  app.kubernetes.io/name: {{ include "kubelens.name" . }}
  app.kubernetes.io/instance: {{ .Release.Name }}
  {{- end }}
  ```
- Ensure `kubelens.name` and `kubelens.fullname` exist and match the new chart (e.g. fullname with `fullnameOverride` and release name).

---

## 4. Values structure changes

### 4.1 `values.yaml` (base)

- **Add (required for new behavior):**
  ```yaml
  policyConfigPath: /app/backend/config/policy.json

  policyConfig:
    namespaceRules: []
    tools: [kubernetes]
    credentialsPolicy: {}
    teams:
      admin:
        name: Admin
        users: [admin]
        environments: "*"
        namespaces: "*"
        allowedPaths: ["*"]
        blockedPaths: []
    credentials:
      admin: "Wellcome@2026"
  ```

- **Add (optional but recommended):**
  ```yaml
  rbac:
    create: true

  serviceAccount:
    create: true
    annotations: {}

  kubeconfig:
    secretName: ""
    mountPath: /root/.kube

  service:
    type: ClusterIP
    port: 3006
  ```

- **Keep:** `replicaCount`, `image` (repository, tag, pullPolicy), `imagePullSecrets` (optional).
- **Remove or repurpose:** `namespace` (release namespace is enough unless you need it for RBAC subject), `containerPort` (can hardcode 3006 in deployment), `env` (if you no longer inject env from values), `NODE_TLS_REJECT_UNAUTHORIZED` (prefer not to set in production). Keep `resources`, `livenessProbe`/`readinessProbe` if you want them configurable.
- **Ingress:** Remove `ingress`, `ingress_class`, `kubelens_host` from base values if you removed the ingress template; otherwise keep and document for client overrides.

### 4.2 Environment-specific values (e.g. `values-sbx.yaml`, `values-devint.yaml`)

- **Replace** env-specific overrides (namespace, image, ingress host) with a **single client values file** (e.g. `novartis-values.yaml`) that:
  - Overrides `image` if needed.
  - Sets `policyConfig` with that environment’s **teams, credentials, namespaceRules, and per-team allowedPaths/blockedPaths**.
- So: merge the “environment” concept into **one values file per client/environment** that contains full `policyConfig` plus any `ingress` / `service` overrides if you kept them.

---

## 5. Chart metadata

- **Chart.yaml:** Update `name` to `kubelens-client` (or keep `kubelens`) and bump `version` (e.g. `0.2.0`). Set `appVersion` to the image tag you ship (e.g. `1.0.0` or `v12.0.0`). Description can say “policy-driven deploy from Docker image; configure teams and access via values.”

---

## 6. Checklist summary

| Item | Action |
|------|--------|
| `templates/configmap-policy.yaml` | **Add** (policy ConfigMap). |
| `templates/deployment.yaml` | Add `POLICY_CONFIG_PATH` env; add policy + optional kubeconfig volumes/mounts; set `serviceAccountName` from fullname when `rbac.create`; align selector labels with service. |
| `templates/service.yaml` | Name and selector from fullname/labels; `service.type` and `service.port` from values. |
| `templates/serviceaccount.yaml` | Name = fullname; create only if `rbac.create`. |
| `templates/clusterrole.yaml` | Single condition `rbac.create`; name = fullname; expand rules (nodes, exec, batch, networking, PVs, custom resources). |
| `templates/clusterrolebinding.yaml` | Single condition `rbac.create`; subject SA = fullname, namespace = release namespace. |
| `templates/ingress.yaml` | **Remove** or make generic and optional. |
| `templates/_helpers.tpl` | Labels and naming aligned with new chart. |
| `values.yaml` | Add `policyConfigPath`, `policyConfig`, `rbac`, `serviceAccount`, `kubeconfig`, `service`; remove or simplify env/ingress-specific keys. |
| Env-specific values | Replace with one client values file (e.g. `novartis-values.yaml`) containing full `policyConfig`. |
| `Chart.yaml` | Update name/version/description/appVersion. |

After these changes, the old chart will behave like the new one: same image for all clients, with teams, credentials, namespace rules, and container path access controlled only via `policyConfig` in the client’s values file.
