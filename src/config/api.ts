// API configuration for the application
export const API_CONFIG = {
  // Base URL for API calls - will be proxied by nginx in production
  BASE_URL: '/api',
  
  // Timeout for API requests (in milliseconds)
  TIMEOUT: 30000,
  
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Base URL for API calls - automatically detect environment
export const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    // Browser environment - use current host
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    return `${protocol}//${hostname}${port ? `:${port}` : ''}/api`;
  }
  // Server-side rendering fallback
  return '/api';
})();

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  ENVIRONMENTS: '/environments',
  NAMESPACES: (environment: string) => `/namespaces/${environment}`,
  PODS: (environment: string, namespace: string) => `/pods/${environment}/${namespace}`,
  CONTAINERS: (environment: string, namespace: string, pod: string) => `/containers/${environment}/${namespace}/${pod}`,
  CONTAINER_PATHS: (environment: string, namespace: string, pod: string, container: string) => `/container-paths/${environment}/${namespace}/${pod}/${container}`,
  PATH_CONTENTS: (environment: string, namespace: string, pod: string, container: string, path: string) => `/path-contents/${environment}/${namespace}/${pod}/${container}?path=${encodeURIComponent(path)}`,
  BROWSE: (environment: string, namespace: string, pod: string, container: string, path: string = '/') => `/browse/${environment}/${namespace}/${pod}/${container}?path=${encodeURIComponent(path)}`,
  LOG_PATHS: (environment: string, namespace: string, pod: string, container: string) => `/log-paths/${environment}/${namespace}/${pod}/${container}`,
  LOG_FILES: (environment: string, namespace: string, pod: string, container: string, path?: string) => `/log-files/${environment}/${namespace}/${pod}/${container}${path ? `?path=${encodeURIComponent(path)}` : ''}`,
  LOGS: (environment: string, namespace: string, pod: string, container: string, lines: number = 1000) => `/logs/${environment}/${namespace}/${pod}/${container}?lines=${lines}`,
  FILE_CONTENT: (environment: string, namespace: string, pod: string, container: string, filepath: string) => `/file-content/${environment}/${namespace}/${pod}/${container}?filepath=${encodeURIComponent(filepath)}`,
  COPY_FILE: (environment: string, namespace: string, pod: string, container: string, filepath: string) => `/copy-file/${environment}/${namespace}/${pod}/${container}?filepath=${encodeURIComponent(filepath)}`,
  LOCAL_LOGS: '/logs/local/log.txt',

  // Explorer API (only for user "explorer")
  EXPLORER: {
    ENVIRONMENTS: '/explorer/environments',
    CLUSTERS_SUMMARY: '/explorer/clusters-summary',
    CLUSTER_DETAIL: (env: string) => `/explorer/cluster-detail/${encodeURIComponent(env)}`,
    NAMESPACES: (env: string) => `/explorer/namespaces/${env}`,
    NODES: (env: string) => `/explorer/nodes/${env}`,
    DEPLOYMENTS: (env: string, ns: string) => `/explorer/deployments/${env}/${ns}`,
    DAEMONSETS: (env: string, ns: string) => `/explorer/daemonsets/${env}/${ns}`,
    STATEFULSETS: (env: string, ns: string) => `/explorer/statefulsets/${env}/${ns}`,
    REPLICASETS: (env: string, ns: string) => `/explorer/replicasets/${env}/${ns}`,
    REPLICATIONCONTROLLERS: (env: string, ns: string) => `/explorer/replicationcontrollers/${env}/${ns}`,
    JOBS: (env: string, ns: string) => `/explorer/jobs/${env}/${ns}`,
    CRONJOBS: (env: string, ns: string) => `/explorer/cronjobs/${env}/${ns}`,
    PODS: (env: string, ns: string) => `/explorer/pods/${env}/${ns}`,
    CONTAINERS: (env: string, ns: string, pod: string) => `/explorer/containers/${env}/${ns}/${pod}`,
    CONFIGMAPS: (env: string, ns: string) => `/explorer/configmaps/${env}/${ns}`,
    SECRETS: (env: string, ns: string) => `/explorer/secrets/${env}/${ns}`,
    SERVICES: (env: string, ns: string) => `/explorer/services/${env}/${ns}`,
    INGRESSES: (env: string, ns: string) => `/explorer/ingresses/${env}/${ns}`,
    NETWORKPOLICIES: (env: string, ns: string) => `/explorer/networkpolicies/${env}/${ns}`,
    PERSISTENTVOLUMES: (env: string) => `/explorer/persistentvolumes/${env}`,
    PERSISTENTVOLUMECLAIMS: (env: string, ns: string) => `/explorer/persistentvolumeclaims/${env}/${ns}`,
    CUSTOMRESOURCEDEFINITIONS: (env: string) => `/explorer/customresourcedefinitions/${env}`,
    CUSTOMRESOURCES: (env: string, group: string, version: string, plural: string, namespace?: string) =>
      `/explorer/customresources/${env}/${encodeURIComponent(group)}/${version}/${plural}${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''}`,
  },
};
