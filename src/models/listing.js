/**
 * Represents an LFG listing
 */
class Listing {
  /**
   * Create a new listing
   * @param {Object} data - Listing data
   */
  constructor(data) {
    this.id = data.id;
    this.guildId = data.guildId;
    this.hostId = data.hostId;
    this.activityValue = data.activityValue;
    this.activityName = data.activityName;
    this.difficultyValue = data.difficultyValue || null;
    this.startTime = data.startTime;
    this.indefinite = data.indefinite || false;
    this.description = data.description;
    this.fireteamSize = data.fireteamSize;
    this.textChannelId = data.textChannelId;
    this.voiceChannelId = data.voiceChannelId;
    this.categoryId = data.categoryId;
    this.roleId = data.roleId;
    this.messageId = data.messageId;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.participants = data.participants || [data.hostId]; // Host is always first participant
    this.substitutes = data.substitutes || [];
    this.tags = data.tags || []; // Activity tags (sherpa, lowman, etc.)
  }

  /**
   * Check if a user is a participant
   * @param {string} userId - User ID
   * @returns {boolean} True if user is a participant
   */
  hasParticipant(userId) {
    return this.participants.includes(userId);
  }

  /**
   * Check if a user is a substitute
   * @param {string} userId - User ID
   * @returns {boolean} True if user is a substitute
   */
  hasSubstitute(userId) {
    return this.substitutes.includes(userId);
  }

  /**
   * Check if the fireteam is full
   * @param {boolean} hostOverride - If true, ignores size limit
   * @returns {boolean} True if the fireteam is full
   */
  isFull(hostOverride = false) {
    if (hostOverride) return false;
    return this.participants.length >= this.fireteamSize;
  }

  /**
   * Add a participant
   * @param {string} userId - User ID
   * @param {boolean} hostOverride - If true, ignores size limit
   * @returns {boolean} True if added successfully
   */
  addParticipant(userId, hostOverride = false) {
    if (this.hasParticipant(userId)) {
      return false;
    }
    
    if (!hostOverride && this.isFull()) {
      return false;
    }
    
    this.participants.push(userId);
    return true;
  }

  /**
   * Remove a participant
   * @param {string} userId - User ID
   * @returns {boolean} True if removed successfully
   */
  removeParticipant(userId) {
    const index = this.participants.indexOf(userId);
    if (index === -1) {
      return false;
    }
    
    this.participants.splice(index, 1);
    return true;
  }

  /**
   * Add a substitute
   * @param {string} userId - User ID
   * @returns {boolean} True if added successfully
   */
  addSubstitute(userId) {
    if (this.hasSubstitute(userId) || this.hasParticipant(userId)) {
      return false;
    }
    
    this.substitutes.push(userId);
    return true;
  }

  /**
   * Remove a substitute
   * @param {string} userId - User ID
   * @returns {boolean} True if removed successfully
   */
  removeSubstitute(userId) {
    const index = this.substitutes.indexOf(userId);
    if (index === -1) {
      return false;
    }
    
    this.substitutes.splice(index, 1);
    return true;
  }

  /**
   * Promote a substitute to participant
   * @param {string} userId - User ID
   * @param {boolean} hostOverride - If true, ignores size limit
   * @returns {boolean} True if promoted successfully
   */
  promoteSubstitute(userId, hostOverride = false) {
    if (!this.hasSubstitute(userId)) {
      return false;
    }
    
    if (!hostOverride && this.isFull()) {
      return false;
    }
    
    // Remove from substitutes
    this.removeSubstitute(userId);
    
    // Add to participants
    return this.addParticipant(userId, hostOverride);
  }

  /**
   * Transfer host status to another participant
   * @param {string} newHostId - New host's user ID
   * @returns {boolean} True if transfer was successful
   */
  transferHost(newHostId) {
    if (!this.hasParticipant(newHostId)) {
      return false;
    }
    
    this.hostId = newHostId;
    return true;
  }

  /**
   * Check if listing has expired
   * @param {number} lifetimeMs - Listing lifetime in milliseconds
   * @returns {boolean} True if listing has expired
   */
  isExpired(lifetimeMs) {
    // If the listing is set to be indefinite, it never expires
    if (this.indefinite) {
      return false;
    }
    
    const now = new Date();
    const startTime = new Date(this.startTime);
    
    // The listing should expire if:
    // 1. The current time is past the scheduled start time AND
    // 2. The activity has been over for lifetimeMs
    return now >= startTime && (now > new Date(startTime.getTime() + lifetimeMs));
  }

  /**
   * Extend the listing time
   * @param {number} hours - Number of hours to extend
   */
  extendTime(hours) {
    const currentTime = new Date(this.startTime);
    const newTime = new Date(currentTime.getTime() + (hours * 60 * 60 * 1000));
    
    this.startTime = newTime.toISOString();
    this.indefinite = false;
  }

  /**
   * Make the listing indefinite (no end time)
   */
  makeIndefinite() {
    this.indefinite = true;
  }

  /**
   * Add spots to the fireteam
   * @param {number} spots - Number of spots to add
   * @returns {number} New fireteam size
   */
  addSpots(spots) {
    this.fireteamSize = Math.min(12, this.fireteamSize + spots);
    return this.fireteamSize;
  }

  /**
   * Remove spots from the fireteam
   * @param {number} spots - Number of spots to remove
   * @returns {number} New fireteam size
   */
  removeSpots(spots) {
    // Ensure we don't go below the minimum size (2) or below current participant count
    const minSize = Math.max(2, this.participants.length);
    this.fireteamSize = Math.max(minSize, this.fireteamSize - spots);
    return this.fireteamSize;
  }

  /**
   * Add a tag to the listing
   * @param {string} tag - Tag to add
   * @returns {boolean} True if tag was added
   */
  addTag(tag) {
    if (this.tags.includes(tag)) {
      return false;
    }
    this.tags.push(tag);
    return true;
  }

  /**
   * Remove a tag from the listing
   * @param {string} tag - Tag to remove
   * @returns {boolean} True if tag was removed
   */
  removeTag(tag) {
    if (!this.tags.includes(tag)) {
      return false;
    }
    this.tags = this.tags.filter(t => t !== tag);
    return true;
  }

  /**
   * Check if listing has a specific tag
   * @param {string} tag - Tag to check
   * @returns {boolean} True if listing has the tag
   */
  hasTag(tag) {
    return this.tags.includes(tag);
  }

  /**
   * Convert listing to plain object
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      guildId: this.guildId,
      hostId: this.hostId,
      activityValue: this.activityValue,
      activityName: this.activityName,
      difficultyValue: this.difficultyValue,
      startTime: this.startTime,
      indefinite: this.indefinite,
      description: this.description,
      fireteamSize: this.fireteamSize,
      textChannelId: this.textChannelId,
      voiceChannelId: this.voiceChannelId,
      categoryId: this.categoryId,
      roleId: this.roleId,
      messageId: this.messageId,
      createdAt: this.createdAt,
      participants: [...this.participants],
      substitutes: [...this.substitutes],
      tags: [...this.tags]
    };
  }
}

module.exports = Listing;