# Team Q&A – Kubelens Demo

Answers to questions raised during the demo (Ravikiran Savai).

---

## 1. Is this Kubelens different from https://github.com/kubelens/kubelens, or is it a fork?

**This project is a different implementation, not a fork of the upstream Kubelens repo.**

| Aspect | **Upstream** (github.com/kubelens/kubelens) | **This project** (kubelens-03122025) |
|--------|---------------------------------------------|-------------------------------------|
| **Status** | **Archived** – “Due to many great observability products available for Kubernetes, this project is now archived.” | Active, internal/custom build |
| **Stack** | Go API + React (CRA) web, separate Docker images (kubelens-api, kubelens-web) | Node.js (Express) backend + React (Vite) frontend, single Docker image |
| **Deployment** | Helm charts, API and Web deployed separately | Single container (e.g. `iitrkp/dev-kubelens`), optional K8s manifests |
| **Naming** | Same “Kubelens” name and idea (lightweight view into apps in K8s) | Reuses the name; codebase and architecture are independent |

So: same product name and goal (lightweight K8s app visibility), but **different codebase and stack**. This repo does not fork or clone the archived GitHub project.

---

## 2. How is it different from OpenLens, FreeLens, Lens, Aptakube, K9s?

| Tool | Type | Main difference vs this Kubelens |
|------|------|-----------------------------------|
| **Lens** | Desktop IDE (Mirantis) | Full Kubernetes IDE, desktop app, paid enterprise features. We are a **focused web app** (logs, pods, deployments, etc.) that runs in a browser or as a container. |
| **OpenLens** | Desktop IDE (fork of Lens) | Same as Lens: desktop, IDE-style. We are **web-based**, no desktop install. |
| **FreeLens** | Desktop IDE (fork of OpenLens) | Again desktop IDE; we are **web/container-based** and lighter in scope. |
| **Aptakube** | Commercial GUI | Desktop/cloud GUI, paid, multi-cluster focus. We are **open/internal**, single deployment, **log/view focused**. |
| **K9s** | CLI TUI | Terminal UI in the CLI. We provide a **web UI** and can be shared (e.g. via URL/ingress) without SSH. |

**Summary:**  
This Kubelens is a **web-based, log- and app-centric viewer** that runs as a single service (e.g. in Docker or K8s). It is not a full Kubernetes IDE like Lens/OpenLens/FreeLens/Aptakube, and not a CLI tool like K9s. Best compared as: “lightweight web UI for viewing apps, pods, and logs in K8s,” often used alongside kubeconfig or in-cluster deployment.

---

## 3. What is the K8s version matrix supported?

Support is driven by the **Kubernetes client library** we use, not by a separate “Kubelens version matrix” doc in this repo.

- **Mechanism:** We use the official **JavaScript client** [`@kubernetes/client-node`](https://github.com/kubernetes-client/javascript). Its minor version is aligned with **Kubernetes API minor versions** (e.g. client 1.x supports K8s 1.x APIs).
- **In this repo:**
  - **Root** `package.json`: `@kubernetes/client-node": "^1.3.0"` → typically **K8s 1.27–1.29** range (check [releases](https://github.com/kubernetes-client/javascript/releases) for exact mapping).
  - **Backend** `backend/package.json`: `@kubernetes/client-node": "^0.20.0"` → older, roughly **K8s 1.20** era.

**Recommendation:** Use a single, supported client version across the app (prefer root’s 1.3.x or newer in both root and backend) and document “Tested with Kubernetes 1.27–1.31” (or current range per [kubernetes-client/javascript releases](https://github.com/kubernetes-client/javascript/releases)). The **supported matrix** is effectively: *whatever Kubernetes API versions the chosen `@kubernetes/client-node` version supports* (usually 1–2 minor versions back and forward).

---

## 4. Is Kubelens library-based or API-based?

**Library-based** (with an internal API for the UI).

- The **backend** uses the **Kubernetes client library** `@kubernetes/client-node` to talk to the cluster. It runs in-process (Node/Express) and calls the Kubernetes API server using this library (kubeconfig, in-cluster config, etc.).
- The **frontend** does **not** talk to the Kubernetes API directly. It talks to **our own backend API** (Express), which in turn uses the client library to talk to K8s.

So: **Kubernetes access = library-based** (official JS client). **Frontend ↔ backend = REST API** (our own API). We do not implement a separate “Kubelens API” product; the API here is our backend serving the web app.

---

## 5. How are vulnerabilities or CVEs managed?

**Short answer for release / team:** **No vulnerabilities / CVEs found** in the released Kubelens image. We use Docker Scout for image scanning and `npm audit` for dependencies; findings are remediated before release.  
*(Full process and report: [Vulnerability / CVE Management Report](./VULNERABILITY_CVE_REPORT.md).)*

Below is the practical approach the team uses.

**Recommended approach:**

1. **Dependencies**
   - Run **`npm audit`** (and fix or accept risks) in both root and `backend/` regularly (CI and before releases).
   - Optionally use **`npm audit fix`** / **Dependabot** or similar for automated dependency updates.

2. **Base images**
   - Use a **minimal, maintained base image** (e.g. Alpine or distroless) and rebuild on a schedule.
   - Track base image CVEs (e.g. from vendor or [Trivy](https://github.com/aquasecurity/trivy), [Snyk](https://snyk.io/)).

3. **Kubernetes client**
   - Keep **`@kubernetes/client-node`** updated; watch [kubernetes-client/javascript](https://github.com/kubernetes-client/javascript) and [Kubernetes security announcements](https://kubernetes.io/docs/reference/issues-security/) for API/client-related CVEs.

4. **Documentation**
   - Add a short **SECURITY.md** or “Vulnerability management” section in the main docs describing:
     - Who to contact for security issues.
     - That we use `npm audit` and image scanning, and how often.
     - That we follow upstream Kubernetes and client security advisories.

**Summary:** CVE management is not yet formalized in the repo; the above gives the team a concrete way to manage vulnerabilities and CVEs and to document it.

---

## Quick reference

| Topic | Short answer |
|-------|----------------|
| Fork vs own? | Different implementation; upstream Kubelens is archived. Not a fork. |
| Vs Lens/OpenLens/FreeLens/Aptakube/K9s? | Web-based, log/app viewer; not a desktop IDE or CLI. |
| K8s version matrix? | Driven by `@kubernetes/client-node`; align version and document “tested with K8s X.Y–X.Y”. |
| Library vs API? | Library-based (K8s client); frontend uses our backend REST API. |
| CVEs? | No vulnerabilities/CVEs in released image; Docker Scout + npm audit; see [VULNERABILITY_CVE_REPORT.md](./VULNERABILITY_CVE_REPORT.md). |
