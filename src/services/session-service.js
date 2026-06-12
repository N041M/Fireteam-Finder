/**
 * Service for managing user interaction sessions
 */
const config = require('../config');
const Logger = require('../utils/logger');

// States for LFG creation flow
const LfgState = {
  ACTIVITY_TYPE: 'activity_type',
  SPECIFIC_ACTIVITY: 'specific_activity',
  DIFFICULTY: 'difficulty',
  DETAILS: 'details',
  CREATING: 'creating',
  COMPLETED: 'completed',
  ERROR: 'error'
};

/**
 * Session class for tracking user interactions
 */
class Session {
  /**
   * Create a new session
   * @param {string} userId - User ID
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Message ID (optional)
   */
  constructor(userId, channelId, messageId = null) {
    this.userId = userId;
    this.channelId = channelId;
    this.messageId = messageId;
    this.state = LfgState.ACTIVITY_TYPE;
    this.data = {
      activityType: null,
      activityValue: null,
      activityName: null,
      difficultyValue: null,
      startTime: null,
      description: null,
      fireteamSize: null,
      isIndefinite: false,
      isCustomActivity: false,
      tags: []
    };
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Update session state
   * @param {string} state - New state
   * @returns {Session} This session for chaining
   */
  setState(state) {
    this.state = state;
    this.updatedAt = Date.now();
    return this;
  }

  /**
   * Update session data
   * @param {Object} data - New data to merge
   * @returns {Session} This session for chaining
   */
  updateData(data) {
    this.data = { ...this.data, ...data };
    this.updatedAt = Date.now();
    return this;
  }

  /**
   * Update message ID
   * @param {string} messageId - New message ID
   * @returns {Session} This session for chaining
   */
  setMessageId(messageId) {
    this.messageId = messageId;
    this.updatedAt = Date.now();
    return this;
  }

  /**
   * Reset the session
   * @returns {Session} This session for chaining
   */
  reset() {
    this.state = LfgState.ACTIVITY_TYPE;
    this.data = {
      activityType: null,
      activityValue: null,
      activityName: null,
      difficultyValue: null,
      startTime: null,
      description: null,
      fireteamSize: null,
      isIndefinite: false,
      isCustomActivity: false,
      tags: []
    };
    this.updatedAt = Date.now();
    return this;
  }

  /**
   * Check if the session has expired
   * @returns {boolean} True if expired
   */
  isExpired() {
    const now = Date.now();
    return (now - this.updatedAt) > config.SESSION_TIMEOUT_MS;
  }
}

/**
 * Service for managing user sessions
 */
class SessionService {
  constructor() {
    this.sessions = new Map();
    
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredSessions(), 60000); // Run every minute
  }

  /**
   * Create or get a session
   * @param {string} userId - User ID
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Message ID (optional)
   * @returns {Session} New or existing session
   */
  getOrCreateSession(userId, channelId, messageId = null) {
    let session = this.getSession(userId);
    
    if (!session) {
      session = new Session(userId, channelId, messageId);
      this.sessions.set(userId, session);
      Logger.debug(`Created new session for user ${userId}`);
    }
    
    return session;
  }

  /**
   * Get a session
   * @param {string} userId - User ID
   * @returns {Session|null} Session or null if not found
   */
  getSession(userId) {
    return this.sessions.get(userId) || null;
  }

  /**
   * Remove a session
   * @param {string} userId - User ID
   * @returns {boolean} True if removed
   */
  removeSession(userId) {
    return this.sessions.delete(userId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    let count = 0;
    
    for (const [userId, session] of this.sessions.entries()) {
      if (session.isExpired()) {
        this.sessions.delete(userId);
        count++;
      }
    }
    
    if (count > 0) {
      Logger.debug(`Cleaned up ${count} expired sessions`);
    }
  }
}

// Create a singleton instance
const sessionService = new SessionService();

module.exports = {
  LfgState,
  Session,
  sessionService
};