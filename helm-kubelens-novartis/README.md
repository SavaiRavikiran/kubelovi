# Kubelens – Novartis (ready to run)

This Helm chart is **fully configured for Novartis**. Copy this folder to the client machine and install with the matching **values file** for each environment.

## Prerequisites

- Kubernetes cluster with `kubectl` and `helm` installed
- Network access to pull the image `iitrkp/test-kubelens:v13.0.0` (or your registry)
- **Ingress class `nginx`** (community `ingress-nginx`) – env values use this by default

## Install (use the env values file)

**SBX (recommended command):**
```bash
helm upgrade --install apps-sbxkubelens ./helm-kubelens-novartis -n apps-sbxkubelens --create-namespace -f ./helm-kubelens-novartis/values-sbx.yaml
```

| Env    | Command uses `-f`     | Namespace            | Host (open in browser*) |
|--------|------------------------|----------------------|---------------------------|
| **dev**    | `values-dev.yaml`    | `apps-devkubelens`    | `kubelens.d4n-dev.eu.novartis.net` |
| **devint** | `values-devint.yaml` | `apps-devintkubelens` | `kubelens.d4n-devint.eu.novartis.net` |
| **sbx**    | `values-sbx.yaml`    | `apps-sbxkubelens`    | `kubelens.d4n-sbx.eu.novartis.net` |
| **qa**     | `values-qa.yaml`     | `apps-qakubelens`     | `kubelens.d4n-qa.eu.novartis.net` |
| **prod**   | `values-prod.yaml`   | `apps-prodkubelens`   | `kubelens.d4n.eu.novartis.net` |

### Why `curl https://…` or the browser shows **404** (nginx)

With **TLS disabled** on the Ingress, **ingress-nginx only registers your hostname on port 80**. Traffic to **https:// (443)** hits the controller’s **default SSL server**, which has **no route** for your host → **404**.

| What you want | What to do |
|----------------|------------|
| **Quick test** | Use **HTTP:** `curl -v http://kubelens.d4n-sbx.eu.novartis.net/` or open `http://…` in the browser (port **80**). |
| **HTTPS (443)** | Create a TLS secret, then deploy with TLS enabled (see below). |

**HTTPS setup (SBX):**
```bash
cd helm-kubelens-novartis
chmod +x scripts/create-tls-secret.sh
NAMESPACE=apps-sbxkubelens RELEASE=apps-sbxkubelens HOST=kubelens.d4n-sbx.eu.novartis.net ./scripts/create-tls-secret.sh
helm upgrade --install apps-sbxkubelens . -n apps-sbxkubelens -f values-sbx-https.yaml
```
Browsers will warn on the self-signed cert until you replace it with a corporate cert (`kubectl create secret tls …` with your real cert).

**QA example:**
```bash
helm upgrade --install apps-qakubelens ./helm-kubelens-novartis -n apps-qakubelens --create-namespace -f ./helm-kubelens-novartis/values-qa.yaml
```

## Port mismatch (nginx 404 / app not reachable)

The Service and Ingress must use the **same port the Node process listens on**.

- If pod logs say **`Backend API running on port 3006`** → default chart is correct.
- If logs say **`port 3000`** while the Service targets **3006**, Ingress hits nothing useful → **404** from nginx.

**Fix A (recommended):** Build and deploy a new image from this repo (entrypoint forces **3006** in-cluster when `PORT` was wrong or missing).

**Fix B (no rebuild):** Point the chart at port **3000** to match a broken/old image:

```bash
helm upgrade apps-sbxkubelens ./helm-kubelens-novartis -n apps-sbxkubelens -f values-sbx.yaml \
  --set service.port=3000
```

Do **not** set `env.PORT` to a value that disagrees with `service.port`.

## If the URL still fails

1. **Duplicate host** – If Ingress events say *“All hosts are taken by other resources”*, another Ingress already uses that hostname. Find and remove the old one:
   ```bash
   kubectl get ingress -A | grep kubelens
   ```
   Uninstall the old Helm release or delete the duplicate Ingress.

2. **HTTPS without TLS on Ingress** – Browsers using `https://` directly to the Ingress may fail until you either:
   - Use **http://** to the same host (port 80), or  
   - Enable TLS after creating a secret:
     ```bash
     kubectl create secret tls my-kubelens-tls --cert=tls.crt --key=tls.key -n apps-sbxkubelens
     ```
     Then upgrade with:
     ```bash
     helm upgrade apps-sbxkubelens ./helm-kubelens-novartis -n apps-sbxkubelens -f values-sbx.yaml \
       --set ingress.tls.enabled=true --set ingress.tls.secretName=my-kubelens-tls
     ```

3. **Wrong Ingress class** – This chart defaults to **`nginx`** (not `nginx-plus`). If you must use `nginx-plus`, override: `--set ingress.className=nginx-plus` and ensure TLS is configured for that controller.

## Access via port-forward (always works)

```bash
kubectl port-forward svc/<release-name> 3006:3006 -n apps-sbxkubelens
```
Then open **http://localhost:3006** (release name is often `apps-sbxkubelens` or `kubelens`).

## Logins

| User | Purpose |
|------|---------|
| **admin** | Admin Team (password in `values.yaml` → `policyConfig.credentials`) |
| **explorer** | K8s Explorer |
| Team users | e.g. **aronda-user**, **otds-user** |

## Optional: different target cluster (kubeconfig)

```bash
kubectl create secret generic novartis-kubeconfig --from-file=config=/path/to/kubeconfig -n apps-sbxkubelens
helm upgrade --install apps-sbxkubelens ./helm-kubelens-novartis -n apps-sbxkubelens -f values-sbx.yaml --set kubeconfig.secretName=novartis-kubeconfig
```

## Upgrade / uninstall

```bash
helm upgrade apps-sbxkubelens ./helm-kubelens-novartis -n apps-sbxkubelens -f values-sbx.yaml
helm uninstall apps-sbxkubelens -n apps-sbxkubelens
```
