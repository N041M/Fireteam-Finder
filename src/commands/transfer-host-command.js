/**
 * Handler for the /transferhost command
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const listingService = require('../services/listing-service');
const channelService = require('../services/channel-service');
const messageService = require('../services/message-service');
const uiBuilder = require('../utils/ui-builder');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('transferhost')
  .setDescription('Transfer host privileges to another player in your LFG')
  .addStringOption(option => 
    option
      .setName('listing_id')
      .setDescription('The ID of the listing to transfer host privileges')
      .setRequired(true)
  )
  .addUserOption(option => 
    option
      .setName('new_host')
      .setDescription('The player to make the new host')
      .setRequired(true)
  );

/**
 * Execute the /transferhost command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Get command options
    const listingId = interaction.options.getString('listing_id');
    const newHost = interaction.options.getUser('new_host');
    
    Logger.debug(`Processing transfer host command for listing: ${listingId}, new host: ${newHost.id}`);
    
    // Get the listing
    const listing = listingService.getListing(listingId);
    if (!listing) {
      await interaction.editReply({
        content: `No listing found with ID ${listingId}. Please check the ID and try again.`
      });
      return;
    }
    
    // Check if the user is the current host
    if (listing.hostId !== interaction.user.id) {
      await interaction.editReply({
        content: 'You can only transfer host privileges for listings that you created.'
      });
      return;
    }
    
    // Check if the new host is part of the fireteam
    if (!listing.hasParticipant(newHost.id)) {
      await interaction.editReply({
        content: `${newHost} must be a member of the fireteam to become the host. Use /addplayer to add them first.`
      });
      return;
    }
    
    // Store the old host ID
    const oldHostId = listing.hostId;
    
    // Update the listing with the new host
    listing.transferHost(newHost.id);
    
    // Update channel permissions - remove host permissions from old host
    await channelService.addUserToChannels(
      interaction.guild,
      {
        categoryId: listing.categoryId,
        textChannelId: listing.textChannelId,
        voiceChannelId: listing.voiceChannelId
      },
      oldHostId,
      false, // not a substitute
      false  // no longer the host
    );
    
    // Then give new host moderation abilities
    await channelService.addUserToChannels(
      interaction.guild,
      {
        categoryId: listing.categoryId,
        textChannelId: listing.textChannelId,
        voiceChannelId: listing.voiceChannelId
      },
      newHost.id,
      false, // not a substitute
      true   // is the host
    );
    
    // Get the text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (!textChannel) {
      await interaction.editReply({
        content: `Cannot find the LFG text channel. The listing may be corrupted.`
      });
      return;
    }
    
    // Send a message in the text channel
    await textChannel.send(`**Host Transfer:** <@${oldHostId}> has transferred host privileges to <@${newHost.id}>. <@${newHost.id}> is now the LFG host.`);
    
    // Find and update the host controls message
    try {
      // Fetch the most recent messages
      const messages = await textChannel.messages.fetch({ limit: 10 });
      
      // Find the host controls message
      const hostControlsMessage = messages.find(message => 
        message.content.includes('HOST CONTROLS') && 
        message.author.bot &&
        message.components && 
        message.components.length > 0
      );
      
      if (hostControlsMessage) {
        // Create new host controls that point to the new host
        const hostControlsRows = uiBuilder.createHostControls(listing.id);
        
        // Update the host controls message
        await hostControlsMessage.edit({
          content: `**HOST CONTROLS** - Only <@${newHost.id}> can use these buttons:`,
          components: hostControlsRows
        });
      }
    } catch (error) {
      Logger.error(`Could not update host controls message:`, error);
      // This is not critical, we can continue
    }
    
    // Update all messages with the new host
    await messageService.updateAllListingMessages(listing, interaction.guild, {
      oldHostId: oldHostId
    });
    
    await interaction.editReply({
      content: `Successfully transferred host privileges to ${newHost} for the LFG activity "${listing.activityName}".`
    });
    
  } catch (error) {
    Logger.error('Error in transfer host command:', error);
    await interaction.editReply({
      content: 'There was an error transferring host privileges. Please try again.'
    });
  }
}

module.exports = {
  data,
  execute
};