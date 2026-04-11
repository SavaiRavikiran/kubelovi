#!/usr/bin/env bash
# Create a TLS secret so https:// works on nginx ingress (same host on :80 and :443).
# Usage: NAMESPACE=apps-sbxkubelens RELEASE=apps-sbxkubelens HOST=kubelens.d4n-sbx.eu.novartis.net ./create-tls-secret.sh

set -e
NS="${NAMESPACE:-apps-sbxkubelens}"
REL="${RELEASE:-apps-sbxkubelens}"
HOST="${HOST:-kubelens.d4n-sbx.eu.novartis.net}"
SECRET="${REL}-tls"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Creating TLS secret $SECRET in namespace $NS for host $HOST"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$TMP/tls.key" -out "$TMP/tls.crt" \
  -subj "/CN=${HOST}" \
  -addext "subjectAltName=DNS:${HOST}" 2>/dev/null || \
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$TMP/tls.key" -out "$TMP/tls.crt" \
  -subj "/CN=${HOST}"

kubectl create secret tls "$SECRET" \
  --cert="$TMP/tls.crt" --key="$TMP/tls.key" \
  -n "$NS" --dry-run=client -o yaml | kubectl apply -f -

echo "Done. Upgrade Helm with: -f values-sbx-https.yaml (or --set ingress.tls.enabled=true)"
