#!/usr/bin/env bash
# Export Novartis Helm policy to backend/config/teams-from-helm.json for local testing.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if ! command -v helm &>/dev/null; then
  echo "helm not found. Install Helm or copy policy manually."
  exit 1
fi
OUT="$ROOT/backend/config/teams-from-helm.json"
# Single-line JSON under policy.json: | with 4-space indent
helm template k helm-kubelens-novartis -f helm-kubelens-novartis/values.yaml \
  --show-only templates/configmap-policy.yaml 2>/dev/null \
  | awk '/^  policy.json: \|/{getline; sub(/^    /,""); print; exit}' > "$OUT"
node -e "JSON.parse(require('fs').readFileSync('$OUT','utf8')); console.log('OK:', '$OUT')"
echo "Policy synced. Run: npm run local:dev"
