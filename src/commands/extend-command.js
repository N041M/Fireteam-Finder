/**
 * Handler for the /extend command to extend an LFG listing's time
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const listingService = require('../services/listing-service');
const messageService = require('../services/message-service');
const notificationService = require('../services/notification-service');
const { canManageListing, logAdminAction } = require('../utils/permission-utils');
const { formatDateTime } = require('../utils/date-utils');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('extend')
  .setDescription('Extend the time of an LFG listing')
  .addStringOption(option => 
    option
      .setName('listing_id')
      .setDescription('The ID of the listing to extend')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option
      .setName('hours')
      .setDescription('Number of hours to extend (1-24)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(24)
  )
  .addBooleanOption(option => 
    option
      .setName('indefinite')
      .setDescription('Make the listing last indefinitely')
      .setRequired(false)
  );

/**
 * Execute the /extend command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Get command options
    const listingId = interaction.options.getString('listing_id');
    const hours = interaction.options.getInteger('hours');
    const makeIndefinite = interaction.options.getBoolean('indefinite') || false;
    
    Logger.debug(`Processing extend command for listing: ${listingId}, hours: ${hours}, indefinite: ${makeIndefinite}`);
    
    // Get the listing
    const listing = listingService.getListing(listingId);
    if (!listing) {
      await interaction.editReply({
        content: `No listing found with ID ${listingId}. Please check the ID and try again.`
      });
      return;
    }
    
    // Check if the user has permission to extend this listing
    const member = interaction.member;
    const isAdmin = member.id !== listing.hostId && canManageListing(member, listing);
    const hasPermission = member.id === listing.hostId || isAdmin;
    
    if (!hasPermission) {
      await interaction.editReply({
        content: 'You don\'t have permission to extend this listing. Only the host or moderators can extend listings.'
      });
      return;
    }
    
    // Check if this is already an indefinite listing
    if (listing.indefinite && !makeIndefinite) {
      await interaction.editReply({
        content: 'This listing is already set to remain open indefinitely and does not need to be extended.'
      });
      return;
    }
    
    // Log if this is an admin override action
    if (isAdmin) {
      const actionType = makeIndefinite ? 'MAKE_INDEFINITE' : 'EXTEND_TIME';
      logAdminAction(
        member, 
        actionType, 
        listing, 
        makeIndefinite 
          ? `Admin made listing indefinite` 
          : `Admin extended listing by ${hours} hours`
      );
    }
    
    // Update the listing based on the options
    if (makeIndefinite) {
      listing.makeIndefinite();
    } else {
      listing.extendTime(hours);
    }
    
    // Update all messages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
    // Notify participants
    let notificationMessage;
    if (makeIndefinite) {
      notificationMessage = `This LFG has been set to remain open indefinitely${isAdmin ? ' by a server moderator' : ''} and will not automatically expire.`;
    } else {
      notificationMessage = `The scheduled time for this LFG has been extended by ${hours} hour(s)${isAdmin ? ' by a server moderator' : ''}. New time: ${formatDateTime(listing.startTime)}`;
    }
    
    await notificationService.notifyParticipants(listing, notificationMessage, client);
    
    // Also notify the host if admin action
    if (isAdmin) {
      try {
        const hostUser = await client.users.fetch(listing.hostId);
        if (hostUser && hostUser.id !== interaction.user.id) {
          const dmMessage = makeIndefinite
            ? `Your LFG for ${listing.activityName} (ID: ${listing.id}) was set to remain open indefinitely by a server moderator.`
            : `Your LFG for ${listing.activityName} (ID: ${listing.id}) had its time extended by ${hours} hour(s) by a server moderator. New time: ${formatDateTime(listing.startTime)}`;
            
          await hostUser.send({
            content: dmMessage
          }).catch(err => {
            // Don't worry if we can't DM them
            Logger.debug(`Could not DM host about admin time action: ${err.message}`);
          });
        }
      } catch (error) {
        Logger.error(`Error notifying host about admin time action:`, error);
      }
    }
    
    // Final confirmation to the user
    let replyContent;
    if (makeIndefinite) {
      replyContent = `The listing has been set to remain open indefinitely${isAdmin ? '. The host has been notified' : ''}.`;
    } else {
      replyContent = `Successfully extended the LFG for ${listing.activityName} by ${hours} hour(s). New time: ${formatDateTime(listing.startTime)}${isAdmin ? '. The host has been notified' : ''}.`;
    }
    
    await interaction.editReply({
      content: replyContent
    });
    
  } catch (error) {
    Logger.error('Error in extend command:', error);
    await interaction.editReply({
      content: 'There was an error extending the listing time. Please try again.'
    });
  }
}

module.exports = {
  data,
  execute
};