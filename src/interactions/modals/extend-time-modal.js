/**
 * Handler for extend time modal submissions
 */
const listingService = require('../../services/listing-service');
const messageService = require('../../services/message-service');
const notificationService = require('../../services/notification-service');
const { logAdminAction } = require('../../utils/permission-utils');
const { formatDateTime } = require('../../utils/date-utils');
const Logger = require('../../utils/logger');

/**
 * Handle extend time modal submission
 * @param {ModalSubmitInteraction} interaction - Modal interaction
 * @param {string} listingId - Listing ID
 */
async function handleModalSubmit(interaction, listingId) {
  try {
    // Determine if this is an admin action
    const isAdmin = interaction.customId.includes('admin_');
    
    // Get the listing
    const listing = listingService.getListing(listingId);
    
    if (!listing) {
      await interaction.editReply({
        content: 'This listing no longer exists or has expired.'
      });
      return;
    }
    
    // Only check host permission if not admin
    if (!isAdmin && interaction.user.id !== listing.hostId) {
      await interaction.editReply({
        content: 'Only the host can extend the time for this listing.'
      });
      return;
    }
    
    // Get form values
    const hoursStr = interaction.fields.getTextInputValue('hours');
    const makeIndefinite = interaction.fields.getTextInputValue('indefinite').toLowerCase() === 'yes';
    
    // Log admin action if applicable
    if (isAdmin) {
      const actionType = makeIndefinite ? 'MAKE_INDEFINITE' : 'EXTEND_TIME';
      logAdminAction(
        interaction.member,
        actionType,
        listing,
        makeIndefinite 
          ? `Moderator made listing indefinite` 
          : `Moderator extended listing by ${hoursStr} hours`
      );
    }
    
    // Validate hours if not making indefinite
    if (!makeIndefinite) {
      const hours = parseInt(hoursStr, 10);
      if (isNaN(hours) || hours < 1 || hours > 24) {
        await interaction.editReply({
          content: 'Please enter a valid number of hours between 1 and 24.'
        });
        return;
      }
      
      // Extend the listing time
      listing.extendTime(hours);
      
      // Notify participants
      const notificationMessage = `The scheduled time for this LFG has been extended by ${hours} hour(s)${isAdmin ? ' by a server moderator' : ''}. New time: ${formatDateTime(listing.startTime)}`;
      await notificationService.notifyParticipants(listing, notificationMessage, interaction.client);
      
      // Also notify the host if admin action
      if (isAdmin) {
        try {
          const hostUser = await interaction.client.users.fetch(listing.hostId);
          if (hostUser && hostUser.id !== interaction.user.id) {
            await hostUser.send({
              content: `Your LFG for ${listing.activityName} (ID: ${listing.id}) had its time extended by ${hours} hour(s) by a server moderator. New time: ${formatDateTime(listing.startTime)}`
            }).catch(err => {
              // Don't worry if we can't DM them
              Logger.debug(`Could not DM host about admin time extension: ${err.message}`);
            });
          }
        } catch (error) {
          Logger.error(`Error notifying host about admin time extension:`, error);
        }
      }
      
      await interaction.editReply({
        content: `Successfully extended the time for this LFG by ${hours} hour(s). New time: ${formatDateTime(listing.startTime)}`
      });
    } else {
      // Make the listing indefinite
      listing.makeIndefinite();
      
      // Notify participants
      const notificationMessage = `This LFG has been set to remain open indefinitely${isAdmin ? ' by a server moderator' : ''} and will not automatically expire.`;
      await notificationService.notifyParticipants(listing, notificationMessage, interaction.client);
      
      // Also notify the host if admin action
      if (isAdmin) {
        try {
          const hostUser = await interaction.client.users.fetch(listing.hostId);
          if (hostUser && hostUser.id !== interaction.user.id) {
            await hostUser.send({
              content: `Your LFG for ${listing.activityName} (ID: ${listing.id}) was set to remain open indefinitely by a server moderator.`
            }).catch(err => {
              // Don't worry if we can't DM them
              Logger.debug(`Could not DM host about admin indefinite change: ${err.message}`);
            });
          }
        } catch (error) {
          Logger.error(`Error notifying host about admin indefinite change:`, error);
        }
      }
      
      await interaction.editReply({
        content: `This LFG has been set to remain open indefinitely.`
      });
    }
    
    // Update all messages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
  } catch (error) {
    Logger.error('Error in extend time modal:', error);
    await interaction.editReply({
      content: 'There was an error extending the time. Please try using the /extend command instead.'
    });
  }
}

module.exports = {
  handleModalSubmit
};