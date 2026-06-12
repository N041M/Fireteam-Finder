/**
 * Service for cleaning up expired LFG listings - IMPROVED VERSION
 */
const cron = require('node-cron');
const config = require('../config');
const listingService = require('./listing-service');
const channelService = require('./channel-service');
const Logger = require('../utils/logger');

// Track ongoing operations to prevent race conditions
const ongoingOperations = new Set();

/**
 * Check if a listing is safe to delete (not involved in ongoing operations)
 * @param {string} listingId - Listing ID to check
 * @returns {boolean} True if safe to delete
 */
function isSafeToDelete(listingId) {
  return !ongoingOperations.has(listingId);
}

/**
 * Mark a listing as having an ongoing operation
 * @param {string} listingId - Listing ID
 */
function markOperationStart(listingId) {
  ongoingOperations.add(listingId);
  Logger.debug(`Marked listing ${listingId} as having ongoing operation`);
}

/**
 * Mark a listing operation as complete
 * @param {string} listingId - Listing ID
 */
function markOperationComplete(listingId) {
  ongoingOperations.delete(listingId);
  Logger.debug(`Marked listing ${listingId} operation as complete`);
}

/**
 * Clean up a single expired listing
 * @param {Listing} listing - Listing to clean up
 * @param {Client} client - Discord client
 * @returns {Promise<boolean>} Success status
 */
async function cleanupListing(listing, client) {
  // Don't clean up if there's an ongoing operation
  if (!isSafeToDelete(listing.id)) {
    Logger.debug(`Skipping cleanup of listing ${listing.id} - ongoing operation detected`);
    return false;
  }
  
  // Mark this cleanup as an ongoing operation
  markOperationStart(listing.id);
  
  try {
    Logger.debug(`Cleaning up expired listing: ${listing.id} (${listing.activityName})`);
    
    // Get the guild
    const guild = client.guilds.cache.get(listing.guildId);
    if (!guild) {
      Logger.debug(`Guild ${listing.guildId} not found, removing listing anyway`);
      listingService.removeListing(listing.id);
      return true;
    }
    
    // Verify channels still exist before attempting deletion
    const channelsExist = await verifyChannelsExist(guild, listing);
    if (!channelsExist.any) {
      Logger.debug(`Channels for listing ${listing.id} already deleted, cleaning up listing record`);
      listingService.removeListing(listing.id);
      return true;
    }
    
    // Clean up role if it exists
    if (listing.roleId) {
      const role = guild.roles.cache.get(listing.roleId);
      if (role) {
        try {
          // Remove role from all members who have it
          const membersWithRole = guild.members.cache.filter(member => 
            member.roles.cache.has(listing.roleId)
          );
          
          if (membersWithRole.size > 0) {
            const removePromises = membersWithRole.map(member => 
              member.roles.remove(role).catch(err => {
                Logger.error(`Could not remove role from member ${member.id}:`, err);
              })
            );
            
            await Promise.allSettled(removePromises);
          }
          
          // Delete the role
          await role.delete('LFG expired');
          Logger.debug(`Deleted role for listing ${listing.id}`);
        } catch (error) {
          Logger.error(`Error cleaning up role for listing ${listing.id}:`, error);
        }
      }
    }
    
    // Delete the listing message if it exists
    if (listing.messageId) {
      try {
        const lfgChannel = channelService.getLfgChannel(guild);
        if (lfgChannel) {
          const message = await lfgChannel.messages.fetch(listing.messageId).catch(() => null);
          if (message) {
            await message.delete();
            Logger.debug(`Deleted listing message for listing ${listing.id}`);
          }
        }
      } catch (error) {
        Logger.error(`Error deleting listing message for ${listing.id}:`, error);
      }
    }
    
    // Delete channels
    try {
      await channelService.deleteChannels(guild, {
        categoryId: listing.categoryId,
        textChannelId: listing.textChannelId,
        voiceChannelId: listing.voiceChannelId
      }, 'LFG expired');
      Logger.debug(`Deleted channels for listing ${listing.id}`);
    } catch (error) {
      Logger.error(`Error deleting channels for listing ${listing.id}:`, error);
    }
    
    // Remove the listing from the service
    listingService.removeListing(listing.id);
    
    Logger.info(`Successfully cleaned up expired listing: ${listing.id}`);
    return true;
  } catch (error) {
    Logger.error(`Error in cleanupListing for ${listing.id}:`, error);
    return false;
  } finally {
    // Always mark operation as complete
    markOperationComplete(listing.id);
  }
}

/**
 * Verify which channels still exist for a listing
 * @param {Guild} guild - Discord guild
 * @param {Listing} listing - Listing to check
 * @returns {Promise<Object>} Object indicating which channels exist
 */
async function verifyChannelsExist(guild, listing) {
  const results = {
    category: false,
    text: false,
    voice: false,
    any: false
  };
  
  try {
    if (listing.categoryId) {
      const category = guild.channels.cache.get(listing.categoryId);
      results.category = !!category;
    }
    
    if (listing.textChannelId) {
      const textChannel = guild.channels.cache.get(listing.textChannelId);
      results.text = !!textChannel;
    }
    
    if (listing.voiceChannelId) {
      const voiceChannel = guild.channels.cache.get(listing.voiceChannelId);
      results.voice = !!voiceChannel;
    }
    
    results.any = results.category || results.text || results.voice;
  } catch (error) {
    Logger.error(`Error verifying channels for listing ${listing.id}:`, error);
  }
  
  return results;
}

/**
 * Start the cleanup task
 * @param {Client} client - Discord client
 */
function startCleanupTask(client) {
  // Schedule the cleanup task using cron
  cron.schedule(config.CLEANUP_INTERVAL, async () => {
    try {
      Logger.debug('Running cleanup task for expired listings');
      
      // Get expired listings
      const expiredListings = listingService.getExpiredListings(config.LISTING_LIFETIME_MS);
      
      if (expiredListings.length === 0) {
        Logger.debug('No expired listings found');
        return;
      }
      
      // Filter out listings with ongoing operations
      const safeToDeleteListings = expiredListings.filter(listing => isSafeToDelete(listing.id));
      
      if (safeToDeleteListings.length === 0) {
        Logger.debug(`Found ${expiredListings.length} expired listings, but all have ongoing operations - skipping cleanup`);
        return;
      }
      
      if (safeToDeleteListings.length < expiredListings.length) {
        Logger.info(`Found ${expiredListings.length} expired listings, but ${expiredListings.length - safeToDeleteListings.length} have ongoing operations`);
      }
      
      Logger.info(`Found ${safeToDeleteListings.length} expired listings to clean up`);
      
      // Clean up all safe-to-delete expired listings
      const results = await Promise.allSettled(
        safeToDeleteListings.map(listing => cleanupListing(listing, client))
      );
      
      // Count successful cleanups
      const successCount = results.filter(
        result => result.status === 'fulfilled' && result.value === true
      ).length;
      
      Logger.info(`Successfully cleaned up ${successCount} of ${safeToDeleteListings.length} expired listings`);
    } catch (error) {
      Logger.error('Error in cleanup task:', error);
    }
  });
  
  Logger.info('Scheduled cleanup task for expired listings');
}

module.exports = {
  cleanupListing,
  startCleanupTask,
  markOperationStart,
  markOperationComplete,
  isSafeToDelete
};