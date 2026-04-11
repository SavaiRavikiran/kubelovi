#!/bin/sh
set -e

# Use sh-compatible syntax throughout

# Only show entrypoint messages if LOG_LEVEL is info or debug
if [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ]; then
  echo "=== Kubernetes Log Viewer - Docker Entrypoint ==="
  echo "Starting with automatic kubeconfig detection..."
fi

# Create configs directory if it doesn't exist
CONFIGS_DIR="/app/backend/configs"
mkdir -p "$CONFIGS_DIR"

# Function to fix kubeconfig paths for Docker container
fix_kubeconfig_paths() {
    local kubeconfig_file=$1
    
    if [ ! -f "$kubeconfig_file" ]; then
        return 1
    fi
    
    # Check if we have python3 with yaml available for YAML processing
    if command -v python3 >/dev/null 2>&1 && python3 -c "import yaml" 2>/dev/null; then
        # Use Python to fix paths
        python3 << EOF
import yaml
import os
import re

kubeconfig_path = "$kubeconfig_file"
with open(kubeconfig_path, 'r') as f:
    config = yaml.safe_load(f)

# Fix certificate-authority paths
if 'clusters' in config:
    for cluster in config['clusters']:
        if 'cluster' in cluster and 'certificate-authority' in cluster['cluster']:
            ca_path = cluster['cluster']['certificate-authority']
            # If it's an absolute path, try to map it to container paths
            if ca_path and os.path.isabs(ca_path) and not ca_path.startswith('/root'):
                # Try common mappings - fix even if file doesn't exist yet
                if '/.minikube/' in ca_path:
                    # Map to mounted minikube directory
                    new_path = ca_path.replace(os.path.expanduser('~'), '/root')
                    # Also handle paths like /home/username/.minikube
                    import re
                    new_path = re.sub(r'/home/[^/]+/.minikube', '/root/.minikube', new_path)
                    cluster['cluster']['certificate-authority'] = new_path
                    print(f"Fixed CA path: {ca_path} -> {new_path}")
                else:
                    # Try direct mapping for other paths
                    new_path = ca_path.replace(os.path.expanduser('~'), '/root')
                    # Also handle /home/username paths
                    new_path = re.sub(r'/home/[^/]+/', '/root/', new_path)
                    if new_path != ca_path:
                        cluster['cluster']['certificate-authority'] = new_path
                        print(f"Fixed CA path: {ca_path} -> {new_path}")

# Fix client-certificate and client-key paths
if 'users' in config:
    for user in config['users']:
        if 'user' in user:
            if 'client-certificate' in user['user']:
                cert_path = user['user']['client-certificate']
                if cert_path and os.path.isabs(cert_path) and not cert_path.startswith('/root'):
                    if '/.minikube/' in cert_path:
                        new_path = cert_path.replace(os.path.expanduser('~'), '/root')
                        new_path = re.sub(r'/home/[^/]+/.minikube', '/root/.minikube', new_path)
                        user['user']['client-certificate'] = new_path
                        print(f"Fixed client cert path: {cert_path} -> {new_path}")
                    else:
                        new_path = cert_path.replace(os.path.expanduser('~'), '/root')
                        new_path = re.sub(r'/home/[^/]+/', '/root/', new_path)
                        if new_path != cert_path:
                            user['user']['client-certificate'] = new_path
                            print(f"Fixed client cert path: {cert_path} -> {new_path}")
            if 'client-key' in user['user']:
                key_path = user['user']['client-key']
                if key_path and os.path.isabs(key_path) and not key_path.startswith('/root'):
                    if '/.minikube/' in key_path:
                        new_path = key_path.replace(os.path.expanduser('~'), '/root')
                        new_path = re.sub(r'/home/[^/]+/.minikube', '/root/.minikube', new_path)
                        user['user']['client-key'] = new_path
                        print(f"Fixed client key path: {key_path} -> {new_path}")
                    else:
                        new_path = key_path.replace(os.path.expanduser('~'), '/root')
                        new_path = re.sub(r'/home/[^/]+/', '/root/', new_path)
                        if new_path != key_path:
                            user['user']['client-key'] = new_path
                            print(f"Fixed client key path: {key_path} -> {new_path}")

# Fix server addresses (localhost won't work in container)
if 'clusters' in config:
    for cluster in config['clusters']:
        if 'cluster' in cluster and 'server' in cluster['cluster']:
            server = cluster['cluster']['server']
            # If server is localhost/127.0.0.1/172.17.0.1, try to get the actual IP
            # 172.17.0.1 is Docker bridge IP which doesn't work for Mac Docker Desktop
            if '127.0.0.1' in server or 'localhost' in server or '172.17.0.1' in server:
                # Try to get minikube IP from profile
                minikube_ip = None
                if os.path.exists('/root/.minikube/profiles'):
                    try:
                        import subprocess
                        import json
                        # Try to get minikube IP
                        result = subprocess.run(['minikube', 'ip'], capture_output=True, text=True, timeout=2)
                        if result.returncode == 0 and result.stdout.strip():
                            minikube_ip = result.stdout.strip()
                    except:
                        pass
                
                # If we found minikube IP, use it
                if minikube_ip:
                    port = server.split(':')[-1] if ':' in server else '6443'
                    new_server = f"https://{minikube_ip}:{port}"
                    cluster['cluster']['server'] = new_server
                    print(f"Fixed server address: {server} -> {new_server}")
                else:
                    # Fallback: use host.docker.internal for Docker Desktop, or try to detect host IP
                    # For Linux, try to get host IP from default gateway
                    host_ip = None
                    try:
                        import subprocess
                        result = subprocess.run(['ip', 'route', 'show', 'default'], capture_output=True, text=True, timeout=1)
                        if result.returncode == 0:
                            # Extract IP from route output
                            for line in result.stdout.split('\n'):
                                if 'default via' in line:
                                    parts = line.split()
                                    if len(parts) > 2:
                                        # Get the gateway IP
                                        gateway = parts[2]
                                        # Try to ping gateway to get host IP (simplified)
                                        host_ip = gateway
                    except:
                        pass
                    
                    # For Mac Docker Desktop, 172.17.0.1 won't work - use host.docker.internal
                    if '172.17.0.1' in server:
                        port = server.split(':')[-1] if ':' in server else '6443'
                        new_server = f"https://host.docker.internal:{port}"
                        cluster['cluster']['server'] = new_server
                        print(f"Fixed server address: {server} -> {new_server} (using host.docker.internal for Mac)")
                    elif host_ip and host_ip != '127.0.0.1' and host_ip != '172.17.0.1':
                        port = server.split(':')[-1] if ':' in server else '6443'
                        new_server = f"https://{host_ip}:{port}"
                        cluster['cluster']['server'] = new_server
                        print(f"Fixed server address: {server} -> {new_server}")
                    else:
                        # For Mac Docker Desktop, use host.docker.internal
                        port = server.split(':')[-1] if ':' in server else '6443'
                        # Use host.docker.internal for Mac, or keep kubernetes.docker.internal if already set
                        if 'kubernetes.docker.internal' not in server:
                            new_server = f"https://host.docker.internal:{port}"
                            cluster['cluster']['server'] = new_server
                            print(f"Fixed server address: {server} -> {new_server} (using host.docker.internal for Mac)")
                        else:
                            print(f"Server address already correct: {server}")

with open(kubeconfig_path, 'w') as f:
    yaml.dump(config, f, default_flow_style=False)
EOF
    elif command -v node >/dev/null 2>&1; then
        # Use Node.js to fix paths (simpler sed-based approach)
        echo "Using sed to fix basic paths in kubeconfig..."
        # Fix minikube paths
        sed -i "s|$HOME/.minikube|/root/.minikube|g" "$kubeconfig_file" 2>/dev/null || true
        sed -i "s|/home/[^/]*/.minikube|/root/.minikube|g" "$kubeconfig_file" 2>/dev/null || true
        # Fix other home directory paths
        sed -i "s|$HOME/|/root/|g" "$kubeconfig_file" 2>/dev/null || true
        sed -i "s|/home/[^/]*/|/root/|g" "$kubeconfig_file" 2>/dev/null || true
        # Fix localhost server addresses
        sed -i "s|https://127.0.0.1:|https://host.docker.internal:|g" "$kubeconfig_file" 2>/dev/null || true
        sed -i "s|https://localhost:|https://host.docker.internal:|g" "$kubeconfig_file" 2>/dev/null || true
    else
        # Fallback: use sed for basic path replacement
        echo "Using sed to fix basic paths in kubeconfig..."
        sed -i "s|/home/[^/]*/.minikube|/root/.minikube|g" "$kubeconfig_file" 2>/dev/null || true
        sed -i "s|/home/[^/]*/|/root/|g" "$kubeconfig_file" 2>/dev/null || true
        sed -i "s|https://127.0.0.1:|https://host.docker.internal:|g" "$kubeconfig_file" 2>/dev/null || true
        sed -i "s|https://localhost:|https://host.docker.internal:|g" "$kubeconfig_file" 2>/dev/null || true
    fi
}

# Function to copy and fix kubeconfig file
copy_kubeconfig() {
    local source=$1
    local dest_name=$2
    
    if [ -f "$source" ]; then
        local dest="$CONFIGS_DIR/$dest_name"
        [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ] && echo "Copying kubeconfig from $source to $dest"
        cp "$source" "$dest"
        chmod 600 "$dest"
        
        # Fix paths in the copied kubeconfig
        [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ] && echo "Fixing paths in kubeconfig for Docker container..."
        fix_kubeconfig_paths "$dest"
        
        return 0
    fi
    return 1
}

# Method 1: Check KUBECONFIG environment variable (single file or colon-separated list)
if [ -n "$KUBECONFIG" ]; then
    [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ] && echo "KUBECONFIG environment variable is set: $KUBECONFIG"
    
    # Handle colon-separated list (KUBECONFIG can contain multiple paths)
    idx=0
    IFS=':'
    for kubeconfig_path in $KUBECONFIG; do
        if [ -f "$kubeconfig_path" ]; then
            # Extract environment name from path or use index
            if [ "$DISABLE_CONFIG_DISCOVERY" = "true" ]; then
                # Single kubeconfig mode - use default name
                copy_kubeconfig "$kubeconfig_path" "default-kubeconfig"
                [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ] && echo "Using single kubeconfig mode with: $kubeconfig_path"
                break
            else
                # Multiple kubeconfigs - try to extract name from path
                env_name=$(basename "$kubeconfig_path" | sed 's/-kubeconfig.*//' | sed 's/config.*//')
                if [ -z "$env_name" ] || [ "$env_name" = "config" ]; then
                    env_name="env-$idx"
                fi
                copy_kubeconfig "$kubeconfig_path" "${env_name}-kubeconfig"
                [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ] && echo "Added kubeconfig: ${env_name}-kubeconfig"
            fi
            idx=$((idx + 1))
        else
            [ "${LOG_LEVEL}" = "warn" ] || [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ] && echo "Warning: KUBECONFIG path does not exist: $kubeconfig_path"
        fi
    done
    unset IFS
fi

# Method 2: Check standard kubeconfig locations
if [ -z "$KUBECONFIG" ] || [ "$DISABLE_CONFIG_DISCOVERY" != "true" ]; then
    # Check ~/.kube/config (mounted from host)
    if [ -f "/root/.kube/config" ]; then
        [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ] && echo "Found kubeconfig at /root/.kube/config"
        if [ "$DISABLE_CONFIG_DISCOVERY" = "true" ]; then
            copy_kubeconfig "/root/.kube/config" "default-kubeconfig"
        else
            # Try to extract context name for environment name
            context_name=$(grep -A 1 "current-context" /root/.kube/config 2>/dev/null | tail -1 | sed 's/current-context://' | tr -d ' ' || echo "")
            if [ -n "$context_name" ]; then
                env_name=$(echo "$context_name" | cut -d'@' -f2 | cut -d'-' -f1 2>/dev/null || echo "default")
                copy_kubeconfig "/root/.kube/config" "${env_name}-kubeconfig"
            else
                copy_kubeconfig "/root/.kube/config" "default-kubeconfig"
            fi
        fi
    fi
    
    # Check for kubeconfig files in mounted configs directory
    if [ -d "/app/backend/configs" ] && [ "$(ls -A /app/backend/configs 2>/dev/null)" ]; then
        if [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ]; then
          echo "📁 Found kubeconfig files in mounted configs directory"
          ls -lh /app/backend/configs/
        fi
    fi
fi

# Method 3: Check for kubeconfig in mounted volume (docker-compose style)
if [ -d "/root/.kube" ] && [ "$(ls -A /root/.kube 2>/dev/null)" ]; then
    for kubeconfig_file in /root/.kube/*; do
        if [ -f "$kubeconfig_file" ] && [ "$(basename "$kubeconfig_file")" != "cache" ]; then
            env_name=$(basename "$kubeconfig_file" | sed 's/-kubeconfig.*//' | sed 's/config.*//')
            if [ -z "$env_name" ] || [ "$env_name" = "config" ]; then
                env_name="kube-$(basename "$kubeconfig_file")"
            fi
            copy_kubeconfig "$kubeconfig_file" "${env_name}-kubeconfig"
        fi
    done
fi

# Fix paths in all existing kubeconfig files in configs directory
if [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ]; then
  echo ""
  echo "=== Fixing paths in all kubeconfig files ==="
fi
if [ -d "$CONFIGS_DIR" ]; then
    for kubeconfig_file in "$CONFIGS_DIR"/*; do
        if [ -f "$kubeconfig_file" ] && [ "$(basename "$kubeconfig_file")" != "cache" ]; then
            [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ] && echo "Fixing paths in: $(basename "$kubeconfig_file")"
            fix_kubeconfig_paths "$kubeconfig_file"
        fi
    done
fi

# List discovered kubeconfig files (only if LOG_LEVEL is info or debug)
if [ "${LOG_LEVEL}" = "info" ] || [ "${LOG_LEVEL}" = "debug" ]; then
  echo ""
  echo "=== Discovered Kubeconfig Files ==="
  if [ "$(ls -A $CONFIGS_DIR 2>/dev/null)" ]; then
    ls -lh "$CONFIGS_DIR"
    echo ""
    echo "Total kubeconfig files: $(ls -1 $CONFIGS_DIR | wc -l)"
  else
    echo "WARNING: No kubeconfig files found!"
    echo "The application will start but may not be able to connect to Kubernetes clusters."
  fi

  echo ""
  echo "=== Starting Application ==="
  echo "Working directory: $(pwd)"
  echo "Node version: $(node --version)"
fi

# Start the backend server
exec node api/server.js

