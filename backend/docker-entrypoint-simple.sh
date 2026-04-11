#!/bin/sh
set -e

echo "=== Kubernetes Log Viewer - Docker Entrypoint ==="
echo "Starting with automatic kubeconfig detection..."

# Create configs directory if it doesn't exist
CONFIGS_DIR="/app/backend/configs"
mkdir -p "$CONFIGS_DIR"

# Check if running inside Kubernetes cluster (in-cluster mode)
IN_CLUSTER=false
if [ -f "/var/run/secrets/kubernetes.io/serviceaccount/token" ] && [ -f "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt" ]; then
    echo "✅ Detected in-cluster Kubernetes configuration"
    IN_CLUSTER=true
    # The Node.js app will automatically use in-cluster config if available
    # No need to set KUBECONFIG in this case
fi

# Priority 1: If KUBECONFIG env var is set, use it directly
if [ -n "$KUBECONFIG" ]; then
    echo "✅ Using KUBECONFIG environment variable: $KUBECONFIG"
    # Verify the file exists
    if [ -f "$KUBECONFIG" ]; then
        export KUBECONFIG
        echo "   Kubeconfig file found and will be used"
    else
        echo "   ⚠️  Warning: KUBECONFIG points to non-existent file: $KUBECONFIG"
        echo "   Will attempt to use it anyway (might be a colon-separated list)"
        export KUBECONFIG
    fi
fi

# Priority 2: Use default kubeconfig location if mounted
if [ -f "/root/.kube/config" ]; then
    echo "✅ Found kubeconfig at /root/.kube/config"
    # Set KUBECONFIG to use the mounted config
    if [ -z "$KUBECONFIG" ]; then
        export KUBECONFIG="/root/.kube/config"
        echo "   Set KUBECONFIG=/root/.kube/config"
    else
        echo "   KUBECONFIG already set, keeping existing value"
    fi
fi

# Priority 3: Check for additional kubeconfig files in mounted .kube directory
if [ -d "/root/.kube" ] && [ "$(ls -A /root/.kube 2>/dev/null)" ]; then
    echo "📁 Checking for additional kubeconfig files in /root/.kube..."
    found_files=0
    for kubeconfig_file in /root/.kube/*; do
        if [ -f "$kubeconfig_file" ] && [ "$(basename "$kubeconfig_file")" != "cache" ]; then
            filename=$(basename "$kubeconfig_file")
            if [ "$filename" != "config" ]; then
                env_name=$(echo "$filename" | sed 's/-kubeconfig.*//' | sed 's/config.*//')
                if [ -z "$env_name" ] || [ "$env_name" = "config" ]; then
                    env_name="kube-$(basename "$kubeconfig_file")"
                fi
                dest="$CONFIGS_DIR/${env_name}-kubeconfig"
                echo "   Copying $filename to configs directory"
                cp "$kubeconfig_file" "$dest"
                chmod 600 "$dest"
                found_files=$((found_files + 1))
            fi
        fi
    done
    if [ $found_files -gt 0 ]; then
        echo "   ✅ Copied $found_files additional kubeconfig file(s)"
    fi
fi

# Priority 4: Check for kubeconfig files in mounted configs directory
if [ -d "/app/backend/configs" ] && [ "$(ls -A /app/backend/configs 2>/dev/null)" ]; then
    echo "📁 Found kubeconfig files in mounted configs directory"
    ls -lh "/app/backend/configs" | tail -n +2 | head -5
    total=$(ls -1 "/app/backend/configs" 2>/dev/null | wc -l)
    if [ "$total" -gt 5 ]; then
        echo "   ... and $((total - 5)) more file(s)"
    fi
fi

# Summary
echo ""
echo "=== Kubeconfig Discovery Summary ==="
if [ "$IN_CLUSTER" = "true" ]; then
    echo "✅ In-cluster mode: Using Kubernetes service account"
fi
if [ -n "$KUBECONFIG" ]; then
    echo "✅ KUBECONFIG: $KUBECONFIG"
fi
if [ -f "/root/.kube/config" ]; then
    echo "✅ Default kubeconfig: /root/.kube/config"
fi
if [ "$(ls -A $CONFIGS_DIR 2>/dev/null)" ]; then
    echo "✅ Configs directory: $(ls -1 $CONFIGS_DIR 2>/dev/null | wc -l) file(s)"
else
    echo "⚠️  No kubeconfig files in configs directory"
fi

# Check if we have at least one way to connect
if [ "$IN_CLUSTER" = "false" ] && [ -z "$KUBECONFIG" ] && [ ! -f "/root/.kube/config" ] && [ ! "$(ls -A $CONFIGS_DIR 2>/dev/null)" ]; then
    echo ""
    echo "⚠️  WARNING: No kubeconfig found!"
    echo "   The application will start but may not be able to connect to Kubernetes."
    echo ""
    echo "   To provide kubeconfig, use one of these methods:"
    echo "   1. Set KUBECONFIG env var: -e KUBECONFIG=/path/to/config"
    echo "   2. Mount kubeconfig: -v /path/to/.kube:/root/.kube:ro"
    echo "   3. Mount configs dir: -v /path/to/configs:/app/backend/configs:ro"
    echo "   4. Run inside Kubernetes cluster (in-cluster mode)"
fi

echo ""
echo "=== Starting Application ==="
echo "Working directory: $(pwd)"
echo "Node version: $(node --version)"

# In-cluster: listen on 3006 so Kubernetes Service/Ingress (targetPort 3006) reaches the app.
# Some deployments mistakenly set PORT=3000 or omit PORT (old images defaulted to 3000).
if [ -f "/var/run/secrets/kubernetes.io/serviceaccount/token" ]; then
  if [ -z "${PORT:-}" ] || [ "${PORT}" = "3000" ]; then
    export PORT=3006
    echo "✅ In-cluster: PORT set to 3006 (must match Service targetPort)"
  fi
fi
export PORT="${PORT:-3006}"

# Start the backend server
exec node api/server.js


