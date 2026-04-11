// Log level control: 'error', 'warn', 'info', 'debug' (default: 'warn' for production)
const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.warn;

// Logging helper functions
const logger = {
  error: (...args) => console.error(...args),
  warn: (...args) => currentLogLevel >= LOG_LEVELS.warn && console.warn(...args),
  info: (...args) => currentLogLevel >= LOG_LEVELS.info && console.log(...args),
  debug: (...args) => currentLogLevel >= LOG_LEVELS.debug && console.log('[DEBUG]', ...args)
};

module.exports = logger;

