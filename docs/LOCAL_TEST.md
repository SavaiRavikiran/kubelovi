# Test Kubelens locally (before cluster deploy)

## 1. Prerequisites

- **Node.js 18+**, `npm`
- **Helm 3** (only to sync policy from the chart)
- **kubectl** + a cluster context (**minikube**, Docker Desktop Kubernetes, or Kind) so the app can list namespaces

## 2. Sync policy (same as Helm chart)

From the repo root:

```bash
chmod +x scripts/sync-local-policy.sh
./scripts/sync-local-policy.sh
```

This writes `backend/config/teams-from-helm.json` (Novartis teams, `namespaceRules`, `namespaceExcludePatterns`).  
**Do not commit this file** (it contains credentials).

## 3. Run app with Novartis policy

```bash
npm install
cd backend && npm install && cd ..
npm run local:dev
```

- **UI:** http://localhost:5173  
- **API:** http://localhost:3006 (proxied as `/api` from Vite)

Log in with a user from the policy (e.g. **apqr-user** / password from `helm-kubelens-novartis/values.yaml` → `policyConfig.credentials`).

## 4. What you can verify locally

- **Namespaces** shown for each team match policy (`hasNamespaceAccess` + hidden `apps-*-kubelens`).
- Your cluster must contain namespaces similar to SBX (e.g. `apqr-*`, `otds-*`) or the lists will be shorter.

## 5. Run the production image locally (Docker)

```bash
docker compose build
docker compose up
```

Open **http://localhost:8081** (mapped to container port 3006).  
Mount policy by editing `docker-compose.yml` to set:

```yaml
environment:
  - POLICY_CONFIG_PATH=/app/backend/config/policy.json
volumes:
  - ./backend/config/teams-from-helm.json:/app/backend/config/policy.json:ro
```

(Run `./scripts/sync-local-policy.sh` first, then adjust the mount path if you use a different filename.)

## 6. Minimal dev (default small policy)

Skip sync and use default `backend/config/teams.json` (admin only):

```bash
npm run dev
```

---

| Command | Policy file | Use case |
|---------|-------------|----------|
| `npm run dev` | `backend/config/teams.json` | Quick UI work |
| `npm run local:dev` | `backend/config/teams-from-helm.json` | Full Novartis namespace rules |
