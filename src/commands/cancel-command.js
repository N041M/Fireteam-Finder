/**
 * Handler for the /cancel command to cancel an LFG listing
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const listingService = require('../services/listing-service');
const channelService = require('../services/channel-service');
const { canManageListing, logAdminAction } = require('../utils/permission-utils');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('cancel')
  .setDescription('Cancel an LFG listing')
  .addStringOption(option => 
    option
      .setName('listing_id')
      .setDescription('The ID of the listing to cancel')
      .setRequired(true)
  );

/**
 * Execute the /cancel command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Get the listing ID from the options
    const listingId = interaction.options.getString('listing_id');
    Logger.debug(`Processing cancel command for listing: ${listingId}`);
    
    // Get the listing
    const listing = listingService.getListing(listingId);
    if (!listing) {
      await interaction.editReply({
        content: `No listing found with ID ${listingId}. Please check the ID and try again.`
      });
      return;
    }
    
    // Check if the user has permission to cancel this listing
    const member = interaction.member;
    const isAdmin = member.id !== listing.hostId && canManageListing(member, listing);
    const hasPermission = member.id === listing.hostId || isAdmin;
    
    if (!hasPermission) {
      await interaction.editReply({
        content: 'You don\'t have permission to cancel this listing. Only the host or moderators can cancel listings.'
      });
      return;
    }
    
    // Log if this is an admin override action
    if (isAdmin) {
      logAdminAction(
        member, 
        'CANCEL_LISTING', 
        listing, 
        `Admin cancelled listing created by <@${listing.hostId}>`
      );
    }
    
    // IMPORTANT: Send confirmation message BEFORE we start deleting anything
    await interaction.editReply({
      content: `${isAdmin ? 'As moderator: ' : ''}Cancelling LFG for ${listing.activityName}...`
    });
    
    // Store relevant info before deleting
    const activityName = listing.activityName;
    
    // If admin, notify the host via DM BEFORE deletion
    if (isAdmin) {
      try {
        const hostUser = await client.users.fetch(listing.hostId);
        if (hostUser && hostUser.id !== interaction.user.id) {
          await hostUser.send({
            content: `Your LFG for ${listing.activityName} (ID: ${listing.id}) is being cancelled by a server moderator.`
          }).catch(err => {
            // Don't worry if we can't DM them
            Logger.debug(`Could not DM host about admin cancellation: ${err.message}`);
          });
        }
      } catch (error) {
        Logger.error(`Error notifying host about admin cancellation:`, error);
      }
    }
    
    const guild = interaction.guild;
    
    // Clean up the role if it exists
    if (listing.roleId) {
      try {
        const role = guild.roles.cache.get(listing.roleId);
        if (role) {
          // Remove role from all members who have it
          const membersWithRole = guild.members.cache.filter(member => 
            member.roles.cache.has(listing.roleId)
          );
          
          for (const [_, member] of membersWithRole) {
            await member.roles.remove(role).catch(err => {
              Logger.error(`Could not remove role from member:`, err);
            });
          }
          
          // Delete the role
          await role.delete('Listing cancelled');
        }
      } catch (error) {
        Logger.error(`Error cleaning up role for listing ${listing.id}:`, error);
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
          }
        }
      } catch (error) {
        Logger.error(`Error deleting listing message for ${listing.id}:`, error);
      }
    }
    
    // IMPORTANT: Remove the listing from the service BEFORE deleting channels
    listingService.removeListing(listing.id);
    
    // Delete channels - this is the last step, after which we can't interact with the original channels
    try {
      await channelService.deleteChannels(guild, {
        categoryId: listing.categoryId,
        textChannelId: listing.textChannelId,
        voiceChannelId: listing.voiceChannelId
      }, isAdmin ? 'Listing cancelled by moderator' : 'Listing cancelled by host');
    } catch (error) {
      Logger.error(`Error deleting channels for listing ${listing.id}:`, error);
    }
    
    // DON'T try to send any more messages after channel deletion
    // The confirmation sent earlier is enough
    
  } catch (error) {
    Logger.error('Error in cancel command:', error);
    try {
      await interaction.editReply({
        content: 'There was an error cancelling the listing. Please try again.'
      });
    } catch (replyError) {
      Logger.error('Error sending error message:', replyError);
    }
  }
}

module.exports = {
  data,
  execute
};