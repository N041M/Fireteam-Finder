/**
 * Interaction logger for tracking user actions
 * Extends the base logger to save user interactions to a dedicated file
 */
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

/**
 * Helper function to handle circular references in JSON.stringify
 */
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

// Create a singleton object for interaction logging
const interactionLogger = {
  options: {
    logsDir: 'logs',
    filename: 'user-interactions.log',
    maxFileSize: 5 * 1024 * 1024, // 5MB default
    maxFiles: 5,
    logLevel: 'info', // 'debug', 'info', 'warn', 'error'
    console: false // Only log to file by default
  },

  /**
   * Initialize logger with configuration options
   * @param {Object} options - Configuration options
   */
  initialize(options = {}) {
    // Merge options with defaults
    this.options = { ...this.options, ...options };
    
    // Ensure logs directory exists
    this.ensureLogsDirectory();
    
    // Current log file path
    this.logFilePath = path.join(this.options.logsDir, this.options.filename);
    
    return this;
  },

  /**
   * Ensure the logs directory exists
   */
  ensureLogsDirectory() {
    if (!fs.existsSync(this.options.logsDir)) {
      fs.mkdirSync(this.options.logsDir, { recursive: true });
    }
  },

  /**
   * Write a log entry to file
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  writeLog(level, message, data = null) {
    try {
      // Check if file rotation is needed
      this.checkRotation();

      const timestamp = new Date().toISOString();
      let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      if (data) {
        if (typeof data === 'object') {
          // Safely stringify objects, handling circular references
          try {
            logEntry += ` ${JSON.stringify(data, getCircularReplacer())}`;
          } catch (e) {
            logEntry += ` [Object: circular reference detected]`;
          }
        } else {
          logEntry += ` ${data}`;
        }
      }
      
      logEntry += '\n';
      
      // Append to log file
      fs.appendFileSync(this.logFilePath, logEntry);
      
      // Also log to console if enabled
      if (this.options.console) {
        Logger[level.toLowerCase()](message, data);
      }
    } catch (error) {
      // Fall back to console logging if file logging fails
      Logger.error(`Failed to write to interaction log: ${error.message}`, error);
    }
  },

  /**
   * Check if log rotation is needed and rotate if required
   */
  checkRotation() {
    try {
      // If file doesn't exist, no need to rotate
      if (!fs.existsSync(this.logFilePath)) {
        return;
      }
      
      // Check file size
      const stats = fs.statSync(this.logFilePath);
      if (stats.size < this.options.maxFileSize) {
        return;
      }
      
      // Rotate logs
      this.rotateLogFiles();
    } catch (error) {
      Logger.error(`Error checking log rotation: ${error.message}`, error);
    }
  },

  /**
   * Rotate log files
   */
  rotateLogFiles() {
    try {
      // Remove the oldest log file if it exists
      const oldestLog = path.join(
        this.options.logsDir, 
        `${path.basename(this.options.filename, path.extname(this.options.filename))}.${this.options.maxFiles - 1}${path.extname(this.options.filename)}`
      );
      
      if (fs.existsSync(oldestLog)) {
        fs.unlinkSync(oldestLog);
      }
      
      // Shift other log files
      for (let i = this.options.maxFiles - 2; i >= 0; i--) {
        const currentLog = path.join(
          this.options.logsDir,
          `${path.basename(this.options.filename, path.extname(this.options.filename))}.${i}${path.extname(this.options.filename)}`
        );
        
        const newLog = path.join(
          this.options.logsDir,
          `${path.basename(this.options.filename, path.extname(this.options.filename))}.${i + 1}${path.extname(this.options.filename)}`
        );
        
        if (fs.existsSync(currentLog)) {
          fs.renameSync(currentLog, newLog);
        }
      }
      
      // Rename current log file
      const newCurrentLog = path.join(
        this.options.logsDir,
        `${path.basename(this.options.filename, path.extname(this.options.filename))}.0${path.extname(this.options.filename)}`
      );
      
      fs.renameSync(this.logFilePath, newCurrentLog);
    } catch (error) {
      Logger.error(`Error rotating log files: ${error.message}`, error);
    }
  },

  /**
   * Log user interaction
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {string} details - Details about the action
   * @param {Object} data - Additional data
   */
  interaction(userId, action, details, data = null) {
    const message = `User ${userId} ${action}: ${details}`;
    this.writeLog('info', message, data);
  },

  /**
   * Log command usage
   * @param {string} userId - User ID
   * @param {string} command - Command used
   * @param {Object} options - Command options
   */
  command(userId, command, options = null) {
    const message = `User ${userId} used command: /${command}`;
    this.writeLog('info', message, options);
  },

  /**
   * Log button interaction
   * @param {string} userId - User ID
   * @param {string} buttonId - Button ID
   * @param {string} context - Context info
   */
  button(userId, buttonId, context = null) {
    const message = `User ${userId} clicked button: ${buttonId}`;
    this.writeLog('info', message, context);
  },

  /**
   * Log select menu interaction
   * @param {string} userId - User ID
   * @param {string} menuId - Menu ID
   * @param {Array} values - Selected values
   */
  selectMenu(userId, menuId, values = []) {
    const message = `User ${userId} selected from menu: ${menuId}`;
    this.writeLog('info', message, { values });
  },

  /**
   * Log modal submission
   * @param {string} userId - User ID
   * @param {string} modalId - Modal ID
   * @param {Object} values - Submitted values (optional - be careful with sensitive data)
   */
  modalSubmit(userId, modalId, values = null) {
    const message = `User ${userId} submitted modal: ${modalId}`;
    this.writeLog('info', message, values);
  },

  /**
   * Log user join/leave events
   * @param {string} userId - User ID
   * @param {string} action - 'joined' or 'left'
   * @param {string} listingId - Listing ID
   * @param {string} activityName - Activity name
   */
  participation(userId, action, listingId, activityName) {
    const message = `User ${userId} ${action} activity: ${activityName} (${listingId})`;
    this.writeLog('info', message);
  },

  /**
   * Log listing creation/modification events
   * @param {string} userId - User ID
   * @param {string} action - Action on listing ('created', 'modified', 'cancelled')
   * @param {string} listingId - Listing ID
   * @param {Object} details - Listing details
   */
  listing(userId, action, listingId, details = null) {
    const message = `User ${userId} ${action} listing: ${listingId}`;
    this.writeLog('info', message, details);
  },

  /**
   * Log error during user interaction
   * @param {string} userId - User ID
   * @param {string} context - Error context
   * @param {Error|string} error - Error object or message
   */
  error(userId, context, error) {
    const message = `Error for user ${userId} - ${context}`;
    this.writeLog('error', message, error);
  },

  /**
   * Log debug information for user interactions
   * @param {string} userId - User ID
   * @param {string} message - Debug message
   * @param {Object} data - Debug data
   */
  debug(userId, message, data = null) {
    if (this.options.logLevel === 'debug') {
      const debugMessage = `User ${userId}: ${message}`;
      this.writeLog('debug', debugMessage, data);
    }
  }
};

// Set default log directory and ensure it exists
interactionLogger.initialize();

module.exports = interactionLogger;