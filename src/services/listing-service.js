/**
 * Service for managing LFG listings with smart ID encoding
 */
const Listing = require('../models/listing');
const Logger = require('../utils/logger');

class ListingService {
  constructor() {
    this.listings = new Map();
    
    // Base 62 character set (0-9, A-Z, a-z)
    this.BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    this.BASE_DATE = new Date('2025-01-01T00:00:00Z');
  }

  /**
   * Convert number to Base 62 with specified length
   * @param {number} num - Number to convert
   * @param {number} length - Desired string length
   * @returns {string} Base 62 encoded string
   */
  toBase62(num, length) {
    if (num < 0) return '0'.repeat(length);
    
    let result = '';
    while (num > 0) {
      result = this.BASE62[num % 62] + result;
      num = Math.floor(num / 62);
    }
    return result.padStart(length, '0');
  }

  /**
   * Convert Base 62 string to number
   * @param {string} str - Base 62 string
   * @returns {number} Decoded number
   */
  fromBase62(str) {
    let result = 0;
    for (let char of str) {
      const index = this.BASE62.indexOf(char);
      if (index === -1) throw new Error(`Invalid Base 62 character: ${char}`);
      result = result * 62 + index;
    }
    return result;
  }

  /**
   * Generate random Base 62 character
   * @returns {string} Random character
   */
  randomBase62() {
    return this.BASE62[Math.floor(Math.random() * 62)];
  }

  /**
   * Generate a smart listing ID that encodes timing information
   * @param {Date} startTime - When the activity starts
   * @param {number} lifetimeMs - How long after start before cleanup (in milliseconds)
   * @param {boolean} isExtended - Whether this is an extended listing
   * @param {boolean} isIndefinite - Whether listing never expires
   * @returns {string} Encoded listing ID
   */
  generateId(startTime = null, lifetimeMs = 0, isExtended = false, isIndefinite = false) {
    const creationTime = new Date();
    const minutesSinceBase = Math.floor((creationTime - this.BASE_DATE) / (1000 * 60));
    
    // Encode creation time (4 characters)
    const creationPart = this.toBase62(minutesSinceBase, 4);
    
    if (isIndefinite) {
      // Format: IXXXXZZ (7 chars)
      const randomPart = this.randomBase62() + this.randomBase62();
      return `I${creationPart}${randomPart}`;
    }
    
    // Calculate total duration (start delay + cleanup lifetime)
    const startDelayMs = startTime ? Math.max(0, startTime - creationTime) : 0;
    const totalMs = startDelayMs + lifetimeMs;
    const totalHours = Math.round(totalMs / (1000 * 60 * 60));
    
    const durationPart = this.toBase62(Math.max(0, totalHours), 2);
    const randomPart = this.randomBase62();
    
    if (isExtended) {
      // Format: EXXXXYYZ (8 chars)
      return `E${creationPart}${durationPart}${randomPart}`;
    } else {
      // Format: XXXXYYZ (7 chars)
      return `${creationPart}${durationPart}${randomPart}`;
    }
  }

  /**
   * Decode timing information from listing ID
   * @param {string} id - Listing ID
   * @returns {Object} Decoded information
   */
  decodeId(id) {
    if (!id || id.length < 5) {
      throw new Error('Invalid ID length');
    }

    let isExtended = false;
    let isIndefinite = false;
    let workingId = id.toUpperCase();

    // Check for special prefixes
    if (workingId.startsWith('E')) {
      isExtended = true;
      workingId = workingId.substring(1);
    } else if (workingId.startsWith('I')) {
      isIndefinite = true;
      workingId = workingId.substring(1);
    }

    if (isIndefinite) {
      // Format: XXXXZZ (6 chars after removing I)
      if (workingId.length !== 6) {
        throw new Error('Invalid indefinite ID format');
      }
      
      const creationPart = workingId.substring(0, 4);
      const randomPart = workingId.substring(4);
      
      const minutesSinceBase = this.fromBase62(creationPart);
      const creationTime = new Date(this.BASE_DATE.getTime() + minutesSinceBase * 60 * 1000);
      
      return {
        type: 'indefinite',
        isExtended: false,
        isIndefinite: true,
        creationTime,
        cleanupTime: null,
        durationHours: null,
        randomPart,
        raw: id
      };
    } else {
      // Format: XXXXYYZ (7 chars)
      if (workingId.length !== 7) {
        throw new Error('Invalid normal/extended ID format');
      }
      
      const creationPart = workingId.substring(0, 4);
      const durationPart = workingId.substring(4, 6);
      const randomPart = workingId.substring(6);
      
      const minutesSinceBase = this.fromBase62(creationPart);
      const durationHours = this.fromBase62(durationPart);
      
      const creationTime = new Date(this.BASE_DATE.getTime() + minutesSinceBase * 60 * 1000);
      const cleanupTime = new Date(creationTime.getTime() + durationHours * 60 * 60 * 1000);
      
      return {
        type: isExtended ? 'extended' : 'normal',
        isExtended,
        isIndefinite: false,
        creationTime,
        cleanupTime,
        durationHours,
        randomPart,
        raw: id
      };
    }
  }

  /**
   * Check if a listing ID indicates an expired listing
   * @param {string} id - Listing ID
   * @returns {boolean} True if expired
   */
  isIdExpired(id) {
    try {
      const decoded = this.decodeId(id);
      if (decoded.isIndefinite) return false;
      
      return Date.now() >= decoded.cleanupTime.getTime();
    } catch (error) {
      Logger.error(`Error checking if ID ${id} is expired:`, error);
      return false; // Assume not expired if we can't decode
    }
  }

  /**
   * Create a new listing
   * @param {Object} data - Listing data
   * @returns {Listing} The created listing
   */
  createListing(data) {
    // Generate ID with timing information if not provided
    let id = data.id;
    
    if (!id) {
      const startTime = data.startTime ? new Date(data.startTime) : new Date();
      const lifetimeMs = data.lifetimeMs || (60 * 60 * 1000); // Default 1 hour
      const isIndefinite = data.indefinite || false;
      
      id = this.generateId(startTime, lifetimeMs, false, isIndefinite);
    }
    
    const listing = new Listing({ ...data, id });

    this.listings.set(id.toUpperCase(), listing);
    Logger.debug(`Created listing: ${id}`);

    return listing;
  }

  /**
   * Update a listing's ID when it's extended
   * @param {string} oldId - Current listing ID
   * @param {Date} newStartTime - New start time
   * @param {number} lifetimeMs - Cleanup lifetime
   * @returns {string|null} New ID if successful, null if failed
   */
  updateListingIdForExtension(oldId, newStartTime, lifetimeMs) {
    try {
      const listing = this.getListing(oldId);
      if (!listing) return null;
      
      // Generate new extended ID
      const newId = this.generateId(newStartTime, lifetimeMs, true, false);
      
      // Update the listing with new ID
      listing.id = newId;

      // Update the map
      this.listings.delete(oldId.toUpperCase());
      this.listings.set(newId.toUpperCase(), listing);

      Logger.debug(`Updated listing ID from ${oldId} to ${newId} (extended)`);
      return newId;
    } catch (error) {
      Logger.error(`Error updating listing ID for extension:`, error);
      return null;
    }
  }

  /**
   * Update a listing's ID when made indefinite
   * @param {string} oldId - Current listing ID
   * @returns {string|null} New ID if successful, null if failed
   */
  updateListingIdForIndefinite(oldId) {
    try {
      const listing = this.getListing(oldId);
      if (!listing) return null;
      
      // Generate new indefinite ID
      const newId = this.generateId(null, 0, false, true);
      
      // Update the listing with new ID
      listing.id = newId;

      // Update the map
      this.listings.delete(oldId.toUpperCase());
      this.listings.set(newId.toUpperCase(), listing);

      Logger.debug(`Updated listing ID from ${oldId} to ${newId} (indefinite)`);
      return newId;
    } catch (error) {
      Logger.error(`Error updating listing ID for indefinite:`, error);
      return null;
    }
  }

  /**
   * Get a listing by ID (case-insensitive)
   * @param {string} id - Listing ID
   * @returns {Listing|null} The listing or null if not found
   */
  getListing(id) {
    if (!id) return null;

    // Listings are keyed by uppercase ID, so lookups are case-insensitive
    return this.listings.get(id.toUpperCase()) || null;
  }

  /**
   * Update a listing
   * @param {string} id - Listing ID
   * @param {Object} updates - Fields to update
   * @returns {Listing|null} The updated listing or null if not found
   */
  updateListing(id, updates) {
    const listing = this.getListing(id);
    if (!listing) return null;

    Object.assign(listing, updates);

    return listing;
  }

  /**
   * Remove a listing
   * @param {string} id - Listing ID
   * @returns {boolean} True if listing was removed
   */
  removeListing(id) {
    if (!id) return false;

    if (this.listings.delete(id.toUpperCase())) {
      Logger.debug(`Removed listing: ${id}`);
      return true;
    }

    return false;
  }

  /**
   * Get all listings
   * @returns {Array<Listing>} Array of all listings
   */
  getAllListings() {
    return Array.from(this.listings.values());
  }

  /**
   * Get expired listings based on listing state (respects extensions and indefinite flag)
   * @param {number} lifetimeMs - How long after start time a listing stays alive
   * @returns {Array<Listing>} Array of expired listings
   */
  getExpiredListings(lifetimeMs) {
    return this.getAllListings().filter(listing => listing.isExpired(lifetimeMs));
  }

  /**
   * Get listings by host
   * @param {string} hostId - Host user ID
   * @returns {Array<Listing>} Listings by this host
   */
  getListingsByHost(hostId) {
    return this.getAllListings().filter(listing => listing.hostId === hostId);
  }
}

// Create a singleton instance
const listingService = new ListingService();

module.exports = listingService;