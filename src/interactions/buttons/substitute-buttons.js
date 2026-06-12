/**
 * Handlers for substitute notification response buttons
 */
const listingService = require('../../services/listing-service');
const channelService = require('../../services/channel-service');
const messageService = require('../../services/message-service');
const notificationService = require('../../services/notification-service');
const Logger = require('../../utils/logger');

/**
 * Handle substitute buttons
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {string} action - Button action (accept, decline)
 * @param {string} listingId - Listing ID
 * @param {Client} client - Discord client
 */
async function handleButton(interaction, action, listingId, client) {
  // Get the listing
  const listing = listingService.getListing(listingId);
  
  if (!listing) {
    await interaction.editReply({
      content: 'This listing no longer exists or has expired.'
    });
    return;
  }
  
  // Check if user is a substitute
  if (!listing.hasSubstitute(interaction.user.id)) {
    await interaction.editReply({
      content: 'You are not a substitute for this activity.'
    });
    return;
  }
  
  if (action === 'accept') {
    await handleAcceptSpot(interaction, listing, client);
  } else if (action === 'decline') {
    await handleDeclineSpot(interaction, listing, client);
  }
}

/**
 * Handle accepting a spot in the fireteam
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {Client} client - Discord client
 */
async function handleAcceptSpot(interaction, listing, client) {
  try {
    // Check if the fireteam is now full
    if (listing.isFull()) {
      await interaction.editReply({
        content: 'Sorry, the fireteam has been filled in the meantime. You remain on the substitute list.'
      });
      return;
    }
    
    // Promote to participant
    listing.promoteSubstitute(interaction.user.id);
    
    try {
      // Get the guild
      const guild = await client.guilds.fetch(listing.guildId);
      
      // Update permissions for the channels
      await channelService.promoteSubstituteInChannels(
        guild,
        {
          categoryId: listing.categoryId,
          textChannelId: listing.textChannelId,
          voiceChannelId: listing.voiceChannelId
        },
        interaction.user.id
      );
      
      // Update ALL messages - This is the key fix
      await messageService.updateAllListingMessages(listing, guild);
      
      // Send notification to the text channel
      const textChannel = guild.channels.cache.get(listing.textChannelId);
      if (textChannel) {
        await textChannel.send(`${interaction.user} has been promoted from substitute to full fireteam member!`);
      }
      
      // Update the original DM message if possible
      try {
        if (interaction.message) {
          await interaction.message.edit({
            content: `✅ You've accepted the spot and joined the fireteam for ${listing.activityName}!`,
            components: [] // Remove buttons
          });
        }
      } catch (messageError) {
        Logger.debug(`Could not update notification message: ${messageError.message}`);
      }
      
      await interaction.editReply({
        content: `You have been promoted to the fireteam for ${listing.activityName}! Check out <#${listing.textChannelId}> to get started.`
      });
      
    } catch (error) {
      Logger.error(`Error promoting substitute for listing ${listing.id}:`, error);
      await interaction.editReply({
        content: 'There was an error promoting you to the fireteam. Please try joining directly from the LFG post.'
      });
    }
  } catch (error) {
    Logger.error(`Error handling accept spot button for listing ${listing.id}:`, error);
    await interaction.editReply({
      content: 'There was an error processing your request. Please try again.'
    });
  }
}

/**
 * Handle declining a spot in the fireteam
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {Client} client - Discord client
 */
async function handleDeclineSpot(interaction, listing, client) {
  try {
    // Move user to the end of the substitute queue
    notificationService.moveSubstituteToEnd(listing, interaction.user.id);
    
    // Update the original DM message if possible
    try {
      if (interaction.message) {
        await interaction.message.edit({
          content: `❌ You've declined the spot in the fireteam for ${listing.activityName}. You'll remain on the substitute list but in a lower priority position.`,
          components: [] // Remove buttons
        });
      }
    } catch (messageError) {
      Logger.debug(`Could not update notification message: ${messageError.message}`);
    }
    
    await interaction.editReply({
      content: `You have chosen to remain as a substitute for ${listing.activityName}. You've been moved to the end of the substitute queue.`
    });
    
    // Notify the next substitute if there's still an open spot
    if (listing.substitutes.length > 0 && !listing.isFull()) {
      await notificationService.notifySubstitutesOfOpenSpot(listing, client);
    }
    
  } catch (error) {
    Logger.error(`Error handling decline spot button for listing ${listing.id}:`, error);
    await interaction.editReply({
      content: 'There was an error processing your request. Please try again.'
    });
  }
}

module.exports = {
  handleButton
};