/**
 * Service for handling user notifications
 */
const listingService = require('./listing-service');
const { formatDateTime, discordTimestamp } = require('../utils/date-utils');
const uiBuilder = require('../utils/ui-builder');
const Logger = require('../utils/logger');

/**
 * Get time information for a listing
 * @param {Listing} listing - The listing
 * @returns {Object} Time information
 */
function getTimeInfo(listing) {
  if (listing.indefinite) {
    return {
      minutesRemaining: Infinity,
      expiryTimeFormatted: 'No scheduled end (indefinite)'
    };
  }
  
  const startTime = new Date(listing.startTime);
  const now = new Date();
  const timeRemaining = Math.max(0, startTime - now);
  const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));
  
  return {
    minutesRemaining,
    timeRemaining,
    expiryTimeFormatted: formatDateTime(listing.startTime)
  };
}

/**
 * Move a substitute to the end of the queue
 * @param {Listing} listing - The listing
 * @param {string} substituteId - Substitute user ID
 */
function moveSubstituteToEnd(listing, substituteId) {
  const index = listing.substitutes.indexOf(substituteId);
  if (index !== -1) {
    listing.substitutes.splice(index, 1);
    listing.substitutes.push(substituteId);
    Logger.debug(`Moved user ${substituteId} to end of substitute queue for listing ${listing.id}`);
  }
}

/**
 * Notify substitutes of an open spot
 * @param {Listing} listing - The listing
 * @param {Client} client - Discord client
 * @param {Set<string>} attempted - Substitute IDs already tried in this notification round
 */
async function notifySubstitutesOfOpenSpot(listing, client, attempted = new Set()) {
  // Skip if no substitutes or fireteam is full
  if (listing.substitutes.length === 0 || listing.isFull()) {
    return;
  }

  Logger.debug(`Notifying substitutes for listing ${listing.id}`);

  // Get the first substitute we haven't already tried this round
  const substituteId = listing.substitutes.find(id => !attempted.has(id));
  if (!substituteId) {
    Logger.debug(`All substitutes for listing ${listing.id} have been notified or were unreachable`);
    return;
  }
  attempted.add(substituteId);
  
  try {
    // Get the user
    const user = await client.users.fetch(substituteId);
    
    // Get time information
    const timeInfo = getTimeInfo(listing);
    
    // Create notification buttons
    const buttonRow = uiBuilder.createSubstituteNotificationButtons(listing.id);
    
    // Create notification message
    let content = `A spot has opened up in the fireteam for **${listing.activityName}**! Would you like to join?\n\n`;
    
    content += `If you don't respond within 5 minutes, the spot will be offered to another substitute.`;
    
    // Add expiry warning if applicable
    if (timeInfo.minutesRemaining < 30 && timeInfo.minutesRemaining !== Infinity) {
      content += `\n\n⚠️ **Note:** This activity starts ${timeInfo.minutesRemaining <= 0 ? '**very soon**' : `in about **${timeInfo.minutesRemaining} minute(s)**`}. Please respond quickly.`;
    } else if (timeInfo.minutesRemaining !== Infinity) {
      content += `\n\nThis activity starts at ${timeInfo.expiryTimeFormatted}.`;
    }
    
    // Send DM to substitute
    const dmMessage = await user.send({
      content,
      components: [buttonRow]
    });
    
    Logger.debug(`Sent notification to substitute ${substituteId} for listing ${listing.id}`);
    
    // Set a timeout for no response (5 minutes, or less if the activity starts sooner).
    // Indefinite listings use the full 5 minutes, matching the message sent above.
    {
      const timeoutDuration = timeInfo.minutesRemaining === Infinity
        ? 5 * 60 * 1000
        : Math.min(5 * 60 * 1000, timeInfo.timeRemaining - 10000);
      if (timeoutDuration > 0) {
        setTimeout(async () => {
          try {
            // Check if the listing still exists
            const currentListing = listingService.getListing(listing.id);
            if (!currentListing) return;
            
            // Check if this user is still a substitute and not promoted
            if (
              currentListing.hasSubstitute(substituteId) && 
              !currentListing.hasParticipant(substituteId) && 
              !currentListing.isFull()
            ) {
              Logger.debug(`Substitute ${substituteId} did not respond within timeout period`);
              
              // Move to the end of the queue
              moveSubstituteToEnd(currentListing, substituteId);
              
              // Update the DM message
              try {
                await dmMessage.edit({
                  content: `The spot in the fireteam for **${currentListing.activityName}** has been offered to another substitute as you didn't respond in time. You've been moved to the end of the substitute queue.`,
                  components: []
                });
              } catch (messageError) {
                Logger.debug(`Could not update DM message for ${substituteId}:`, messageError);
              }
              
              // Notify the next substitute (same round, so nobody is pinged twice)
              await notifySubstitutesOfOpenSpot(currentListing, client, attempted);
            }
          } catch (error) {
            Logger.error(`Error in substitute notification timeout:`, error);
          }
        }, timeoutDuration);
      }
    }
  } catch (error) {
    Logger.error(`Error notifying substitute ${substituteId}:`, error);

    // Move to the next substitute on error
    moveSubstituteToEnd(listing, substituteId);

    // Try the next substitute that hasn't been attempted yet (prevents
    // infinite recursion when every substitute is unreachable)
    if (listing.substitutes.some(id => !attempted.has(id))) {
      await notifySubstitutesOfOpenSpot(listing, client, attempted);
    }
  }
}

/**
 * Send a notification to all participants
 * @param {Listing} listing - The listing
 * @param {string} message - Message to send
 * @param {Client} client - Discord client
 */
async function notifyParticipants(listing, message, client) {
  try {
    // Get the text channel
    const guild = client.guilds.cache.get(listing.guildId);
    if (!guild) return;
    
    const textChannel = guild.channels.cache.get(listing.textChannelId);
    if (!textChannel) return;
    
    // Get the role mention if available
    const mention = listing.roleId ? `<@&${listing.roleId}>` : '';
    
    // Send the notification
    await textChannel.send(`${mention} ${message}`);
    
    Logger.debug(`Sent notification to participants for listing ${listing.id}`);
  } catch (error) {
    Logger.error(`Error notifying participants for listing ${listing.id}:`, error);
  }
}

module.exports = {
  notifySubstitutesOfOpenSpot,
  notifyParticipants,
  moveSubstituteToEnd
};