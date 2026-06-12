/**
 * Handler for add spot modal submissions
 */
const listingService = require('../../services/listing-service');
const channelService = require('../../services/channel-service');
const messageService = require('../../services/message-service');
const Logger = require('../../utils/logger');

/**
 * Handle add spot modal submission
 * @param {ModalSubmitInteraction} interaction - Modal interaction
 * @param {string} listingId - Listing ID
 */
async function handleModalSubmit(interaction, listingId) {
  try {
    // Get the listing
    const listing = listingService.getListing(listingId);
    
    if (!listing) {
      await interaction.editReply({
        content: 'This listing no longer exists or has expired.'
      });
      return;
    }
    
    // Determine if this is an admin action (modal opened via admin host controls)
    const isAdmin = interaction.customId.includes('admin_');

    // Only check host permission if not admin
    if (!isAdmin && interaction.user.id !== listing.hostId) {
      await interaction.editReply({
        content: 'Only the host can add spots to this listing.'
      });
      return;
    }
    
    // Get the spots value from the form
    const spotsInput = interaction.fields.getTextInputValue('spots');
    const spots = parseInt(spotsInput, 10);
    
    // Validate input
    if (isNaN(spots) || spots < 1 || spots > 6) {
      await interaction.editReply({
        content: 'Please enter a valid number of spots between 1 and 6.'
      });
      return;
    }
    
    // Check current size
    if (listing.fireteamSize >= 12) {
      await interaction.editReply({
        content: 'This listing already has the maximum allowed fireteam size (12).'
      });
      return;
    }
    
    // Store old size for comparison
    const oldSize = listing.fireteamSize;
    
    // Add spots
    const newSize = listing.addSpots(spots);
    
    // Update voice channel limit
    try {
      const voiceChannel = interaction.guild.channels.cache.get(listing.voiceChannelId);
      if (voiceChannel) {
        await voiceChannel.setUserLimit(newSize);
        Logger.debug(`Updated voice channel user limit to ${newSize} for listing ${listingId}`);
      }
    } catch (error) {
      Logger.error(`Error updating voice channel limit:`, error);
      // Non-critical, continue
    }
    
    // Update all messages - STANDARDIZED: Use updateAllListingMessages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
    // Send notification to text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (textChannel) {
      await textChannel.send(`${interaction.user} has increased the fireteam size from ${oldSize} to ${newSize} players.`);
    }
    
    await interaction.editReply({
      content: `Successfully added ${spots} spot${spots > 1 ? 's' : ''} to the fireteam for ${listing.activityName}. New fireteam size: ${newSize}`
    });
    
  } catch (error) {
    Logger.error('Error in add spot modal:', error);
    await interaction.editReply({
      content: 'There was an error adding spots to the fireteam. Please try using the /addspot command instead.'
    });
  }
}

module.exports = {
  handleModalSubmit
};