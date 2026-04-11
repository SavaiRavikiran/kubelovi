# Application File Classification: Critical vs Non-Critical

This document classifies project files by **importance for building, starting, and running** the application.

- **Critical**: Required for the application to build, start, and function. Removing or breaking these will cause build/runtime failures or break core features.
- **Non-Critical**: Not required for current behavior. They can be removed or ignored without affecting the application’s ability to run (e.g. docs, unused UI, sample data, optional tooling).

---

## Critical Files

### Build & configuration (required to build and run)

| File | Purpose |
|------|--------|
| `package.json` | Root npm manifest, scripts, dependencies |
| `package-lock.json` | Lockfile for reproducible installs |
| `vite.config.ts` | Vite bundler configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS (e.g. Tailwind) pipeline |
| `tsconfig.json` | TypeScript project config |
| `tsconfig.app.json` | App TS config (referenced by build) |
| `tsconfig.node.json` | Node/build script TS config |
| `index.html` | HTML entry; root div and script tag |
| `eslint.config.js` | Lint config (often required in CI; optional for local run) |

### Frontend entry & core app

| File | Purpose |
|------|--------|
| `src/main.tsx` | React entry; mounts app and loads global CSS |
| `src/App.tsx` | Root component; routing and global providers |
| `src/index.css` | Global styles and design tokens |
| `src/vite-env.d.ts` | Vite/TS environment types |

### Pages (reachable via routes)

| File | Purpose |
|------|--------|
| `src/pages/Index.tsx` | Home route `/`; renders LogPortal |
| `src/pages/LogView.tsx` | `/log`; log view page |
| `src/pages/NotFound.tsx` | Catch-all `*` route |
| `src/pages/Explorer.tsx` | `/explorer`; Kubernetes Explorer UI |

### Core components (used by pages or App)

| File | Purpose |
|------|--------|
| `src/components/LogPortal.tsx` | Login + post-login routing (LogBrowser / AdminDashboard) |
| `src/components/LoginForm.tsx` | Login form (used by LogPortal) |
| `src/components/LogBrowser.tsx` | Main log browser after login |
| `src/components/AdminDashboard.tsx` | Admin route `/admin` |
| `src/components/ThemeProvider.tsx` | Theme context (wraps App) |
| `src/components/ThemeToggle.tsx` | Theme switch (used in headers) |
| `src/components/LocalLogViewer.tsx` | Used by LogView page |
| `src/components/LogViewer.tsx` | Log viewer (used where log display is needed) |

### UI components (in the import chain from App/pages/core components)

These are imported directly or transitively from the files above:

| File | Purpose |
|------|--------|
| `src/components/ui/button.tsx` | Buttons across app |
| `src/components/ui/card.tsx` | Cards (browsers, login, admin) |
| `src/components/ui/input.tsx` | Text inputs |
| `src/components/ui/label.tsx` | Form labels (e.g. login) |
| `src/components/ui/badge.tsx` | Badges in browsers and admin |
| `src/components/ui/scroll-area.tsx` | Scrollable areas |
| `src/components/ui/separator.tsx` | Dividers (e.g. LogBrowser) |
| `src/components/ui/table.tsx` | Tables (LogBrowser, Explorer) |
| `src/components/ui/tabs.tsx` | Tabs (Explorer) |
| `src/components/ui/select.tsx` | Selects (Explorer) |
| `src/components/ui/sheet.tsx` | Mobile sidebar sheet (Explorer) |
| `src/components/ui/switch.tsx` | Theme toggle |
| `src/components/ui/toast.tsx` | Toast content (used by toaster + useToast) |
| `src/components/ui/toaster.tsx` | Toast container (App) |
| `src/components/ui/sonner.tsx` | Sonner toasts (App) |
| `src/components/ui/tooltip.tsx` | Tooltips (App TooltipProvider) |

### Lib, config, hooks (used by app code)

| File | Purpose |
|------|--------|
| `src/lib/utils.ts` | `cn()` and helpers; used by many UI components |
| `src/lib/table-sort.ts` | Sorting for LogBrowser and Explorer tables |
| `src/config/api.ts` | API base URL and endpoints |
| `src/hooks/use-toast.ts` | Toast API used across app |
| `src/hooks/use-mobile.tsx` | Mobile breakpoint (Explorer, sidebar) |

### Backend (required for API and full app behavior)

| File | Purpose |
|------|--------|
| `backend/package.json` | Backend dependencies and start script |
| `backend/package-lock.json` | Backend lockfile |
| `backend/api/server.js` | Express app, auth, log APIs, static serve |
| `backend/api/kubeconfig-handler.js` | Kubeconfig discovery; required by server |
| `backend/api/explorer-routes.js` | Explorer API; registered by server |
| `backend/utils/logger.js` | Logger used by server |
| `backend/config/teams.json` | Teams/auth config; read by server |

### Assets (if present and imported)

| File | Purpose |
|------|--------|
| `src/images/novartis-logo.png` (or path used by LoginForm) | Logo on login; required if LoginForm import exists |

---

## Non-Critical Files

### Unused or optional frontend

| File | Reason |
|------|--------|
| `docs/archive/App.css` | Moved from `src/App.css`. Not imported anywhere; app uses `src/index.css` only. |
| `src/components/ui/use-toast.ts` | Re-exports from `@/hooks/use-toast`; no app import from this path |

### UI components not in the app’s import chain

Not imported by any page or by any of the critical UI/components above:

| File | Note |
|------|------|
| `src/components/ui/carousel.tsx` | Unused |
| `src/components/ui/form.tsx` | Unused |
| `src/components/ui/context-menu.tsx` | Unused |
| `src/components/ui/skeleton.tsx` | Only used by sidebar; sidebar unused |
| `src/components/ui/textarea.tsx` | Unused |
| `src/components/ui/dropdown-menu.tsx` | Unused |
| `src/components/ui/collapsible.tsx` | Unused |
| `src/components/ui/checkbox.tsx` | Unused |
| `src/components/ui/toggle.tsx` | Only used by toggle-group; toggle-group unused |
| `src/components/ui/sidebar.tsx` | Unused |
| `src/components/ui/dialog.tsx` | Only used by command; command unused |
| `src/components/ui/menubar.tsx` | Unused |
| `src/components/ui/avatar.tsx` | Unused |
| `src/components/ui/toggle-group.tsx` | Unused |
| `src/components/ui/command.tsx` | Unused |
| `src/components/ui/radio-group.tsx` | Unused |
| `src/components/ui/breadcrumb.tsx` | Unused |
| `src/components/ui/calendar.tsx` | Unused |
| `src/components/ui/drawer.tsx` | Unused |
| `src/components/ui/accordion.tsx` | Unused |
| `src/components/ui/navigation-menu.tsx` | Unused |
| `src/components/ui/hover-card.tsx` | Unused |
| `src/components/ui/chart.tsx` | Unused |
| `src/components/ui/input-otp.tsx` | Unused |
| `src/components/ui/progress.tsx` | Unused |
| `src/components/ui/popover.tsx` | Unused |
| `src/components/ui/slider.tsx` | Unused |
| `src/components/ui/pagination.tsx` | Unused |
| `src/components/ui/alert-dialog.tsx` | Unused |
| `src/components/ui/alert.tsx` | Unused |
| `src/components/ui/aspect-ratio.tsx` | Unused |
| `src/components/ui/resizable.tsx` | Unused |

### Backend (optional or unused)

| File | Reason |
|------|--------|
| `backend/middleware/pathValidation.js` | Not required/used by `server.js` |

### Documentation

All under `docs/` are for humans; app does not load them at runtime:

| Path | Purpose |
|------|--------|
| `docs/*.md` | Deployment, QA, troubleshooting, guides, etc. |

### CI/CD and Docker (optional for local run)

| File | Purpose |
|------|--------|
| `.gitlab-ci.yml` | CI pipeline |
| `docker-compose.yml` | Production-style run |
| `docker-compose.dev.yml` | Dev Docker setup |

### Test / sample data (not used at runtime)

| File | Purpose |
|------|--------|
| `logs-file/*.yaml` | Sample K8s/deployment YAML; not loaded by app |
| `logs-file/explorer-test-resources.yaml` | Test data for Explorer |
| `logs-file/k8s-deployment.yaml` | Example deployment |
| `logs-file/otds-logs-pods.yaml` | Sample pod spec |
| Other `logs-file/*.yaml` | Same idea |

---

## Summary

- **Critical**: ~50+ files (config, entry, pages, core components, used UI, lib, config, hooks, backend server, explorer routes, kubeconfig-handler, logger, teams config, and any imported assets like the login logo). These are required for **build**, **start**, and **core functionality**.
- **Non-Critical**: Unused UI components (~30), unused middleware, all `docs/`, CI/Docker files, and all `logs-file/*` YAML. Removing or ignoring them does **not** change current application behavior.

---

*Classification is based on the current codebase (import graph and server.js requires). If you add features that use more UI or new routes, re-run the same dependency analysis to update this list.*
