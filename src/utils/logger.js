/**
 * Logger utility for centralized logging
 */
class Logger {
    static info(message, data = null) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.log(`[${timestamp}] [INFO] ${message}`, data);
      } else {
        console.log(`[${timestamp}] [INFO] ${message}`);
      }
    }
    
    static warn(message, data = null) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.warn(`[${timestamp}] [WARN] ${message}`, data);
      } else {
        console.warn(`[${timestamp}] [WARN] ${message}`);
      }
    }

    static error(message, error = null) {
      const timestamp = new Date().toISOString();
      if (error) {
        console.error(`[${timestamp}] [ERROR] ${message}`, error);
        if (error.stack) {
          console.error(error.stack);
        }
      } else {
        console.error(`[${timestamp}] [ERROR] ${message}`);
      }
    }
    
    static debug(message, data = null) {
      if (process.env.DEBUG === 'true') {
        const timestamp = new Date().toISOString();
        if (data) {
          console.log(`[${timestamp}] [DEBUG] ${message}`, data);
        } else {
          console.log(`[${timestamp}] [DEBUG] ${message}`);
        }
      }
    }
  }
  
  module.exports = Logger;