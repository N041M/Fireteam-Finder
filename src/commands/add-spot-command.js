/**
 * Handler for the /addspot command
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const listingService = require('../services/listing-service');
const channelService = require('../services/channel-service');
const messageService = require('../services/message-service');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('addspot')
  .setDescription('Add spots to your LFG listing')
  .addStringOption(option => 
    option
      .setName('listing_id')
      .setDescription('The ID of the listing to add spots to')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option
      .setName('spots')
      .setDescription('Number of spots to add (1-6)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(6)
  );

/**
 * Execute the /addspot command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Get command options
    const listingId = interaction.options.getString('listing_id');
    const spotsToAdd = interaction.options.getInteger('spots');
    
    Logger.debug(`Processing add spot command for listing: ${listingId}, spots: ${spotsToAdd}`);
    
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
        content: 'You can only add spots to listings that you created.'
      });
      return;
    }
    
    // Check spot count
    if (listing.fireteamSize >= 12) {
      await interaction.editReply({
        content: 'This listing already has the maximum allowed fireteam size (12).'
      });
      return;
    }
    
    // Get current size for comparison
    const oldSize = listing.fireteamSize;
    
    // Add spots to the listing
    const newSize = listing.addSpots(spotsToAdd);
    
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
      await textChannel.send(`${interaction.user} has increased the fireteam size from ${oldSize} to ${newSize} players.`);
    }
    
    await interaction.editReply({
      content: `Successfully added ${spotsToAdd} spot${spotsToAdd > 1 ? 's' : ''} to the fireteam for ${listing.activityName}. New fireteam size: ${newSize}`
    });
    
  } catch (error) {
    Logger.error('Error adding spots:', error);
    await interaction.editReply({
      content: 'There was an error adding spots to the fireteam. Please try again or contact an admin.'
    });
  }
}

module.exports = {
  data,
  execute
};