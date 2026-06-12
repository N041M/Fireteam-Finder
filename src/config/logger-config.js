/**
 * Configuration for the user interaction logging system
 * This file provides functions to initialize and configure the interaction logger
 */
const path = require('path');
const fs = require('fs');

/**
 * Configure the interaction logger with custom settings
 * This should be called early in the application startup
 * @param {Object} options - Optional override configuration
 * @returns {Object} The configured logger instance
 */
function configureInteractionLogger(options = {}) {
  // Create logs directory if it doesn't exist
  const logsDir = options.logsDir || path.join(process.cwd(), 'logs', 'interactions');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Determine environment-specific settings
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isDebug = process.env.DEBUG === 'true';
  
  // Default configuration
  const defaultConfig = {
    // Directory to store log files
    logsDir: logsDir,
    
    // Name of the log file
    filename: 'user-activity.log',
    
    // Maximum file size before rotation (in bytes)
    maxFileSize: 5 * 1024 * 1024, // 5MB
    
    // Maximum number of rotated log files to keep
    maxFiles: 7, // One week of logs if rotated daily
    
    // Log level (debug, info, warn, error)
    logLevel: isDevelopment || isDebug ? 'debug' : 'info',
    
    // Whether to also log to console
    console: isDevelopment || isDebug
  };

  // Merge default config with provided options
  const config = { ...defaultConfig, ...options };

  // Initialize the interaction logger with the configuration
  const interactionLogger = require('../utils/interaction-logger');
  
  // Configure the logger with our settings
  interactionLogger.initialize(config);
  
  // Log startup message
  interactionLogger.writeLog('info', 'Interaction logger initialized', { 
    configurationPath: __filename,
    logDirectory: config.logsDir,
    logLevel: config.logLevel
  });
  
  return interactionLogger;
}

/**
 * Get the configured log directory path
 * @returns {string} Path to the log directory
 */
function getLogDirectory() {
  try {
    const logger = require('../utils/interaction-logger');
    return logger.options ? logger.options.logsDir : path.join(process.cwd(), 'logs', 'interactions');
  } catch (error) {
    // If logger not initialized yet, return default
    return path.join(process.cwd(), 'logs', 'interactions');
  }
}

module.exports = {
  configureInteractionLogger,
  getLogDirectory
};