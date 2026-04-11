#!/bin/bash

OUTPUT_FILE="pods_logs_paths.txt"
> "$OUTPUT_FILE"  # Clear file if exists

echo "Generating namespace, pod, and log path mapping..."
echo "--------------------------------------------------" >> "$OUTPUT_FILE"

# Get all namespaces
for ns in $(kubectl get ns --no-headers -o custom-columns=":metadata.name"); do
  echo "Namespace: $ns" | tee -a "$OUTPUT_FILE"

  # Get all pods in the namespace
  pods=$(kubectl get pods -n "$ns" --no-headers -o custom-columns=":metadata.name")

  for pod in $pods; do
    echo "  Pod: $pod" | tee -a "$OUTPUT_FILE"

    # Common log paths for all pods
    cat <<EOF >> "$OUTPUT_FILE"
/scripts/custum/ansible.log
/scripts/ansible.logs
EOF

    # Custom log paths based on pod name
    case $pod in
      cs-0)
        cat <<'EOF' >> "$OUTPUT_FILE"
/app/dctm/server/dba/log/${GR_DOCBASE}.log
/app/dctm/server/dba/log/${DOCBASE_NAME}.log
/app/dctm/server/dba/log/docbroker*.log
/app/dctm/server/${JBOSS_VERSION}/logs/catalina.out
/app/dctm/server/${JBOSS_VERSION}/logs/*.log
/data/dctm/${HOSTNAME}/scripts/${RELEASE_VERSION}/Build/ansible-*.log
EOF
        ;;
      d2-0|d2conf-0|d2rest-0|d2sv-0|da-0|wfd-0)
        cat <<'EOF' >> "$OUTPUT_FILE"
/data/${HOSTNAME}/logs/catalina*.log
/data/${HOSTNAME}/logs/catalina.out
/app/tomcat/logs/access*.log
/data/${HOSTNAME}/app_data/logs/*.log
/data/${HOSTNAME}/scripts/${RELEASE_VERSION}/Build*/ansible-*.log
EOF
        ;;
      ds1-0)
        cat <<'EOF' >> "$OUTPUT_FILE"
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/log/server.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dsearch.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dsearchadminweb.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/cps_daemon.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/cps.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/xdb.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dfc.log
EOF
        ;;
      ia1-0)
        cat <<'EOF' >> "$OUTPUT_FILE"
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/log/server.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dsearch.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dsearchadminweb.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/cps_daemon.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/cps.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/xdb.log
/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dfc.log
EOF
        ;;
      *)
        echo "  No custom log paths defined for pod: $pod" >> "$OUTPUT_FILE"
        ;;
    esac
    echo "" >> "$OUTPUT_FILE"
  done
  echo "" >> "$OUTPUT_FILE"
done

echo "✅ Log path list saved to $OUTPUT_FILE"

