/**
 * Handler for the /removeplayer command
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const listingService = require('../services/listing-service');
const channelService = require('../services/channel-service');
const notificationService = require('../services/notification-service');
const { createListingEmbed } = require('../utils/embed-builder');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('removeplayer')
  .setDescription('Remove a player from your LFG listing')
  .addStringOption(option => 
    option
      .setName('listing_id')
      .setDescription('The ID of the listing to remove player from')
      .setRequired(true)
  )
  .addUserOption(option => 
    option
      .setName('player')
      .setDescription('The player to remove from the fireteam')
      .setRequired(true)
  );

/**
 * Execute the /removeplayer command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Get command options
    const listingId = interaction.options.getString('listing_id');
    const targetUser = interaction.options.getUser('player');
    const targetMember = interaction.options.getMember('player');
    
    Logger.debug(`Processing remove player command for listing: ${listingId}, player: ${targetUser.id}`);
    
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
        content: 'You can only remove players from listings that you created.'
      });
      return;
    }
    
    // Check if the target is the host (can't remove yourself as host)
    if (targetUser.id === listing.hostId) {
      await interaction.editReply({
        content: `You can't remove yourself as host. Use /cancel to cancel the entire LFG.`
      });
      return;
    }
    
    // Check if the user is in the fireteam or is a substitute
    const isParticipant = listing.hasParticipant(targetUser.id);
    const isSubstitute = listing.hasSubstitute(targetUser.id);
    
    if (!isParticipant && !isSubstitute) {
      await interaction.editReply({
        content: `${targetUser} is not part of this LFG.`
      });
      return;
    }
    
    try {
      const guild = interaction.guild;
      
      // Remove from the appropriate list
      if (isParticipant) {
        listing.removeParticipant(targetUser.id);
      } else {
        listing.removeSubstitute(targetUser.id);
      }
      
      // Remove the role if it exists
      if (listing.roleId && targetMember) {
        const role = guild.roles.cache.get(listing.roleId);
        if (role) {
          await targetMember.roles.remove(role).catch(err => {
            Logger.error(`Could not remove role from user:`, err);
          });
        }
      }
      
      // Remove channel permissions
      await channelService.removeUserFromChannels(
        guild,
        {
          categoryId: listing.categoryId,
          textChannelId: listing.textChannelId,
          voiceChannelId: listing.voiceChannelId
        },
        targetUser.id
      );
      
      // Update the listing message in the main channel
      await updateListingMessage(listing, guild);
      
      // Also update the welcome message in the LFG channel
      const { updateWelcomeMessage } = require('../interactions/modals/add-player-modal');
      await updateWelcomeMessage(listing, guild);
      
      // Send a message in the activity's text channel
      const textChannel = guild.channels.cache.get(listing.textChannelId);
      if (textChannel) {
        await textChannel.send(`${targetUser} has been removed from the ${isParticipant ? 'fireteam' : 'substitute list'} by ${interaction.user}.`);
      }
      
      await interaction.editReply({
        content: `Successfully removed ${targetUser} from the ${isParticipant ? 'fireteam' : 'substitute list'} for ${listing.activityName}.`
      });
      
      // If a participant was removed, notify substitutes about the open spot
      if (isParticipant && listing.substitutes.length > 0 && !listing.isFull()) {
        await notificationService.notifySubstitutesOfOpenSpot(listing, client);
      }
      
    } catch (error) {
      Logger.error('Error removing player:', error);
      await interaction.editReply({
        content: `There was an error removing ${targetUser} from the fireteam. Please try again or contact an admin.`
      });
    }
  } catch (error) {
    Logger.error('Error in remove player command:', error);
    await interaction.editReply({
      content: 'There was an error processing your request. Please try again.'
    });
  }
}

/**
 * Update the listing message with the latest embed
 * @param {Listing} listing - The listing
 * @param {Guild} guild - Discord guild
 */
async function updateListingMessage(listing, guild) {
  try {
    if (!listing.messageId) return;
    
    // Get the LFG channel
    const lfgChannel = channelService.getLfgChannel(guild);
    if (!lfgChannel) return;
    
    // Get and update the message
    const message = await lfgChannel.messages.fetch(listing.messageId).catch(() => null);
    if (message) {
      const embed = createListingEmbed(listing);
      await message.edit({ embeds: [embed] });
    }
  } catch (error) {
    Logger.error('Error updating listing message:', error);
  }
}

module.exports = {
  data,
  execute
};