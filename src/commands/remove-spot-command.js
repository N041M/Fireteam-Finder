/**
 * Handler for the /removespot command
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const listingService = require('../services/listing-service');
const channelService = require('../services/channel-service');
const messageService = require('../services/message-service');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('removespot')
  .setDescription('Remove spots from your LFG listing')
  .addStringOption(option => 
    option
      .setName('listing_id')
      .setDescription('The ID of the listing to remove spots from')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option
      .setName('spots')
      .setDescription('Number of spots to remove (1-6)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(6)
  );

/**
 * Execute the /removespot command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Get command options
    const listingId = interaction.options.getString('listing_id');
    const spotsToRemove = interaction.options.getInteger('spots');
    
    Logger.debug(`Processing remove spot command for listing: ${listingId}, spots: ${spotsToRemove}`);
    
    // Get the listing
    const listing = listingService.getListing(listingId);
    if (!listing) {
      await interaction.editReply({
        content: `No listing found with ID ${listingId}. Please check the ID and try again.`
      });
      return;
    }
    
    // Check if the user is the host
    if (listing.hostId !== interaction.user.id) {
      await interaction.editReply({
        content: 'You can only remove spots from listings that you created.'
      });
      return;
    }
    
    // Get current size for comparison
    const oldSize = listing.fireteamSize;
    
    // Check if we can remove the requested number of spots
    const minSize = Math.max(listing.participants.length, 2);
    if (oldSize - spotsToRemove < minSize) {
      await interaction.editReply({
        content: `Cannot remove ${spotsToRemove} spots as that would make the fireteam size (${oldSize - spotsToRemove}) less than the current number of participants (${listing.participants.length}) or the minimum size of 2.`
      });
      return;
    }
    
    // Remove spots from the listing
    const newSize = listing.removeSpots(spotsToRemove);
    
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
    
    // Send a message in the activity's text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (textChannel) {
      await textChannel.send(`${interaction.user} has decreased the fireteam size from ${oldSize} to ${newSize} players.`);
    }
    
    await interaction.editReply({
      content: `Successfully removed ${spotsToRemove} spot${spotsToRemove > 1 ? 's' : ''} from the fireteam for ${listing.activityName}. New fireteam size: ${newSize}`
    });
    
  } catch (error) {
    Logger.error('Error removing spots:', error);
    await interaction.editReply({
      content: 'There was an error removing spots from the fireteam. Please try again or contact an admin.'
    });
  }
}

module.exports = {
  data,
  execute
};