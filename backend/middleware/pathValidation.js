// Helper function to validate container path access
function validateContainerPath(path, userTeam, teamsConfig) {
  const teamConfig = teamsConfig.teams[userTeam];
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
function getUserTeamFromRequest(req, sessionCache) {
  const sessionId = req.headers['x-session-id'];
  const session = sessionCache.get(sessionId);
  if (!session) {
    return null;
  }
  return session.team;
}

module.exports = {
  validateContainerPath,
  getUserTeamFromRequest
};
