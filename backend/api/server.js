const express = require('express');
const cors = require('cors');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const yaml = require('js-yaml');
const app = express();
/** Listen port: parse env at startup (must match K8s Service targetPort, default 3006). */
function getListenPort() {
  const p = parseInt(String(process.env.PORT || '').trim(), 10);
  return Number.isFinite(p) && p > 0 ? p : 3006;
}
const stream = require('stream');
const { promisify } = require('util');
const NodeCache = require('node-cache');
const logPathCache = new NodeCache({ stdTTL: 600 }); // 10 minutes cache

// Use shared logger module
const logger = require('../utils/logger');

// Add caches for pods and containers (short TTL)
const podsCache = new NodeCache({ stdTTL: 30 }); // 30 seconds
const containersCache = new NodeCache({ stdTTL: 30 }); // 30 seconds

// Use new KubeConfigHandler for smart kubeconfig discovery
const KubeConfigHandler = require('./kubeconfig-handler');
const kubeConfigHandler = new KubeConfigHandler();

// Initialize all environments asynchronously
let ENVIRONMENT_CONFIGS = {};
let k8sClients = {};
let environmentContexts = {};
let initializationComplete = false;
let initializationPromise = null;

// Initialize on startup
initializationPromise = (async () => {
  try {
    logger.info('Starting kubeconfig discovery and initialization...');
    const clients = await kubeConfigHandler.initializeAll();
    k8sClients = clients;
    ENVIRONMENT_CONFIGS = {};
    environmentContexts = {};
    
    // Build compatibility objects
    kubeConfigHandler.getEnvironments().forEach(envName => {
      const envInfo = kubeConfigHandler.getEnvironmentInfo(envName);
      if (envInfo) {
        ENVIRONMENT_CONFIGS[envName] = envInfo.configPath;
        environmentContexts[envName] = envInfo;
      }
    });
    
    initializationComplete = true;
    logger.info(`Initialized ${Object.keys(k8sClients).length} Kubernetes environments: ${Object.keys(k8sClients).join(', ')}`);
  } catch (error) {
    logger.error('Error initializing kubeconfig handler:', error);
    initializationComplete = true; // Mark as complete even on error to allow fallback
  }
})();

// Helper to wait for initialization
async function ensureInitialized() {
  if (!initializationComplete && initializationPromise) {
    await initializationPromise;
  }
}

// Helper function to extract environment name from kubeconfig context
function extractEnvironmentFromContext(contextName, configuredEnvName) {
  if (!contextName) return configuredEnvName;
  
  // Extract environment hints from context name
  const contextLower = contextName.toLowerCase();
  
  // Common patterns in context names
  const envPatterns = [
    /^(dev|development|sbx|sandbox|qa|quality|prod|production|staging|test|devint|integration)$/i,
    /@([^-]+)-([^-]+)-/,  // kubernetes-admin@d4n-dev-apps -> d4n, dev
    /-(dev|development|sbx|sandbox|qa|quality|prod|production|staging|test|devint|integration)-/i,
    /^(dev|development|sbx|sandbox|qa|quality|prod|production|staging|test|devint|integration)/i,
    /(dev|development|sbx|sandbox|qa|quality|prod|production|staging|test|devint|integration)$/i
  ];
  
  for (const pattern of envPatterns) {
    const match = contextName.match(pattern);
    if (match) {
      // Return the first captured group or the whole match
      const envName = match[1] || match[0];
      console.log(`Extracted environment "${envName}" from context "${contextName}"`);
      return envName.toLowerCase();
    }
  }
  
  // If no pattern matches, try to extract meaningful parts
  if (contextName.includes('@')) {
    const parts = contextName.split('@')[1]?.split('-');
    if (parts && parts.length > 1) {
      // For kubernetes-admin@d4n-dev-apps, return "d4n" and "dev"
      return parts.slice(0, 2).join('-').toLowerCase();
    }
  }
  
  // Fallback to configured environment name
  console.log(`Using configured environment name "${configuredEnvName}" for context "${contextName}"`);
  return configuredEnvName;
}

// Client initialization is now handled by KubeConfigHandler
// This function is kept for compatibility but does nothing
function initializeK8sClients() {
  // Clients are initialized asynchronously by KubeConfigHandler
  console.log('Kubernetes clients initialized by KubeConfigHandler');
}

// Test connection to Kubernetes cluster with enhanced debugging
async function testConnection(env, client) {
  try {
    console.log(`Testing connection for ${env}...`);
    
    // Get cluster info first
    const kubeConfig = client.kubeConfig;
    const cluster = kubeConfig.getCurrentCluster();
    const server = cluster?.server;
    
    console.log(`${env} cluster server: ${server}`);
    
    // Test basic connectivity with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await client.coreApi.listNamespace();
      clearTimeout(timeoutId);
      console.log(`✅ Connection test successful for ${env} - Found ${response.body.items.length} namespaces`);
      
      // Store successful connection info
      environmentContexts[env] = {
        ...environmentContexts[env],
        connected: true,
        lastConnected: new Date().toISOString(),
        namespaceCount: response.body.items.length,
        server: server
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
    
  } catch (error) {
    console.error(`❌ Connection test failed for ${env}:`, error.message);
    
    // Enhanced error reporting
    const kubeConfig = client.kubeConfig;
    const cluster = kubeConfig.getCurrentCluster();
    const server = cluster?.server;
    
    console.error(`Server endpoint: ${server}`);
    
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    if (error.response?.statusCode) {
      console.error(`HTTP Status: ${error.response.statusCode}`);
    }
    
    // Store failed connection info
    environmentContexts[env] = {
      ...environmentContexts[env],
      connected: false,
      lastError: error.message,
      errorCode: error.code,
      server: server,
      lastAttempt: new Date().toISOString()
    };
    
    // Provide specific troubleshooting advice
    if (error.code === 'ECONNREFUSED') {
      console.error(`🔧 Troubleshooting for ${env}:`);
      console.error(`   - Check if the cluster at ${server} is running`);
      console.error(`   - Verify network connectivity to the cluster`);
      console.error(`   - Ensure firewall/security groups allow access on port 6443`);
      console.error(`   - Try: curl -k ${server}/version`);
    } else if (error.code === 'ERR_OSSL_PEM_BAD_END_LINE') {
      console.error(`🔧 Certificate issue for ${env}:`);
      console.error(`   - Check kubeconfig certificate formatting`);
      console.error(`   - Ensure certificates are properly base64 encoded`);
      console.error(`   - Verify certificate-authority-data, client-certificate-data, client-key-data`);
    }
  }
}

// Get Kubernetes client for specific environment
async function getK8sClient(environment) {
  // Ensure initialization is complete
  await ensureInitialized();
  
  // Try to get from handler first
  try {
    return kubeConfigHandler.getClient(environment);
  } catch (error) {
    // Fallback to cached clients
    const client = k8sClients[environment];
    if (!client) {
      const available = Object.keys(k8sClients).length > 0 
        ? Object.keys(k8sClients).join(', ')
        : kubeConfigHandler.getEnvironments().join(', ') || 'none';
      throw new Error(`Kubernetes client not available for environment: ${environment}. Available: ${available}`);
    }
    return client;
  }
}

// Initialize all clients on startup (now handled by KubeConfigHandler)
// Keep for compatibility
initializeK8sClients();

// Policy config: load from env path (Helm-mounted) or default path. Same image, client-specific policies.
function getPolicyConfigPath() {
  const p = process.env.POLICY_CONFIG_PATH;
  if (p) {
    return path.isAbsolute(p) ? p : path.join(__dirname, '..', p);
  }
  return path.join(__dirname, '../config/teams.json');
}

function loadPolicyConfig() {
  const configPath = getPolicyConfigPath();
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    if (!config.teams) config.teams = {};
    if (!config.credentials) config.credentials = {};
    return config;
  } catch (err) {
    logger.error('Failed to load policy config from ' + configPath, err);
    return { teams: {}, credentials: {}, namespaceRules: [], tools: [], credentialsPolicy: {} };
  }
}

let policyConfig = loadPolicyConfig();

function getPolicyConfig() {
  return policyConfig;
}

function reloadPolicyConfig() {
  policyConfig = loadPolicyConfig();
  logger.info('Policy config reloaded from ' + getPolicyConfigPath());
}

// Reload policy on SIGHUP so clients can update ConfigMap without restart
process.on('SIGHUP', () => { try { reloadPolicyConfig(); } catch (e) { logger.error('Reload failed', e); } });

// Session policy: 15 min inactivity timeout, max 10 concurrent sessions per application (team)
const SESSION_TIMEOUT_SEC = 15 * 60; // 15 minutes
const MAX_SESSIONS_PER_TEAM = 10;

// Session cache: no default TTL; we set TTL per session and refresh on activity
const sessionCache = new NodeCache({ stdTTL: 0, checkperiod: 60 });

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Serve static files from public directory
const publicPath = path.join(__dirname, 'public');
console.log(`Serving static files from: ${publicPath}`);
console.log(`Public directory exists: ${fs.existsSync(publicPath)}`);
if (fs.existsSync(publicPath)) {
  const files = fs.readdirSync(publicPath);
  console.log(`Public directory contains: ${files.length} items`);
}
app.use(express.static(publicPath));

// Helper function to get user's team
function getUserTeam(username) {
  for (const [teamId, teamData] of Object.entries(getPolicyConfig().teams)) {
    if (teamData.users.includes(username)) {
      return { teamId, ...teamData };
    }
  }
  return null;
}

// Count active sessions for a team (application)
function getActiveSessionCountForTeam(teamId) {
  const keys = sessionCache.keys();
  let count = 0;
  for (const key of keys) {
    const session = sessionCache.get(key);
    if (session && session.team === teamId) count++;
  }
  return count;
}

// Helper function to check if user has access to environment
function hasEnvironmentAccess(team, environment) {
  if (team.environments === '*') return true;
  return team.environments.includes(environment);
}

// Namespaces to hide from the UI (e.g. deployment namespace apps-sbxkubelens). Policy can set namespaceExcludePatterns.
function isHiddenNamespace(namespace) {
  const policy = getPolicyConfig();
  const patterns = policy.namespaceExcludePatterns || ['^apps-[a-z0-9-]*kubelens$'];
  const ns = String(namespace).toLowerCase();
  for (const p of patterns) {
    try {
      const regex = (p.indexOf('*') >= 0 || p.startsWith('^')) ? new RegExp(p.replace(/\*/g, '.*')) : new RegExp(p);
      if (regex.test(ns)) return true;
    } catch {
      if (ns.includes(String(p).toLowerCase())) return true;
    }
  }
  return false;
}

// Helper function to check if user has access to namespace
// Policy-driven: namespaceRules in config first, then per-team namespaces/patterns
function hasNamespaceAccess(team, environment, namespace) {
  const namespaceLower = namespace.toLowerCase();
  const teamName = team.name.toLowerCase();
  const teamPrefix = teamName.split(' ')[0].toLowerCase();
  const policy = getPolicyConfig();

  // 1. Config-driven namespace rules (from Helm values / policy.json)
  const namespaceRules = policy.namespaceRules || [];
  for (const rule of namespaceRules) {
    const pattern = rule.pattern || rule.regex;
    if (!pattern) continue;
    const teams = rule.teams === '*' ? ['*'] : (Array.isArray(rule.teams) ? rule.teams : []);
    const matchAll = teams.includes('*');
    const teamIds = teams.map(t => String(t).toLowerCase());
    const teamMatch = matchAll || teamIds.includes(teamPrefix) || teamIds.includes(teamName);
    if (!teamMatch) continue;
    try {
      const regex = (pattern.indexOf('*') >= 0 || pattern.startsWith('^')) ? new RegExp(String(pattern).replace(/\*/g, '.*')) : new RegExp(pattern);
      if (regex.test(namespaceLower)) {
        logger.debug(`Namespace access granted via rule: ${teamName} -> ${namespace}`);
        return true;
      }
    } catch {
      if (namespaceLower.includes(String(pattern).toLowerCase())) {
        logger.debug(`Namespace access granted via rule (substring): ${teamName} -> ${namespace}`);
        return true;
      }
    }
  }

  // 2. Per-team: namespace prefix (e.g. "Condor Team" -> prefix "condor")
  if (namespaceLower.startsWith(teamPrefix) || namespaceLower.includes('-' + teamPrefix)) {
    logger.debug(`Access granted to ${teamName}: ${namespace} (team namespace)`);
    return true;
  }

  // 3. Per-team: dynamic namespace filtering from config
  if (team.dynamicNamespaceFiltering && team.namespacePattern) {
    // Validate pattern before using it
    const validation = validateNamespacePattern(team.namespacePattern);
    if (!validation.valid) {
      console.warn(`Invalid namespace pattern for team ${team.name}: ${validation.error}`);
      return false;
    }
    
    // Use pattern matching - check if team pattern exists anywhere in namespace name
    const teamPattern = team.namespacePattern.toLowerCase();
    let hasAccess = namespaceLower.includes(teamPattern);
    
    // Also check environment pattern if enabled
    if (!hasAccess && team.includeEnvironmentPattern) {
      const envPattern = environment.toLowerCase();
      hasAccess = namespaceLower.includes(envPattern);
    }
    
    console.log(`Dynamic filtering for team ${team.name}: pattern="${teamPattern}", found ${hasAccess}`);
    return hasAccess;
  }
  
  // If namespaces is wildcard but no dynamic filtering, allow all
  if (team.namespaces === '*') return true;
  
  // Fall back to static/hardcoded namespace list (if any)
  if (typeof team.namespaces === 'object' && team.namespaces[environment]) {
    const staticAccess = team.namespaces[environment].includes(namespace);
    console.log(`Static filtering for team ${team.name}: namespace="${namespace}", found ${staticAccess}`);
    return staticAccess;
  }
  
  // Default deny if no configuration matches
  return false;
}

// Authentication middleware: validate session and refresh inactivity timeout
function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required', code: 'SESSION_REQUIRED' });
  }

  const session = sessionCache.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
  }

  // Refresh session TTL on activity (15 min inactivity timeout)
  sessionCache.set(sessionId, session, SESSION_TIMEOUT_SEC);
  req.user = session;
  next();
}

// Admin middleware - check if user has admin privileges
function requireAdmin(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(401).json({ error: 'Session ID required', code: 'SESSION_REQUIRED' });
  }
  const session = sessionCache.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
  }
  if (session.team !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  sessionCache.set(sessionId, session, SESSION_TIMEOUT_SEC);
  req.user = session;
  next();
}

// Explorer middleware - only user "explorer" (password admin@7778) can access Explorer APIs/UI
function requireExplorerAccess(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required', code: 'SESSION_REQUIRED' });
  }
  const session = sessionCache.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
  }
  if (session.username !== 'explorer') {
    return res.status(403).json({ error: 'Explorer access is restricted to explorer user only' });
  }
  sessionCache.set(sessionId, session, SESSION_TIMEOUT_SEC);
  req.user = session;
  next();
}

// Helper to exec a command in a container and return stdout as string, with timeout
async function execInContainer({ environment, namespace, pod, container, command, timeoutMs = 2000, suppressTimeoutError = false }) {
  logger.debug(`Executing command in ${environment}/${namespace}/${pod}/${container}`);
  
  const k8sClient = await getK8sClient(environment);
  const exec = new k8s.Exec(k8sClient.kubeConfig);
  let stdout = '';
  let stderr = '';
  const stdoutStream = new stream.PassThrough();
  const stderrStream = new stream.PassThrough();
  
  stdoutStream.on('data', (data) => { 
    stdout += data.toString(); 
  });
  
  stderrStream.on('data', (data) => { 
    const chunk = data.toString();
    if (chunk.trim()) {
      logger.debug(`STDERR: ${chunk.substring(0, 100)}`);
    }
    stderr += chunk; 
  });
  
  let timeout;
  const execPromise = new Promise((resolve, reject) => {
    exec.exec(
      namespace,
      pod,
      container,
      command,
      stdoutStream,
      stderrStream,
      null,
      false,
      (status) => {
        clearTimeout(timeout);
        if (status.status !== 'Success') {
          logger.warn(`Command failed in ${pod}/${container}: ${stderr.substring(0, 200)}`);
        }
        
        if (status.status === 'Success') resolve();
        else reject(new Error(stderr || 'Exec failed'));
      }
    );
    timeout = setTimeout(() => {
      logger.warn(`Command timed out after ${timeoutMs}ms in ${pod}/${container}`);
      if (suppressTimeoutError) resolve();
      else reject(new Error('Exec timed out'));
    }, timeoutMs);
  });
  
  await execPromise;
  return stdout;
}

// Add global handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.log', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .yaml, .yml, and .config files are allowed.'));
    }
  }
});

// Authentication endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    console.log('Login attempt:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check credentials
    const validPassword = getPolicyConfig().credentials[username];
    console.log(`Checking user: ${username}, valid password exists: ${!!validPassword}`);
    
    if (!validPassword || validPassword !== password) {
      console.log('Invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Get user's team
    const team = getUserTeam(username);
    console.log(`Team found for ${username}:`, team);
    
    if (!team) {
      console.log('No team assigned');
      return res.status(403).json({ error: 'User not assigned to any team' });
    }

    const activeCount = getActiveSessionCountForTeam(team.teamId);
    if (activeCount >= MAX_SESSIONS_PER_TEAM) {
      console.log(`Login denied for ${username}: max sessions (${MAX_SESSIONS_PER_TEAM}) reached for ${team.name}`);
      return res.status(403).json({
        error: 'Maximum session limit reached',
        message: `This application (${team.name}) allows a maximum of ${MAX_SESSIONS_PER_TEAM} concurrent users. Please try again later or ask another user to sign out.`,
        code: 'SESSION_LIMIT_REACHED'
      });
    }

    // Create session with 15 min TTL (refreshed on each request via requireAuth)
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionData = {
      username,
      team: team.teamId,
      teamName: team.name,
      loginTime: new Date().toISOString()
    };

    console.log('Login successful for:', username, `(${activeCount + 1}/${MAX_SESSIONS_PER_TEAM} sessions for ${team.name})`);

    sessionCache.set(sessionId, sessionData, SESSION_TIMEOUT_SEC);
    
    // Admin Dashboard access: only when team has canAccessAdminDashboard: true in policy (default: false)
    const canAccessAdminDashboard = team.canAccessAdminDashboard === true;

    res.json({
      success: true,
      sessionId,
      user: {
        username,
        team: team.teamId,
        teamName: team.name,
        canAccessExplorer: username === 'explorer',
        canAccessAdminDashboard
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    sessionCache.del(sessionId);
  }
  res.json({ success: true });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get environments (Kubernetes contexts) with team-based filtering
app.get('/api/environments', requireAuth, async (req, res) => {
  try {
    // Ensure initialization is complete
    await ensureInitialized();
    
    // Get all available environments from handler
    const allEnvironments = kubeConfigHandler.getEnvironments().length > 0 
      ? kubeConfigHandler.getEnvironments() 
      : Object.keys(ENVIRONMENT_CONFIGS);
    const team = getPolicyConfig().teams[req.user.team];
    
    // Filter to only include environments that can actually connect
    // Try to get client for each environment - only include if successful
    const connectedEnvironments = [];
    for (const env of allEnvironments) {
      try {
        const client = await getK8sClient(env);
        if (client) {
          // Quick connection test - try to list namespaces (5s timeout so minikube/docker-desktop both get a chance)
          try {
            await Promise.race([
              client.coreApi.listNamespace(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            connectedEnvironments.push(env);
          } catch (testError) {
            logger.debug(`Environment ${env} connection test failed: ${testError.message}`);
            // Skip this environment
          }
        }
      } catch (error) {
        logger.debug(`Skipping environment ${env} - cannot get client: ${error.message}`);
        // Skip environments that can't connect
        continue;
      }
    }
    
    if (req.user.team === 'admin' || team.namespaces === '*') {
      // Admin has access to all connected environments
      res.json(connectedEnvironments);
    } else if (team.dynamicNamespaceFiltering && team.namespacePattern) {
      // Filter environments based on whether they contain namespaces matching team pattern
      // Only check connected environments
      const filteredEnvironments = [];
      
      for (const environment of connectedEnvironments) {
        try {
          const k8sClient = await getK8sClient(environment);
          if (!k8sClient) continue; // Skip if client not available
          
          const response = await k8sClient.coreApi.listNamespace();
          const allNamespaces = response.body.items.map(ns => ns.metadata.name);
          
          // Check if this environment has namespaces matching team pattern
          const pattern = team.namespacePattern.toLowerCase();
          const hasMatchingNamespaces = allNamespaces.some(ns => {
            const namespaceLower = ns.toLowerCase();
            let matches = namespaceLower.includes(pattern);
            
            // Also check environment pattern if enabled
            if (!matches && team.includeEnvironmentPattern) {
              const envPattern = environment.toLowerCase();
              matches = namespaceLower.includes(envPattern);
            }
            
            return matches;
          });
          
          if (hasMatchingNamespaces) {
            filteredEnvironments.push(environment);
          }
          
          logger.debug(`Team: ${team.name}, Environment: ${environment}, Pattern: ${pattern}, Matching namespaces: ${hasMatchingNamespaces}`);
        } catch (error) {
          logger.debug(`Skipping ${environment} due to connection error: ${error.message}`);
          // Skip environments that can't be connected to
          continue;
        }
      }
      
      logger.debug(`Team: ${team.name} can access environments: ${filteredEnvironments.join(', ')}`);
      res.json(filteredEnvironments);
    } else {
      // No pattern configured, return empty list for security
      logger.warn(`No pattern configured for team ${team.name}, returning empty list`);
      res.json([]);
    }
  } catch (error) {
    logger.error('Error fetching environments:', error);
    res.status(500).json({ error: 'Failed to fetch environments' });
  }
});

// Get environment context information
app.get('/api/environment-info', requireAuth, async (req, res) => {
  try {
    const envInfo = {};
    
    Object.keys(environmentContexts).forEach(env => {
      const context = environmentContexts[env];
      envInfo[env] = {
        contextName: context.contextName,
        extractedEnv: context.extractedEnv,
        configPath: path.basename(context.configPath),
        connected: !!k8sClients[env]
      };
    });
    
    res.json(envInfo);
  } catch (error) {
    console.error('Error fetching environment info:', error);
    res.status(500).json({ error: 'Failed to fetch environment information' });
  }
});

// Get namespaces for an environment (filtered by team access)
app.get('/api/namespaces/:environment', requireAuth, async (req, res) => {
  try {
    const { environment } = req.params;
    
    // Get user's team and check access
    const team = getPolicyConfig().teams[req.user.team];
    if (!team) {
      return res.status(403).json({ error: 'Team not found' });
    }
    
    // Check environment access
    if (!hasEnvironmentAccess(team, environment)) {
      return res.status(403).json({ error: 'Access denied to this environment' });
    }
    
    // Get all namespaces from Kubernetes
    const k8sClient = await getK8sClient(environment);
    const response = await k8sClient.coreApi.listNamespace();
    const allNamespaces = response.body.items.map(ns => ns.metadata.name);
    
    // Filter namespaces based on team access using hasNamespaceAccess
    const filteredNamespaces = allNamespaces.filter(namespace => {
      const hasAccess = hasNamespaceAccess(team, environment, namespace);
      console.log(`Namespace ${namespace} access for team ${team.name}: ${hasAccess}`);
      return hasAccess;
    });

    console.log(`Access for team ${team.name}: found ${filteredNamespaces.length} accessible namespaces out of ${allNamespaces.length} total`);
    res.json(filteredNamespaces);
  } catch (error) {
    console.error('Error fetching namespaces:', error);
    
    // Provide more specific error messages for common issues
    let errorMessage = 'Failed to fetch namespaces';
    if (error.code === 'ERR_OSSL_PEM_BAD_END_LINE') {
      errorMessage = 'Kubeconfig certificate formatting error. Please check your kubeconfig file.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to Kubernetes cluster. Check cluster availability.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Kubernetes cluster endpoint not found. Check kubeconfig server URL.';
    }
    
    res.status(500).json({ error: errorMessage, details: error.message });
  }
});

// Get pods in a namespace (with cache and team access control)
app.get('/api/pods/:environment/:namespace', requireAuth, async (req, res) => {
  const { environment, namespace } = req.params;
  
  // Get user's team and check access
  const team = getPolicyConfig().teams[req.user.team];
  if (!team) {
    return res.status(403).json({ error: 'Team not found' });
  }
  
  if (!hasEnvironmentAccess(team, environment)) {
    return res.status(403).json({ error: 'Access denied to this environment' });
  }
  
  if (!hasNamespaceAccess(team, environment, namespace)) {
    return res.status(403).json({ error: 'Access denied to this namespace' });
  }
  
  const cacheKey = `${environment}:${namespace}`;
  const cached = podsCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    // Trigger background refresh
    (async () => {
      try {
        const k8sClient = await getK8sClient(environment);
        const response = await k8sClient.coreApi.listNamespacedPod(namespace);
        const pods = (response.body.items || []).map(pod => ({
          name: pod.metadata.name,
          status: pod.status?.phase || 'Unknown',
          ready: pod.status?.containerStatuses
            ? pod.status.containerStatuses.filter(c => c.ready).length + '/' + pod.status.containerStatuses.length
            : '-'
        }));
        podsCache.set(cacheKey, pods);
      } catch (error) {}
    })();
    return;
  }
  try {
    const k8sClient = await getK8sClient(environment);
    const response = await k8sClient.coreApi.listNamespacedPod(namespace);
    // Show all pods (Running, Pending, Succeeded, Failed) so empty namespaces still show something when pods exist
    const pods = (response.body.items || []).map(pod => ({
      name: pod.metadata.name,
      status: pod.status?.phase || 'Unknown',
      ready: pod.status?.containerStatuses
        ? pod.status.containerStatuses.filter(c => c.ready).length + '/' + pod.status.containerStatuses.length
        : '-'
    }));
    podsCache.set(cacheKey, pods);
    res.json(pods);
  } catch (error) {
    console.error('Error fetching pods:', error);
    res.status(500).json({ error: 'Failed to fetch pods' });
  }
});

// Get containers in a pod (with cache and team access control)
app.get('/api/containers/:environment/:namespace/:pod', requireAuth, async (req, res) => {
  const { environment, namespace, pod } = req.params;
  
  // Get user's team and check access
  const team = getPolicyConfig().teams[req.user.team];
  if (!team) {
    return res.status(403).json({ error: 'Team not found' });
  }
  
  if (!hasEnvironmentAccess(team, environment)) {
    return res.status(403).json({ error: 'Access denied to this environment' });
  }
  
  if (!hasNamespaceAccess(team, environment, namespace)) {
    return res.status(403).json({ error: 'Access denied to this namespace' });
  }
  
  const cacheKey = `${environment}:${namespace}:${pod}`;
  const cached = containersCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    // Trigger background refresh
    (async () => {
      try {
        const k8sClient = await getK8sClient(environment);
        const response = await k8sClient.coreApi.readNamespacedPod(pod, namespace);
        const containers = response.body.spec.containers.map(c => c.name);
        containersCache.set(cacheKey, containers);
      } catch (error) {}
    })();
    return;
  }
  try {
    const k8sClient = await getK8sClient(environment);
    const response = await k8sClient.coreApi.readNamespacedPod(pod, namespace);
    const containers = response.body.spec.containers.map(container => container.name);
    containersCache.set(cacheKey, containers);
    res.json(containers);
  } catch (error) {
    console.error('Error fetching containers:', error);
    res.status(500).json({ error: 'Failed to fetch containers' });
  }
});

// NEW: Get all available paths in a container (with team access control)
app.get('/api/container-paths/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  try {
    const { environment, namespace, pod, container } = req.params;
    
    // Get user's team and check access
    const team = getPolicyConfig().teams[req.user.team];
    if (!team) {
      return res.status(403).json({ error: 'Team not found' });
    }
    
    if (!hasEnvironmentAccess(team, environment)) {
      return res.status(403).json({ error: 'Access denied to this environment' });
    }
    
    if (!hasNamespaceAccess(team, environment, namespace)) {
      return res.status(403).json({ error: 'Access denied to this namespace' });
    }
    
    const cacheKey = `paths:${environment}:${namespace}:${pod}:${container}:${req.user.team}`;
    const cached = logPathCache.get(cacheKey);
    
    if (cached) {
      res.json(cached);
      return;
    }

    // Get paths to check based on team restrictions
    let pathsToCheck = [
      '/var/log', 
      '/app', 
      '/tmp', 
      '/etc',
      '/var',
      '/home',
      '/opt',
      '/usr/local'
    ];

    // Apply team path restrictions
    if (team.allowedPaths && team.allowedPaths.length > 0) {
      // If allowedPaths is specified, only check those paths
      pathsToCheck = team.allowedPaths;
    } else if (team.blockedPaths && team.blockedPaths.length > 0) {
      // If blockedPaths is specified, exclude those paths
      pathsToCheck = pathsToCheck.filter(path => {
        return !team.blockedPaths.some(blockedPath => 
          path.startsWith(blockedPath) || blockedPath.startsWith(path)
        );
      });
    }

    const foundPaths = [];
    
    // Check each path in parallel with timeout
    const pathChecks = pathsToCheck.map(async (path) => {
      try {
        const output = await execInContainer({
          environment, namespace, pod, container,
          command: ['sh', '-c', `ls -ld ${path}`],
          timeoutMs: 1000,
          suppressTimeoutError: true
        });
        
        if (output && output.trim()) {
          return {
            path,
            type: 'directory',
            exists: true
          };
        }
        return null;
      } catch (error) {
        return null;
      }
    });

    const results = await Promise.all(pathChecks);
    const validPaths = results.filter(result => result !== null);
    
    logPathCache.set(cacheKey, validPaths);
    res.json(validPaths);
    
  } catch (error) {
    console.error('Error fetching container paths:', error);
    res.status(500).json({ error: 'Failed to fetch container paths' });
  }
});

// NEW: Get files and directories in a specific path (with team access control)
app.get('/api/path-contents/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  try {
    const { environment, namespace, pod, container } = req.params;
    const { path } = req.query;
    
    if (!path) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    const cacheKey = `contents:${environment}:${namespace}:${pod}:${container}:${path}`;
    const cached = logPathCache.get(cacheKey);
    
    if (cached) {
      res.json(cached);
      return;
    }

    // Get detailed listing of files and directories
    const output = await execInContainer({
      environment, namespace, pod, container,
      command: ['sh', '-c', `ls -lah ${path}`],
      timeoutMs: 3000,
      suppressTimeoutError: true
    });

    const items = [];
    if (output && output.trim()) {
      const lines = output.trim().split('\n');
      
      for (const line of lines) {
        if (line.startsWith('total')) continue; // Skip total line
        
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;
        
        const permissions = parts[0];
        const size = parts[4];
        const date = parts.slice(5, 8).join(' ');
        const name = parts.slice(8).join(' ');
        
        if (name === '.' || name === '..') continue;
        
        const isDirectory = permissions.startsWith('d');
        const isFile = permissions.startsWith('-');
        const isLink = permissions.startsWith('l');
        const itemPath = `${path}/${name}`.replace(/\/+/g, '/'); // Clean up double slashes
        
        // Only show directories or files with allowed extensions
        if (!shouldShowPath(itemPath, isDirectory)) {
          continue; // Skip files that don't have allowed extensions
        }
        
        items.push({
          name,
          type: isDirectory ? 'directory' : isLink ? 'link' : 'file',
          size: isDirectory ? '-' : size,
          modified: date,
          permissions,
          path: itemPath
        });
      }
    }

    logPathCache.set(cacheKey, items);
    res.json(items);
    
  } catch (error) {
    console.error('Error fetching path contents:', error);
    res.status(500).json({ error: 'Failed to fetch path contents' });
  }
});

// NEW: Get file content for viewing/downloading (with team access control)
app.get('/api/file-content/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  try {
    const { environment, namespace, pod, container } = req.params;
    const { filepath, download = 'false' } = req.query;
    
    // Validate file access - only allow .log, .out, .txt, and .zip files
    if (!hasAllowedExtension(filepath)) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'Only .log, .out, .txt, and .zip files are allowed' 
      });
    }
    
    // ... rest of the code remains the same ...
    if (!filepath) {
      return res.status(400).json({ error: 'Filepath parameter is required' });
    }

    console.log(`Reading file content: ${filepath} from ${environment}/${namespace}/${pod}/${container}`);

    // First, verify the container exists and get container info
    try {
      console.log('Verifying container exists...');
      const k8sClient = await getK8sClient(environment);
      const podInfo = await k8sClient.coreApi.readNamespacedPod(pod, namespace);
      const containers = podInfo.body.spec.containers.map(c => c.name);
      console.log(`Available containers in pod: ${JSON.stringify(containers)}`);
      
      if (!containers.includes(container)) {
        console.error(`Container '${container}' not found. Available: ${containers.join(', ')}`);
        return res.status(400).json({ error: `Container '${container}' not found in pod '${pod}'` });
      }
    } catch (verifyError) {
      console.error('Error verifying container:', verifyError);
      return res.status(500).json({ error: 'Failed to verify container', details: verifyError.message });
    }

    // Get file content (use base64 for binary files to avoid corruption)
    const filename = filepath.split('/').pop();
    const isBinary = isBinaryFile(filepath);

    if (isBinary) {
      // Binary files (e.g. .zip): read via base64 in container, return as JSON so proxies don't corrupt binary
      if (download !== 'true') {
        return res.status(400).json({
          error: 'Binary file',
          message: 'Use download=true to download this file.',
          filename
        });
      }
      try {
        const escapedPath = filepath.replace(/'/g, "'\"'\"'");
        const base64Out = await execInContainer({
          environment, namespace, pod, container,
          command: ['sh', '-c', `base64 < '${escapedPath}' | tr -d '\\n'`],
          timeoutMs: 60000,
          suppressTimeoutError: false
        });
        const base64Clean = (base64Out || '').replace(/\s/g, '');
        if (!base64Clean.length) {
          return res.status(500).json({ error: 'Binary file is empty or failed to read', filename });
        }
        res.json({ contentBase64: base64Clean, filename });
      } catch (binError) {
        console.error('Error reading binary file:', binError);
        res.status(500).json({ error: 'Failed to read binary file', details: binError.message });
      }
      return;
    }

    // Text files: use cat
    try {
      const content = await execInContainer({
        environment, namespace, pod, container,
        command: ['cat', filepath],
        timeoutMs: 10000,
        suppressTimeoutError: false
      });

      if (download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(content || '');
      } else {
        const response = {
          content: content || '',
          filename,
          filepath: filepath,
          size: content ? content.length : 0
        };
        res.json(response);
      }
    } catch (execError) {
      console.error('Error executing cat command:', execError);
      try {
        const escapedPath = filepath.replace(/'/g, "'\"'\"'");
        const content = await execInContainer({
          environment, namespace, pod, container,
          command: ['sh', '-c', `cat '${escapedPath}'`],
          timeoutMs: 10000,
          suppressTimeoutError: false
        });
        if (download === 'true') {
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.send(content || '');
        } else {
          res.json({
            content: content || '',
            filename,
            filepath: filepath,
            size: content ? content.length : 0
          });
        }
      } catch (altError) {
        console.error('Alternative command also failed:', altError);
        res.status(500).json({ error: 'Failed to read file content', details: altError.message });
      }
    }
    
  } catch (error) {
    console.error('Error fetching file content:', error);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
});

// NEW: Copy file from container to a temporary location (for sharing, with team access control)
app.get('/api/copy-file/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  try {
    const { environment, namespace, pod, container } = req.params;
    const { filepath } = req.query;
    
    // Validate file extension for copy operation
    if (!hasAllowedExtension(filepath)) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'Only .log, .out, .txt, and .zip files can be copied' 
      });
    }
    
    if (!filepath) {
      return res.status(400).json({ error: 'Filepath parameter is required' });
    }

    // Create a temporary copy with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = filepath.split('/').pop();
    const tempPath = `/tmp/${filename}_${timestamp}`;
    
    const copyResult = await execInContainer({
      environment, namespace, pod, container,
      command: ['sh', '-c', `cp "${filepath}" "${tempPath}"`],
      timeoutMs: 5000,
      suppressTimeoutError: true
    });

    if (copyResult && copyResult.includes('SUCCESS')) {
      res.json({
        success: true,
        message: 'File copied successfully',
        tempPath: tempPath,
        originalPath: filepath
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to copy file'
      });
    }
    
  } catch (error) {
    console.error('Error copying file:', error);
    res.status(500).json({ error: 'Failed to copy file' });
  }
});

// NEW: Dynamic directory browsing endpoint (with team access control)
app.get('/api/browse/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  const { environment, namespace, pod, container } = req.params;
  const { path = '/' } = req.query;
  
  logger.debug(`Browse request: ${req.user.username} -> ${path} in ${environment}/${namespace}/${pod}/${container}`);
  
  try {
    // Get user's team and check access
    const team = getPolicyConfig().teams[req.user.team];
    if (!team) {
      logger.warn(`Team not found for user ${req.user.username}`);
      return res.status(403).json({ error: 'Team not found' });
    }
    
    if (!hasEnvironmentAccess(team, environment)) {
      logger.warn(`Access denied: ${req.user.username} -> environment ${environment}`);
      return res.status(403).json({ error: 'Access denied to this environment' });
    }
    
    if (!hasNamespaceAccess(team, environment, namespace)) {
      logger.warn(`Access denied: ${req.user.username} -> namespace ${namespace}`);
      return res.status(403).json({ error: 'Access denied to this namespace' });
    }

    // Check if path is allowed for this team using path validation
    if (path !== '/') {
      const userTeam = req.user.team;
      if (!validateContainerPath(path, userTeam)) {
        logger.warn(`Access denied: ${req.user.username} -> path ${path}`);
        return res.status(403).json({ error: 'Access denied to this path' });
      }
    }
    
    const output = await execInContainer({
      environment, namespace, pod, container,
      command: ['sh', '-c', `ls -lah ${path}`],
      timeoutMs: 5000,
      suppressTimeoutError: true
    });
    
    const items = [];
    const foundPaths = new Set(); // Track paths we've already added
    
    // When browsing root, ALWAYS check for /app and /data directories for ALL pods
    if (path === '/') {
      const commonDirsToCheck = ['/app', '/data'];
      
      // Check directories in parallel for better performance
      const dirChecks = await Promise.all(
        commonDirsToCheck.map(async (dirPath) => {
          try {
            const dirInfo = await execInContainer({
              environment, namespace, pod, container,
              command: ['sh', '-c', `test -d "${dirPath}" && ls -ld "${dirPath}" 2>/dev/null || echo "NOTFOUND"`],
              timeoutMs: 3000,
              suppressTimeoutError: true
            });
            
            if (dirInfo && dirInfo.trim() && !dirInfo.trim().includes('NOTFOUND')) {
              const parts = dirInfo.trim().split(/\s+/);
              if (parts.length >= 9) {
                return {
                  path: dirPath,
                  exists: true,
                  permissions: parts[0],
                  date: parts.slice(5, 8).join(' '),
                  name: dirPath.split('/').pop() || dirPath
                };
              }
            }
            return { path: dirPath, exists: false };
          } catch (e) {
            logger.debug(`Error checking ${dirPath}: ${e.message}`);
            return { path: dirPath, exists: false, error: e.message };
          }
        })
      );
      
      // Add directories that exist
      for (const dirCheck of dirChecks) {
        if (dirCheck.exists) {
          const isAllowed = validateContainerPath(dirCheck.path, req.user.team);
          
          if (isAllowed) {
            items.push({
              name: dirCheck.name,
              type: 'directory',
              size: '-',
              modified: dirCheck.date,
              permissions: dirCheck.permissions,
              path: dirCheck.path
            });
            foundPaths.add(dirCheck.path);
          }
        }
      }
    }
    
    if (output && output.trim()) {
      const lines = output.trim().split('\n');
      const userTeam = req.user.team;
      
      for (const line of lines) {
        if (line.startsWith('total')) continue;
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;
        const permissions = parts[0];
        const size = parts[4];
        const date = parts.slice(5, 8).join(' ');
        const name = parts.slice(8).join(' ');
        if (name === '.' || name === '..') continue;
        
        const isDirectory = permissions.startsWith('d');
        const isFile = permissions.startsWith('-');
        const isLink = permissions.startsWith('l');
        const itemPath = `${path.replace(/\/$/, '')}/${name}`.replace(/\/+/g, '/');
        
        // Skip if we already added this path
        if (foundPaths.has(itemPath)) {
          continue;
        }
        
        // Special handling: Always allow /app and /data directories at root level if they exist
        const isCommonLogDir = (path === '/' && isDirectory && (itemPath === '/app' || itemPath === '/data'));
        
        if (!isCommonLogDir) {
          // Validate path access for other paths
          const isValid = validateContainerPath(itemPath, userTeam);
          if (!isValid) {
            continue; // Skip paths not allowed for this team
          }
        }
        
        // Only show directories or files with allowed extensions
        if (!shouldShowPath(itemPath, isDirectory)) {
          continue; // Skip files that don't have allowed extensions
        }
        
        items.push({
          name,
          type: isDirectory ? 'directory' : isLink ? 'link' : 'file',
          size: isDirectory ? '-' : size,
          modified: date,
          permissions,
          path: itemPath
        });
      }
    }
    
    // Final safety check: Ensure /app and /data are included if they exist and are allowed
    if (path === '/') {
      const dirsToEnsure = ['/app', '/data'];
      
      for (const dirPath of dirsToEnsure) {
        if (!foundPaths.has(dirPath)) {
          try {
            const dirCheck = await execInContainer({
              environment, namespace, pod, container,
              command: ['sh', '-c', `if [ -d "${dirPath}" ]; then ls -ld "${dirPath}" 2>/dev/null; fi`],
              timeoutMs: 2000,
              suppressTimeoutError: true
            });
            
            if (dirCheck && dirCheck.trim()) {
              const parts = dirCheck.trim().split(/\s+/);
              if (parts.length >= 9) {
                const isAllowed = validateContainerPath(dirPath, req.user.team);
                if (isAllowed) {
                  const dirName = dirPath.split('/').pop() || dirPath;
                  items.push({
                    name: dirName,
                    type: 'directory',
                    size: '-',
                    modified: parts.slice(5, 8).join(' '),
                    permissions: parts[0],
                    path: dirPath
                  });
                  foundPaths.add(dirPath);
                }
              }
            }
          } catch (e) {
            logger.debug(`Error in final check for ${dirPath}: ${e.message}`);
          }
        }
      }
    }
    
    // For directories that might have wildcard patterns, also search for matching files
    // This ensures files matching patterns like access*.log are found
    // Check if this path matches any known wildcard pattern directories
    const knownWildcardDirs = ['/app/tomcat/logs'];
    if (knownWildcardDirs.includes(path)) {
      try {
        // For /app/tomcat/logs, search for access*.log files
        let wildcardPattern = '';
        if (path === '/app/tomcat/logs') {
          wildcardPattern = 'access*.log';
        }
        
        if (wildcardPattern) {
          const wildcardOutput = await execInContainer({
            environment, namespace, pod, container,
            command: ['sh', '-c', `find ${path} -maxdepth 1 -type f -name "${wildcardPattern}" 2>/dev/null`],
            timeoutMs: 3000,
            suppressTimeoutError: true
          });
          
          if (wildcardOutput && wildcardOutput.trim()) {
            const wildcardFiles = wildcardOutput.trim().split('\n').filter(line => line.trim());
            for (const filePath of wildcardFiles) {
              if (!foundPaths.has(filePath)) {
                const fileName = filePath.split('/').pop();
                const fileInfo = await execInContainer({
                  environment, namespace, pod, container,
                  command: ['sh', '-c', `ls -lah "${filePath}" 2>/dev/null | head -1`],
                  timeoutMs: 2000,
                  suppressTimeoutError: true
                });
                
                if (fileInfo && fileInfo.trim() && !fileInfo.trim().startsWith('total')) {
                  const parts = fileInfo.trim().split(/\s+/);
                  if (parts.length >= 9 && validateContainerPath(filePath, req.user.team) && hasAllowedExtension(filePath)) {
                    items.push({
                      name: fileName,
                      type: 'file',
                      size: parts[4] || '-',
                      modified: parts.slice(5, 8).join(' '),
                      permissions: parts[0],
                      path: filePath
                    });
                    foundPaths.add(filePath);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        logger.debug(`Error searching for wildcard files in ${path}:`, e.message);
      }
    }
    
    // Sort items to ensure consistent ordering (directories first, then files)
    items.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.path.localeCompare(b.path);
    });
    
    logger.debug(`Browse result: ${items.length} items for ${path}`);
    res.json(items);
  } catch (error) {
    logger.error(`Browse error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to verify path validation and directory existence
app.get('/api/test-browse/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  try {
    const { environment, namespace, pod, container } = req.params;
    const userTeam = req.user.team;
    
    // Test path validation
    const testPaths = ['/app', '/data', '/scripts'];
    const validationResults = testPaths.map(testPath => ({
      path: testPath,
      allowed: validateContainerPath(testPath, userTeam)
    }));
    
    // Test directory existence
    const dirExistence = await Promise.all(
      testPaths.map(async (dirPath) => {
        try {
          const dirInfo = await execInContainer({
            environment, namespace, pod, container,
            command: ['sh', '-c', `test -d "${dirPath}" && echo "EXISTS" || echo "NOTFOUND"`],
            timeoutMs: 2000,
            suppressTimeoutError: true
          });
          return {
            path: dirPath,
            exists: dirInfo && dirInfo.trim().includes('EXISTS')
          };
        } catch (e) {
          return { path: dirPath, exists: false, error: e.message };
        }
      })
    );
    
    res.json({
      pod,
      container,
      userTeam,
      validationResults,
      dirExistence,
      teamConfig: getPolicyConfig().teams[userTeam] ? {
        allowedPaths: getPolicyConfig().teams[userTeam].allowedPaths
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to check if a file has an allowed extension
function hasAllowedExtension(filepath) {
  if (!filepath) return false;
  const allowedExtensions = ['.log', '.out', '.txt', '.zip'];
  const ext = path.extname(filepath).toLowerCase();
  return allowedExtensions.includes(ext);
}

// Binary file extensions: must be read with base64 in container to avoid corruption
const BINARY_EXTENSIONS = ['.zip', '.gz'];
function isBinaryFile(filepath) {
  if (!filepath) return false;
  const ext = path.extname(filepath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

// Helper function to check if a path should be shown (directories are always allowed, files must have allowed extension)
function shouldShowPath(itemPath, isDirectory) {
  // Always show directories (they can be browsed)
  if (isDirectory) return true;
  // For files, check if they have allowed extension
  return hasAllowedExtension(itemPath);
}

// Helper function to get pod-specific log path patterns
function getPodSpecificLogPaths(podName) {
  const podSpecificPaths = [];
  
  // Extract base pod name (remove statefulset suffix like -0, -1, -o, etc.)
  // Handle both numeric and letter suffixes
  const basePodName = podName.replace(/-[0-9a-z]+$/i, '').toLowerCase();
  const podNameLower = podName.toLowerCase();
  
  // Pod: cs-0, cs-o, cs-1, etc.
  if (podNameLower.startsWith('cs-') || basePodName === 'cs') {
    podSpecificPaths.push(
      '/app/dctm/server/dba/log',
      '/app/dctm/server',
      '/data/dctm'
    );
  }
  
  // Pods: d2-0, d2conf-0, d2rest-0, d2sv-0, da-0, wfd-0 (and variations)
  const d2Pods = ['d2', 'd2conf', 'd2rest', 'd2sv', 'da', 'wfd'];
  if (d2Pods.some(prefix => podNameLower.startsWith(prefix + '-') || basePodName === prefix)) {
    podSpecificPaths.push(
      '/data',
      '/app/tomcat/logs'
    );
  }
  
  // Pods: ds1-0, ia1-0 (and variations)
  if (podNameLower.startsWith('ds1-') || podNameLower.startsWith('ia1-') || 
      basePodName === 'ds1' || basePodName === 'ia1') {
    podSpecificPaths.push(
      '/app/xPlore'
    );
  }
  
  return podSpecificPaths;
}

// Helper function to expand pod-specific log paths with wildcards and environment variables
async function expandPodSpecificPaths(environment, namespace, pod, container, podName) {
  const expandedPaths = [];
  const podSpecificPatterns = [];
  
  // Extract base pod name (handle both numeric and letter suffixes)
  const basePodName = podName.replace(/-[0-9a-z]+$/i, '').toLowerCase();
  const podNameLower = podName.toLowerCase();
  
  // Pod: cs-0, cs-o, cs-1, etc.
  if (podNameLower.startsWith('cs-') || basePodName === 'cs') {
    podSpecificPatterns.push(
      '/app/dctm/server/dba/log/${GR_DOCBASE}.log',
      '/app/dctm/server/dba/log/${DOCBASE_NAME}.log',
      '/app/dctm/server/dba/log/docbroker*.log',
      '/app/dctm/server/${JBOSS_VERSION}/logs/catalina.out',
      '/app/dctm/server/${JBOSS_VERSION}/logs/*.log',
      '/data/dctm/${HOSTNAME}/scripts/${RELEASE_VERSION}/Build/ansible-*.log'
    );
  }
  
  // Pods: d2-0, d2conf-0, d2rest-0, d2sv-0, da-0, wfd-0 (and variations)
  const d2Pods = ['d2', 'd2conf', 'd2rest', 'd2sv', 'da', 'wfd'];
  if (d2Pods.some(prefix => podNameLower.startsWith(prefix + '-') || basePodName === prefix)) {
    podSpecificPatterns.push(
      '/data/${HOSTNAME}/logs/catalina*.log',
      '/data/${HOSTNAME}/logs/catalina.out',
      '/app/tomcat/logs/access*.log',
      '/data/${HOSTNAME}/app_data/logs/*.log',
      '/data/${HOSTNAME}/scripts/${RELEASE_VERSION}/Build*/ansible-*.log'
    );
  }
  
  // Pods: ds1-0, ia1-0 (and variations)
  if (podNameLower.startsWith('ds1-') || podNameLower.startsWith('ia1-') || 
      basePodName === 'ds1' || basePodName === 'ia1') {
    podSpecificPatterns.push(
      '/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/log/server.log',
      '/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dsearch.log',
      '/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dsearchadminweb.log',
      '/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/cps_daemon.log',
      '/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/cps.log',
      '/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/xdb.log',
      '/app/xPlore/${JBOSS_VERSION}/server/DctmServer_PrimaryDsearch/logs/dfc.log'
    );
  }
  
  // Expand each pattern using find command
  for (const pattern of podSpecificPatterns) {
    try {
      // First, try to expand environment variables by evaluating them in the container
      // Replace ${VAR} with * for find command, but also try to get actual values
      const findPattern = pattern
        .replace(/\$\{GR_DOCBASE\}/g, '*')
        .replace(/\$\{DOCBASE_NAME\}/g, '*')
        .replace(/\$\{JBOSS_VERSION\}/g, '*')
        .replace(/\$\{HOSTNAME\}/g, '*')
        .replace(/\$\{RELEASE_VERSION\}/g, '*');
      
      // Extract base directory path (before any wildcards)
      let baseDir = findPattern;
      const firstWildcardIndex = findPattern.indexOf('*');
      if (firstWildcardIndex > 0) {
        baseDir = findPattern.substring(0, findPattern.lastIndexOf('/', firstWildcardIndex));
      } else {
        baseDir = findPattern.substring(0, findPattern.lastIndexOf('/'));
      }
      
      // If baseDir is empty or just '/', use the pattern as-is
      if (!baseDir || baseDir === '/') {
        baseDir = findPattern.substring(0, findPattern.indexOf('*') || findPattern.length);
      }
      
      // Use find to locate matching files and directories
      // Try multiple approaches: exact pattern, with wildcards, and directory listing
      const fileNamePattern = findPattern.split('/').pop();
      const findCommands = [
        // Try with just the filename pattern using -name (for filename wildcards like access*.log)
        // This is the most reliable for patterns like access*.log
        `find ${baseDir} -type f -name "${fileNamePattern}" 2>/dev/null | head -50`,
        // Try with the full pattern using -path (for full path matching)
        `find ${baseDir} -type f -path "${findPattern}" 2>/dev/null | head -50`,
        // Try to find directories in the base path (to ensure directory is accessible)
        `find ${baseDir} -maxdepth 1 -type d 2>/dev/null | head -20`
      ];
      
      for (const findCommand of findCommands) {
        try {
          const output = await execInContainer({
            environment, namespace, pod, container,
            command: ['sh', '-c', findCommand],
            timeoutMs: 3000,
            suppressTimeoutError: true
          });
          
      if (output && output.trim()) {
        const foundPaths = output.split('\n')
          .filter(line => line.trim())
          .filter(filePath => {
            // Check if it's a directory (always allow) or a file with allowed extension
            // We'll check if it ends with a slash (directory) or has allowed extension
            return filePath.endsWith('/') || hasAllowedExtension(filePath);
          });
        expandedPaths.push(...foundPaths);
      }
        } catch (e) {
          // Continue to next command if this one fails
        }
      }
    } catch (e) {
      logger.debug(`[log-paths] Failed to expand pattern ${pattern}:`, e.message);
    }
  }
  
  return expandedPaths;
}

// Get log paths (stale-while-revalidate) - Keep existing for backward compatibility (with team access control)
app.get('/api/log-paths/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  const start = Date.now();
  try {
    const { environment, namespace, pod, container } = req.params;
    const userTeam = getUserTeamFromRequest(req);
    
    if (!userTeam) {
      return res.status(403).json({ error: 'User team not found' });
    }
    
    const cacheKey = `${environment}:${namespace}:${pod}:${container}`;
    const cached = logPathCache.get(cacheKey);
    if (cached) {
      // Filter paths: directories are always allowed, files must have allowed extensions
      const pathsWithValidFiles = cached.filter(filePath => {
        // If it's a directory (ends with /) or has no extension, allow it
        const ext = path.extname(filePath);
        if (filePath.endsWith('/') || !ext || ext === '') {
          return true;
        }
        // For files, check if they have allowed extension
        return hasAllowedExtension(filePath);
      });
      
      // Filter cached results based on team permissions
      const filteredPaths = pathsWithValidFiles.filter(filePath => validateContainerPath(filePath, userTeam));
      logger.debug(`[log-paths] cache hit (${Date.now() - start}ms) - filtered ${cached.length} to ${filteredPaths.length} paths`);
      res.json(filteredPaths);
      // Trigger background refresh
      (async () => {
        try {
          const basePaths = ['/var/log', '/tmp/logs', '/app/logs', '/usr/local/var/log'];
          
          // Special handling for /scripts - get all files and directories
          const scriptsPromise = (async () => {
            try {
              const output = await execInContainer({
                environment, namespace, pod, container,
                command: ['sh', '-c', 'find /scripts -type f -o -type d 2>/dev/null | head -100'],
                timeoutMs: 2000,
              });
              return output.split('\n')
                .filter(line => line.trim() && line !== '/scripts')
                .filter(filePath => {
                  // Allow directories or files with allowed extensions
                  // Directories from find don't have trailing /, so we check if it has an extension
                  const ext = path.extname(filePath);
                  return !ext || hasAllowedExtension(filePath);
                });
            } catch (e) {
              logger.debug(`[log-paths] Scripts directory not found or inaccessible`);
              return [];
            }
          })();
          
          // Get pod-specific log paths
          const podSpecificPathsPromise = expandPodSpecificPaths(environment, namespace, pod, container, pod);
          
          const promises = basePaths.map(async (base) => {
            try {
              const output = await execInContainer({
                environment, namespace, pod, container,
                command: ['sh', '-c', `ls -1d ${base}/*/`],
                timeoutMs: 500,
              });
              return output.split('\n').filter(line => line.trim());
            } catch (e) {
              return [];
            }
          });
          
          const [scriptsResults, podSpecificResults, ...otherResults] = await Promise.all([scriptsPromise, podSpecificPathsPromise, ...promises]);
          const allPaths = [...scriptsResults, ...podSpecificResults, ...otherResults.flat()];
          const uniquePaths = [...new Set(allPaths)];
          
          // Filter paths: directories are always allowed, files must have allowed extensions
          const pathsWithValidFiles = uniquePaths.filter(filePath => {
            // If it's a directory (ends with /) or has no extension, allow it
            const ext = path.extname(filePath);
            if (filePath.endsWith('/') || !ext || ext === '') {
              return true;
            }
            // For files, check if they have allowed extension
            return hasAllowedExtension(filePath);
          });
          
          // Filter paths based on team permissions
          const filteredPaths = pathsWithValidFiles.filter(filePath => validateContainerPath(filePath, userTeam));
          
          logPathCache.set(cacheKey, filteredPaths, 300000); // 5 min cache
          logger.debug(`[log-paths] background refresh complete - found ${uniquePaths.length} paths, filtered to ${filteredPaths.length}`);
        } catch (e) {
          logger.error('[log-paths] Background refresh failed:', e);
        }
      })();
      return;
    }
    
    const basePaths = ['/var/log', '/tmp/logs', '/app/logs', '/usr/local/var/log'];
    
    // Special handling for /scripts - get all files and directories
    const scriptsPromise = (async () => {
      try {
        const output = await execInContainer({
          environment, namespace, pod, container,
          command: ['sh', '-c', 'find /scripts -type f -o -type d 2>/dev/null | head -100'],
          timeoutMs: 2000,
        });
        return output.split('\n')
          .filter(line => line.trim() && line !== '/scripts')
          .filter(filePath => {
            // Allow directories or files with allowed extensions
            // Directories from find don't have trailing /, so we check if it has an extension
            const ext = path.extname(filePath);
            return !ext || hasAllowedExtension(filePath);
          });
      } catch (e) {
        console.log(`[log-paths] Scripts directory not found or inaccessible`);
        return [];
      }
    })();
    
    // Get pod-specific log paths
    const podSpecificPathsPromise = expandPodSpecificPaths(environment, namespace, pod, container, pod);
    
    const promises = basePaths.map(async (base) => {
      try {
        const output = await execInContainer({
          environment, namespace, pod, container,
          command: ['sh', '-c', `ls -1d ${base}/*/`],
          timeoutMs: 500,
        });
        return output.split('\n').filter(line => line.trim());
      } catch (e) {
        console.error(`[log-paths] Exec failed for base ${base}:`, e.message);
        return [];
      }
    });
    
    const [scriptsResults, podSpecificResults, ...otherResults] = await Promise.all([scriptsPromise, podSpecificPathsPromise, ...promises]);
    const allPaths = [...scriptsResults, ...podSpecificResults, ...otherResults.flat()];
    const uniquePaths = [...new Set(allPaths)];
    
    // Filter paths: directories are always allowed, files must have allowed extensions
    const pathsWithValidFiles = uniquePaths.filter(filePath => {
      // If it's a directory (ends with /) or has no extension, allow it
      const ext = path.extname(filePath);
      if (filePath.endsWith('/') || !ext || ext === '') {
        return true;
      }
      // For files, check if they have allowed extension
      return hasAllowedExtension(filePath);
    });
    
    // Filter paths based on team permissions
    const filteredPaths = pathsWithValidFiles.filter(filePath => validateContainerPath(filePath, userTeam));
    
    logPathCache.set(cacheKey, filteredPaths, 300000); // 5 min cache
    logger.debug(`[log-paths] fresh data (${Date.now() - start}ms) - found ${uniquePaths.length} paths, filtered to ${filteredPaths.length}`);
    res.json(filteredPaths);
  } catch (error) {
    logger.error('Error fetching log paths:', error);
    res.status(500).json({ error: 'Failed to fetch log paths' });
  }
});

// Get log files in a path (stale-while-revalidate) - Keep existing for backward compatibility (with team access control)
app.get('/api/log-files/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  const start = Date.now();
  try {
    const { environment, namespace, pod, container } = req.params;
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: 'Missing path' });
    const cacheKey = `${environment}:${namespace}:${pod}:${container}:${path}`;
    const cached = logPathCache.get(cacheKey);
    if (cached) {
      logger.debug(`[log-files] cache hit (${Date.now() - start}ms)`);
      res.json(cached);
      // Trigger background refresh
      (async () => {
        try {
          const output = await execInContainer({
            environment, namespace, pod, container,
            command: ['sh', '-c', `ls -lhp ${path}`],
            timeoutMs: 500,
            suppressTimeoutError: true
          });
          const files = output.trim().split('\n').filter(Boolean).map(line => {
            const parts = line.split(/\s+/);
            const name = parts.slice(8).join(' ');
            const filePath = `${path}/${name}`;
            const isDirectory = parts[0] && parts[0].startsWith('d');
            return {
              name,
              size: parts[4] || '',
              modified: parts.slice(5, 8).join(' '),
              path: filePath,
              isDirectory: isDirectory
            };
          }).filter(f => f.name && shouldShowPath(f.path, f.isDirectory));
          logPathCache.set(cacheKey, files);
        } catch (e) {}
      })();
      return;
    }
    const output = await execInContainer({
      environment, namespace, pod, container,
      command: ['sh', '-c', `ls -lhp ${path}`],
      timeoutMs: 2000
    });
    const files = output.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split(/\s+/);
      const name = parts.slice(8).join(' ');
      const filePath = `${path}/${name}`;
      const isDirectory = parts[0] && parts[0].startsWith('d');
      return {
        name,
        size: parts[4] || '',
        modified: parts.slice(5, 8).join(' '),
        path: filePath,
        isDirectory: isDirectory
      };
    }).filter(f => f.name && shouldShowPath(f.path, f.isDirectory));
    logPathCache.set(cacheKey, files);
    logger.debug(`[log-files] fresh (${Date.now() - start}ms)`);
    res.json(files);
  } catch (error) {
    logger.error('Error fetching log files:', error);
    res.status(500).json({ error: 'Failed to fetch log files' });
  }
});

// Get actual log content (with team access control)
app.get('/api/logs/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  try {
    const k8sClient = getK8sClient(req.params.environment);
    const k8sApi = k8sClient.coreApi;
    
    const { lines = 1000, follow = false, previous = false } = req.query;
    
    if (follow === 'true') {
      // For streaming logs
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      try {
        const logStream = await k8sApi.readNamespacedPodLog(
          req.params.pod,
          req.params.namespace,
          req.params.container,
          undefined, // pretty
          true, // follow
          previous === 'true', // previous
          undefined, // sinceSeconds
          undefined, // sinceTime
          parseInt(lines), // tailLines
          true // timestamps
        );
        
        logStream.pipe(res);
      } catch (streamError) {
        console.error('Error streaming logs:', streamError);
        res.status(500).json({ error: 'Failed to stream logs' });
      }
    } else {
      // For static logs
      try {
        const response = await k8sApi.readNamespacedPodLog(
          req.params.pod,
          req.params.namespace,
          req.params.container,
          undefined, // pretty
          false, // follow
          previous === 'true', // previous
          undefined, // sinceSeconds
          undefined, // sinceTime
          parseInt(lines), // tailLines
          true // timestamps
        );
        
        // Ensure we have actual log content
        const logContent = response.body || 'No log content available';
        res.json({ content: logContent });
      } catch (logError) {
        console.error('Error fetching static logs:', logError);
        // Return a meaningful error response
        res.json({ 
          content: `Error fetching logs: ${logError.message}\n\nThis could happen if:\n- The pod doesn't exist\n- The container hasn't started yet\n- You don't have permission to access logs\n- The pod has no log output yet` 
        });
      }
    }
  } catch (error) {
    console.error('Error in log endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
  }
});

// NEW: Read local file content
app.get('/api/local-file/:path', async (req, res) => {
  try {
    const { path: filePath } = req.params;
    
    // Validate file extension for local files as well
    if (!hasAllowedExtension(filePath)) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'Only .log, .out, .txt, and .zip files are allowed' 
      });
    }
    const { download = 'false' } = req.query;

    if (!filePath) {
      return res.status(400).json({ error: 'File path parameter is required' });
    }

    const fullPath = path.join(__dirname, '../../', filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileContent = fs.readFileSync(fullPath, 'utf8');

    if (download === 'true') {
      const filename = filePath.split('/').pop();
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(fileContent);
    } else {
      res.json({
        content: fileContent,
        filename: filePath.split('/').pop(),
        filepath: filePath,
        size: fileContent.length
      });
    }
  } catch (error) {
    console.error('Error reading local file:', error);
    res.status(500).json({ error: 'Failed to read local file' });
  }
});

// NEW: Serve log.txt specifically
app.get('/api/logs/local/log.txt', async (req, res) => {
  try {
    const logPath = path.join(__dirname, '../../log.txt');
    
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: 'log.txt not found' });
    }

    const fileContent = fs.readFileSync(logPath, 'utf8');
    res.json({
      content: fileContent,
      filename: 'log.txt',
      filepath: 'log.txt',
      size: fileContent.length
    });
  } catch (error) {
    console.error('Error reading log.txt:', error);
    res.status(500).json({ error: 'Failed to read log.txt' });
  }
});

// Test endpoint to verify execInContainer works
app.get('/api/test-exec/:environment/:namespace/:pod/:container', requireAuth, async (req, res) => {
  try {
    const { environment, namespace, pod, container } = req.params;
    
    console.log(`Testing execInContainer with: ${environment}/${namespace}/${pod}/${container}`);
    
    // Test 1: Simple ls command
    const lsResult = await execInContainer({
      environment, namespace, pod, container,
      command: ['ls', '/var/log/app'],
      timeoutMs: 5000,
      suppressTimeoutError: false
    });
    
    // Test 2: Cat the test file
    const catResult = await execInContainer({
      environment, namespace, pod, container,
      command: ['cat', '/var/log/app/test.log'],
      timeoutMs: 5000,
      suppressTimeoutError: false
    });
    
    res.json({
      success: true,
      tests: {
        ls_result: lsResult,
        cat_result: catResult,
        ls_length: lsResult ? lsResult.length : 0,
        cat_length: catResult ? catResult.length : 0
      }
    });
    
  } catch (error) {
    console.error('Test exec error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Explorer API routes (only user "explorer" can access)
const registerExplorerRoutes = require('./explorer-routes');
registerExplorerRoutes(app, {
  requireExplorerAccess,
  getK8sClient,
  ensureInitialized,
  getEnvironments: () => kubeConfigHandler.getEnvironments().length > 0
    ? kubeConfigHandler.getEnvironments()
    : Object.keys(ENVIRONMENT_CONFIGS)
});

// Admin API: Get all teams configuration
app.get('/api/admin/teams', requireAdmin, (req, res) => {
  try {
    res.json(getPolicyConfig());
  } catch (error) {
    console.error('Error reading teams config:', error);
    res.status(500).json({ error: 'Failed to read teams configuration' });
  }
});

// Admin API: Update teams configuration
app.put('/api/admin/teams', requireAdmin, (req, res) => {
  try {
    const newConfig = req.body;
    
    // Validate configuration structure
    if (!newConfig.teams || !newConfig.credentials) {
      return res.status(400).json({ error: 'Invalid configuration structure' });
    }
    
    fs.writeFileSync(getPolicyConfigPath(), JSON.stringify(newConfig, null, 2));
    reloadPolicyConfig();
    sessionCache.clear();
    
    res.json({ success: true, message: 'Teams configuration updated successfully' });
  } catch (error) {
    console.error('Error updating teams config:', error);
    res.status(500).json({ error: 'Failed to update teams configuration' });
  }
});

// Admin API: Add new team
app.post('/api/admin/teams', requireAdmin, (req, res) => {
  try {
    const { teamId, teamData } = req.body;
    
    if (!teamId || !teamData) {
      return res.status(400).json({ error: 'Team ID and data required' });
    }
    
    const config = getPolicyConfig();
    config.teams[teamId] = teamData;
    
    if (teamData.users && teamData.credentials) {
      teamData.users.forEach((user, index) => {
        if (teamData.credentials[index]) {
          config.credentials[user] = teamData.credentials[index];
        }
      });
    }
    
    fs.writeFileSync(getPolicyConfigPath(), JSON.stringify(config, null, 2));
    reloadPolicyConfig();
    
    res.json({ success: true, message: 'Team added successfully' });
  } catch (error) {
    console.error('Error adding team:', error);
    res.status(500).json({ error: 'Failed to add team' });
  }
});

// Admin API: Delete team
app.delete('/api/admin/teams/:teamId', requireAdmin, (req, res) => {
  try {
    const { teamId } = req.params;
    
    if (teamId === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin team' });
    }
    
    const config = getPolicyConfig();
    if (config.teams[teamId] && config.teams[teamId].users) {
      config.teams[teamId].users.forEach(user => {
        delete config.credentials[user];
      });
    }
    delete config.teams[teamId];
    
    fs.writeFileSync(getPolicyConfigPath(), JSON.stringify(config, null, 2));
    reloadPolicyConfig();
    
    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Admin API: Get available environments (from kubeconfig)
app.get('/api/admin/available-environments', requireAdmin, (req, res) => {
  try {
    const environments = Object.keys(ENVIRONMENT_CONFIGS);
    res.json(environments);
  } catch (error) {
    console.error('Error getting environments:', error);
    res.status(500).json({ error: 'Failed to get environments' });
  }
});

// Admin API: Get available namespaces for environment
app.get('/api/admin/available-namespaces/:environment', requireAdmin, async (req, res) => {
  try {
    const { environment } = req.params;
    
    // Check if environment exists in config
    if (!ENVIRONMENT_CONFIGS[environment]) {
      return res.status(404).json({ error: `Environment '${environment}' not found` });
    }
    
    const k8sClient = await getK8sClient(environment);
    const namespaces = await k8sClient.coreApi.listNamespace();
    
    const namespaceNames = namespaces.body.items.map(ns => ns.metadata.name);
    res.json(namespaceNames);
  } catch (error) {
    console.error(`Error getting namespaces for ${req.params.environment}:`, error.message);
    
    // Return empty array instead of error to prevent admin dashboard from breaking
    if (error.code === 'ERR_OSSL_PEM_BAD_END_LINE' || error.message.includes('PEM')) {
      console.warn(`PEM certificate issue for environment ${req.params.environment}, returning empty namespaces`);
      return res.json([]);
    }
    
    res.status(500).json({ error: 'Failed to get namespaces', details: error.message });
  }
});

// Admin API: Test team configuration
app.post('/api/admin/test-config', requireAdmin, async (req, res) => {
  try {
    const { environment, namespace, teamConfig } = req.body;
    
    // Test if team can access the environment/namespace
    const k8sClient = await getK8sClient(environment);
    const pods = await k8sClient.coreApi.listNamespacedPod(namespace);
    
    res.json({ 
      success: true, 
      message: 'Configuration test successful',
      podsFound: pods.body.items.length 
    });
  } catch (error) {
    console.error('Error testing config:', error);
    res.status(500).json({ error: 'Configuration test failed', details: error.message });
  }
});

// Admin API: Add new environment with kubeconfig
app.post('/api/admin/environments', requireAdmin, async (req, res) => {
  try {
    const { name, kubeconfig, description } = req.body;
    
    if (!name || !kubeconfig) {
      return res.status(400).json({ error: 'Environment name and kubeconfig are required' });
    }
    
    // Validate kubeconfig format
    let kubeconfigObj;
    try {
      kubeconfigObj = typeof kubeconfig === 'string' ? JSON.parse(kubeconfig) : kubeconfig;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid kubeconfig format. Must be valid JSON.' });
    }
    
    // Check if environment already exists
    if (ENVIRONMENT_CONFIGS[name]) {
      return res.status(409).json({ error: 'Environment already exists' });
    }
    
    // Save kubeconfig to file system
    const fs = require('fs');
    const kubeconfigDir = process.env.KUBECONFIG_PATH || './configs';
    
    // Ensure configs directory exists
    if (!fs.existsSync(kubeconfigDir)) {
      fs.mkdirSync(kubeconfigDir, { recursive: true });
    }
    
    const kubeconfigPath = path.join(kubeconfigDir, `${name}-kubeconfig.json`);
    fs.writeFileSync(kubeconfigPath, JSON.stringify(kubeconfigObj, null, 2));
    
    // Add to environment configs
    ENVIRONMENT_CONFIGS[name] = {
      name,
      description: description || '',
      kubeconfigPath,
      createdAt: new Date().toISOString()
    };
    
    // Save environment configs to persistent storage
    const configPath = path.join(__dirname, '../config/environments.json');
    fs.writeFileSync(configPath, JSON.stringify(ENVIRONMENT_CONFIGS, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Environment added successfully',
      environment: { name, description }
    });
  } catch (error) {
    console.error('Error adding environment:', error);
    res.status(500).json({ error: 'Failed to add environment', details: error.message });
  }
});

// Admin API: Test environment connectivity
app.post('/api/admin/environments/:name/test', requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!ENVIRONMENT_CONFIGS[name]) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    
    // Test connectivity by trying to list namespaces
    const k8sClient = getK8sClient(name);
    const namespaces = await k8sClient.coreApi.listNamespace();
    
    res.json({ 
      success: true, 
      message: 'Environment connectivity test successful',
      namespacesFound: namespaces.body.items.length,
      namespaces: namespaces.body.items.map(ns => ns.metadata.name)
    });
  } catch (error) {
    console.error('Error testing environment connectivity:', error);
    res.status(500).json({ 
      error: 'Environment connectivity test failed', 
      details: error.message 
    });
  }
});

// Admin API: Delete environment
app.delete('/api/admin/environments/:name', requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!ENVIRONMENT_CONFIGS[name]) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    
    if (['sbx', 'dev', 'devint', 'qa', 'prod'].includes(name)) {
      return res.status(400).json({ error: 'Cannot delete default environments' });
    }
    
    // Remove kubeconfig file
    const fs = require('fs');
    const kubeconfigPath = ENVIRONMENT_CONFIGS[name].kubeconfigPath;
    if (fs.existsSync(kubeconfigPath)) {
      fs.unlinkSync(kubeconfigPath);
    }
    
    // Remove from environment configs
    delete ENVIRONMENT_CONFIGS[name];
    
    // Save updated environment configs
    const path = require('path');
    const configPath = path.join(__dirname, '../config/environments.json');
    fs.writeFileSync(configPath, JSON.stringify(ENVIRONMENT_CONFIGS, null, 2));
    
    res.json({ success: true, message: 'Environment deleted successfully' });
  } catch (error) {
    console.error('Error deleting environment:', error);
    res.status(500).json({ error: 'Failed to delete environment', details: error.message });
  }
});

// Admin API: Get environment details
app.get('/api/admin/environments/:name', requireAdmin, (req, res) => {
  try {
    const { name } = req.params;
    
    if (!ENVIRONMENT_CONFIGS[name]) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    
    const envConfig = ENVIRONMENT_CONFIGS[name];
    res.json({
      name: envConfig.name,
      description: envConfig.description,
      createdAt: envConfig.createdAt,
      hasKubeconfig: !!envConfig.kubeconfigPath
    });
  } catch (error) {
    console.error('Error getting environment details:', error);
    res.status(500).json({ error: 'Failed to get environment details' });
  }
});

// Admin API: Get environment-specific users
app.get('/api/admin/environments/:name/users', requireAdmin, (req, res) => {
  try {
    const { name } = req.params;
    
    if (!ENVIRONMENT_CONFIGS[name]) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    
    // Get users who have access to this environment
    const policy = getPolicyConfig();
    const envUsers = [];
    Object.entries(policy.teams).forEach(([teamKey, teamData]) => {
      if (teamKey === 'admin') return; // Skip admin team
      
      teamData.users.forEach(user => {
        if (teamData.environments === '*' || teamData.environments.includes(name)) {
          if (!envUsers.find(u => u.username === user)) {
            envUsers.push({
              username: user,
              teamId: teamKey,
              teamName: teamData.name,
              hasCredentials: !!policy.credentials[user]
            });
          }
        }
      });
    });
    
    res.json(envUsers);
  } catch (error) {
    console.error('Error getting environment users:', error);
    res.status(500).json({ error: 'Failed to get environment users' });
  }
});

// Admin API: Add user credentials for environment
app.post('/api/admin/environments/:name/users', requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const { username, password, teamId } = req.body;
    
    if (!ENVIRONMENT_CONFIGS[name]) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const config = getPolicyConfig();
    config.credentials[username] = password;
    
    if (teamId && config.teams[teamId]) {
      if (!config.teams[teamId].users.includes(username)) {
        config.teams[teamId].users.push(username);
      }
    }
    
    fs.writeFileSync(getPolicyConfigPath(), JSON.stringify(config, null, 2));
    reloadPolicyConfig();
    
    res.json({ 
      success: true, 
      message: 'User credentials added successfully',
      user: { username, teamId }
    });
  } catch (error) {
    console.error('Error adding user credentials:', error);
    res.status(500).json({ error: 'Failed to add user credentials', details: error.message });
  }
});

// Admin API: Update user credentials
app.put('/api/admin/environments/:name/users/:username', requireAdmin, async (req, res) => {
  try {
    const { name, username } = req.params;
    const { password, teamId } = req.body;
    
    if (!ENVIRONMENT_CONFIGS[name]) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    
    const config = getPolicyConfig();
    if (!config.credentials[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (password) {
      config.credentials[username] = password;
    }
    
    if (teamId && config.teams[teamId]) {
      Object.values(config.teams).forEach(team => {
        team.users = team.users.filter(u => u !== username);
      });
      if (!config.teams[teamId].users.includes(username)) {
        config.teams[teamId].users.push(username);
      }
    }
    
    fs.writeFileSync(getPolicyConfigPath(), JSON.stringify(config, null, 2));
    reloadPolicyConfig();
    
    res.json({ 
      success: true, 
      message: 'User credentials updated successfully'
    });
  } catch (error) {
    console.error('Error updating user credentials:', error);
    res.status(500).json({ error: 'Failed to update user credentials', details: error.message });
  }
});

// Admin API: Delete user credentials
app.delete('/api/admin/environments/:name/users/:username', requireAdmin, async (req, res) => {
  try {
    const { name, username } = req.params;
    
    if (!ENVIRONMENT_CONFIGS[name]) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    
    const config = getPolicyConfig();
    if (!config.credentials[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    delete config.credentials[username];
    Object.values(config.teams).forEach(team => {
      team.users = team.users.filter(u => u !== username);
    });
    
    fs.writeFileSync(getPolicyConfigPath(), JSON.stringify(config, null, 2));
    reloadPolicyConfig();
    
    res.json({ 
      success: true, 
      message: 'User credentials deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user credentials:', error);
    res.status(500).json({ error: 'Failed to delete user credentials', details: error.message });
  }
});

// Admin API: Upload kubeconfig to add new environment
app.post('/api/admin/upload-kubeconfig', requireAdmin, upload.single('kubeconfig'), async (req, res) => {
  try {
    const { environmentName } = req.body;
    const kubeconfigFile = req.file;

    if (!kubeconfigFile || !environmentName) {
      return res.status(400).json({ error: 'Kubeconfig file and environment name are required' });
    }

    // Validate environment name
    if (!/^[a-z0-9-]+$/.test(environmentName)) {
      return res.status(400).json({ error: 'Environment name must contain only lowercase letters, numbers, and hyphens' });
    }

    // Check if environment already exists
    if (ENVIRONMENT_CONFIGS[environmentName]) {
      return res.status(400).json({ error: 'Environment already exists' });
    }

    // Read and validate kubeconfig file
    const kubeconfigPath = kubeconfigFile.path;
    const kubeconfigContent = fs.readFileSync(kubeconfigPath, 'utf8');
    
    try {
      const kubeconfigData = yaml.load(kubeconfigContent);
      
      // Basic validation
      if (!kubeconfigData.clusters || !kubeconfigData.users || !kubeconfigData.contexts) {
        throw new Error('Invalid kubeconfig format');
      }
    } catch (parseError) {
      fs.unlinkSync(kubeconfigPath); // Clean up uploaded file
      return res.status(400).json({ error: 'Invalid kubeconfig file format' });
    }

    // Create configs directory if it doesn't exist
    const configsDir = path.join(__dirname, '../configs');
    if (!fs.existsSync(configsDir)) {
      fs.mkdirSync(configsDir, { recursive: true });
    }

    // Save kubeconfig file
    const savedPath = path.join(configsDir, `${environmentName}-kubeconfig.yaml`);
    fs.copyFileSync(kubeconfigPath, savedPath);
    fs.unlinkSync(kubeconfigPath); // Clean up temp file

    // Add to ENVIRONMENT_CONFIGS
    ENVIRONMENT_CONFIGS[environmentName] = {
      kubeconfig: savedPath,
      custom: true
    };

    // Initialize Kubernetes client for new environment
    try {
      const k8sClient = getK8sClient(environmentName);
      console.log(`✅ Initialized Kubernetes client for environment: ${environmentName}`);
    } catch (initError) {
      console.warn(`⚠️ Could not initialize client for ${environmentName}: ${initError.message}`);
    }

    res.json({ 
      success: true, 
      message: `Environment '${environmentName}' added successfully`,
      environmentName 
    });

  } catch (error) {
    console.error('Error uploading kubeconfig:', error);
    res.status(500).json({ error: 'Failed to upload kubeconfig' });
  }
});

// Admin API: Download kubeconfig for environment
app.get('/api/admin/download-kubeconfig/:environment', requireAdmin, (req, res) => {
  try {
    const { environment } = req.params;
    
    if (!ENVIRONMENT_CONFIGS[environment]) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    const kubeconfigPath = ENVIRONMENT_CONFIGS[environment].kubeconfig;
    
    if (!fs.existsSync(kubeconfigPath)) {
      return res.status(404).json({ error: 'Kubeconfig file not found' });
    }

    res.download(kubeconfigPath, `${environment}-kubeconfig.yaml`);
  } catch (error) {
    console.error('Error downloading kubeconfig:', error);
    res.status(500).json({ error: 'Failed to download kubeconfig' });
  }
});

// Admin API: Remove environment
app.delete('/api/admin/remove-environment/:environment', requireAdmin, (req, res) => {
  try {
    const { environment } = req.params;
    
    // Protect default environments
    const protectedEnvironments = Object.keys(ENVIRONMENT_CONFIGS).slice(0, 2); // Protect first 2 discovered environments
    if (protectedEnvironments.includes(environment)) {
      return res.status(400).json({ error: 'Cannot remove core environments' });
    }

    if (!ENVIRONMENT_CONFIGS[environment]) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    // Remove kubeconfig file if it's a custom environment
    if (ENVIRONMENT_CONFIGS[environment].custom) {
      const kubeconfigPath = ENVIRONMENT_CONFIGS[environment].kubeconfig;
      if (fs.existsSync(kubeconfigPath)) {
        fs.unlinkSync(kubeconfigPath);
      }
    }

    // Remove from ENVIRONMENT_CONFIGS
    delete ENVIRONMENT_CONFIGS[environment];

    res.json({ 
      success: true, 
      message: `Environment '${environment}' removed successfully` 
    });

  } catch (error) {
    console.error('Error removing environment:', error);
    res.status(500).json({ error: 'Failed to remove environment' });
  }
});

// Admin API: Create environment from kubeconfig content
app.post('/api/admin/create-environment', requireAdmin, async (req, res) => {
  try {
    const { environmentName, kubeconfigContent } = req.body;

    if (!kubeconfigContent || !environmentName) {
      return res.status(400).json({ error: 'Kubeconfig content and environment name are required' });
    }

    // Validate environment name
    if (!/^[a-z0-9-]+$/.test(environmentName)) {
      return res.status(400).json({ error: 'Environment name must contain only lowercase letters, numbers, and hyphens' });
    }

    // Check if environment already exists
    if (ENVIRONMENT_CONFIGS[environmentName]) {
      return res.status(400).json({ error: 'Environment already exists' });
    }

    // Validate kubeconfig content
    try {
      const kubeconfigData = yaml.load(kubeconfigContent);
      
      // Basic validation
      if (!kubeconfigData.clusters || !kubeconfigData.users || !kubeconfigData.contexts) {
        throw new Error('Invalid kubeconfig format');
      }
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid kubeconfig content format' });
    }

    // Create configs directory if it doesn't exist
    const configsDir = path.join(__dirname, '../configs');
    if (!fs.existsSync(configsDir)) {
      fs.mkdirSync(configsDir, { recursive: true });
    }

    // Save kubeconfig content to file
    const savedPath = path.join(configsDir, `${environmentName}-kubeconfig.yaml`);
    fs.writeFileSync(savedPath, kubeconfigContent, 'utf8');

    // Add to ENVIRONMENT_CONFIGS
    ENVIRONMENT_CONFIGS[environmentName] = {
      kubeconfig: savedPath,
      custom: true
    };

    // Initialize Kubernetes client for new environment
    try {
      const k8sClient = getK8sClient(environmentName);
      console.log(`✅ Initialized Kubernetes client for environment: ${environmentName}`);
    } catch (initError) {
      console.warn(`⚠️ Could not initialize client for ${environmentName}: ${initError.message}`);
    }

    res.json({ 
      success: true, 
      message: `Environment '${environmentName}' created successfully`,
      environmentName 
    });

  } catch (error) {
    console.error('Error creating environment from content:', error);
    res.status(500).json({ error: 'Failed to create environment' });
  }
});

// Get available environments for all teams
app.get('/api/teams/environments', (req, res) => {
  try {
    const teamEnvironments = {};
    
    Object.entries(getPolicyConfig().teams).forEach(([teamKey, teamData]) => {
      if (teamKey === 'admin') return; // Skip admin team
      
      teamEnvironments[teamKey] = {
        name: teamData.name,
        environments: teamData.environments === '*' ? ['All Environments'] : teamData.environments,
        namespaces: teamData.namespaces
      };
    });
    
    res.json(teamEnvironments);
  } catch (error) {
    console.error('Error fetching team environments:', error);
    res.status(500).json({ error: 'Failed to fetch team environments' });
  }
});

// Catch-all handler: send back React's index.html file for SPA routing
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(__dirname, 'public', 'index.html');
  console.log(`[SPA] Request: ${req.path}, Serving index.html from: ${indexPath}`);
  console.log(`[SPA] File exists: ${fs.existsSync(indexPath)}`);
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.log(`[SPA] index.html not found`);
    const publicDir = path.join(__dirname, 'public');
    console.log(`[SPA] Checking public directory: ${publicDir}`);
    console.log(`[SPA] Directory exists: ${fs.existsSync(publicDir)}`);
    
    if (fs.existsSync(publicDir)) {
      try {
        const files = fs.readdirSync(publicDir);
        console.log(`[SPA] Public directory contents (${files.length} items):`, files.slice(0, 10));
      } catch (err) {
        console.log(`[SPA] Error reading public directory:`, err.message);
      }
    }
    
    // Try alternative locations
    const altPaths = [
      path.join(__dirname, '..', '..', 'dist', 'index.html'),
      path.join(process.cwd(), 'dist', 'index.html'),
      '/app/dist/index.html'
    ];
    
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log(`[SPA] Found index.html at alternative path: ${altPath}`);
        return res.sendFile(altPath);
      }
    }
    
    res.status(404).send('Frontend files not found. Please rebuild the Docker image.');
  }
});

const listenPort = getListenPort();
app.listen(listenPort, () => {
  console.log(`Backend API running on port ${listenPort}`);
});

// Helper function to validate namespace pattern
function validateNamespacePattern(pattern) {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Helper function to validate container path access
function validateContainerPath(path, userTeam) {
  const teamConfig = getPolicyConfig().teams[userTeam];
  if (!teamConfig) return false;
  
  // Admin has access to all paths
  if (userTeam === 'admin') return true;
  
  const allowedPaths = teamConfig.allowedPaths || [];
  const blockedPaths = teamConfig.blockedPaths || [];
  
  // Check blocked paths first
  for (const blocked of blockedPaths) {
    if (path.startsWith(blocked)) return false;
  }
  
  // Check allowed paths
  for (const allowed of allowedPaths) {
    // Handle wildcard patterns like /scripts/* or /data/*/logs/*
    if (allowed.includes('*')) {
      // Extract base path (without the /*)
      const basePath = allowed.replace(/\/\*$/, '');
      
      // Check if path exactly matches the base directory (e.g., /app matches /app/*)
      if (path === basePath) {
        return true;
      }
      
      // Convert wildcard pattern to regex
      const regexPattern = allowed
        .replace(/\//g, '\\/')  // Escape slashes
        .replace(/\*/g, '[^/]*'); // Replace * with non-slash characters
      const regex = new RegExp(`^${regexPattern}`);
      if (regex.test(path)) return true;
    } else if (path.startsWith(allowed)) {
      return true;
    }
  }
  
  return false;
}

// Helper function to get user team from request
function getUserTeamFromRequest(req) {
  const sessionId = req.headers['x-session-id'];
  const session = sessionCache.get(sessionId);
  if (!session) {
    return null;
  }
  return session.team;
}

// Test endpoint to verify dynamic environment discovery
app.get('/api/test/environments', (req, res) => {
  try {
    const environmentDetails = {};
    
    Object.keys(ENVIRONMENT_CONFIGS).forEach(env => {
      const configPath = ENVIRONMENT_CONFIGS[env];
      const contextInfo = environmentContexts[env] || {};
      const isConnected = !!k8sClients[env];
      
      environmentDetails[env] = {
        configFile: path.basename(configPath),
        configPath: configPath,
        contextName: contextInfo.contextName || 'Unknown',
        extractedEnv: contextInfo.extractedEnv || env,
        connected: isConnected,
        server: contextInfo.server || 'Unknown',
        lastConnected: contextInfo.lastConnected || null,
        lastError: contextInfo.lastError || null
      };
    });
    
    res.json({
      totalEnvironments: Object.keys(ENVIRONMENT_CONFIGS).length,
      configDirectory: KUBECONFIG_BASE_PATH,
      environments: environmentDetails,
      discoveryMethod: 'Dynamic file scanning',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test environments endpoint:', error);
    res.status(500).json({ error: 'Failed to get environment details' });
  }
});

// Get nodes for an environment (Kubernetes auto-discovery; policy-filtered)
app.get('/api/nodes/:environment', requireAuth, async (req, res) => {
  try {
    const { environment } = req.params;
    const team = getPolicyConfig().teams[req.user.team];
    if (!team) return res.status(403).json({ error: 'Team not found' });
    if (!hasEnvironmentAccess(team, environment)) return res.status(403).json({ error: 'Access denied to this environment' });
    const k8sClient = await getK8sClient(environment);
    const response = await k8sClient.coreApi.listNode();
    const nodes = (response.body.items || []).map(node => ({
      name: node.metadata.name,
      status: node.status?.conditions?.find(c => c.type === 'Ready')?.status || 'Unknown',
      age: node.metadata.creationTimestamp,
      roles: node.metadata.labels?.['node-role.kubernetes.io/master'] ? 'master' : 'worker',
    }));
    res.json(nodes);
  } catch (error) {
    logger.error('Error fetching nodes:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch nodes' });
  }
});

// Get namespaces for an environment (filtered by team access)
app.get('/api/namespaces/:environment', requireAuth, async (req, res) => {
  try {
    const { environment } = req.params;
    
    // Get user's team and check access
    const team = getPolicyConfig().teams[req.user.team];
    if (!team) {
      return res.status(403).json({ error: 'Team not found' });
    }
    
    // Check environment access
    if (!hasEnvironmentAccess(team, environment)) {
      return res.status(403).json({ error: 'Access denied to this environment' });
    }
    
    // Get environment-specific Kubernetes client
    const k8sClient = await getK8sClient(environment);
    const response = await k8sClient.coreApi.listNamespace();
    const allNamespaces = response.body.items.map(ns => ns.metadata.name);

    // Always hide deployment namespaces (e.g. apps-sbxkubelens) from the list
    const visibleNamespaces = allNamespaces.filter(ns => !isHiddenNamespace(ns));

    if (req.user.team === 'admin') {
      res.json(visibleNamespaces.sort());
      return;
    }

    // Use policy-driven access: namespaceRules + team namespacePattern + team prefix (hasNamespaceAccess)
    const filteredNamespaces = visibleNamespaces.filter(ns =>
      hasNamespaceAccess(team, environment, ns)
    );
    logger.debug(`Namespaces for team ${team.name} in ${environment}: ${filteredNamespaces.length} of ${visibleNamespaces.length}`);
    res.json(filteredNamespaces.sort());
  } catch (error) {
    console.error('Error fetching namespaces:', error);
    
    // Provide more specific error messages for common issues
    let errorMessage = 'Failed to fetch namespaces';
    if (error.code === 'ERR_OSSL_PEM_BAD_END_LINE') {
      errorMessage = 'Kubeconfig certificate formatting error. Please check your kubeconfig file.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to Kubernetes cluster. Check cluster availability.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Kubernetes cluster endpoint not found. Check kubeconfig server URL.';
    }
    
    res.status(500).json({ error: errorMessage, details: error.message });
  }
});