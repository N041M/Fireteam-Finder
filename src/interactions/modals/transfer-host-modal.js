/**
 * Handler for transfer host modal submissions
 */
const listingService = require('../../services/listing-service');
const messageService = require('../../services/message-service');
const Logger = require('../../utils/logger');

/**
 * Handle transfer host modal submission
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
        content: 'Only the host can transfer host privileges.'
      });
      return;
    }
    
    // Get new host input from the form
    const newHostInput = interaction.fields.getTextInputValue('new_host_id');
    
    // Try to find the user
    let newHost, newHostMember;
    
    try {
      // Try by mention or ID
      const mentionMatch = newHostInput.match(/<@!?(\d+)>/);
      const idMatch = newHostInput.match(/^\d+$/);
      
      if (mentionMatch) {
        // User was mentioned
        const userId = mentionMatch[1];
        newHost = await interaction.client.users.fetch(userId).catch(() => null);
        if (newHost) {
          newHostMember = await interaction.guild.members.fetch(userId).catch(() => null);
        }
      } else if (idMatch) {
        // User ID was provided
        newHost = await interaction.client.users.fetch(newHostInput).catch(() => null);
        if (newHost) {
          newHostMember = await interaction.guild.members.fetch(newHostInput).catch(() => null);
        }
      } else {
        // Try by username
        const members = await interaction.guild.members.search({ query: newHostInput, limit: 1 });
        if (members.size > 0) {
          newHostMember = members.first();
          newHost = newHostMember.user;
        }
      }
      
      // If user not found
      if (!newHost) {
        await interaction.editReply({
          content: `Could not find a user with the ID/username "${newHostInput}".`
        });
        return;
      }
      
      // Check if the new host is part of the fireteam
      if (!listing.hasParticipant(newHost.id)) {
        await interaction.editReply({
          content: `${newHost} must be a member of the fireteam to become the host. Use the Add Player button or /addplayer command to add them first.`
        });
        return;
      }
      
      // Store the old host ID
      const oldHostId = listing.hostId;
      
      // Transfer host privileges
      listing.transferHost(newHost.id);
      
      // Update channel permissions - remove host permissions from old host
      const channelService = require('../../services/channel-service');
      
      // First update the old host's permissions - remove moderation abilities
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
      
      // Update all messages with host information
      await messageService.updateAllListingMessages(listing, interaction.guild, {
        oldHostId: oldHostId
      });
      
      // Send message in the text channel
      const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
      if (textChannel) {
        await textChannel.send(`**Host Transfer:** <@${oldHostId}> has transferred host privileges to <@${newHost.id}>. <@${newHost.id}> is now the LFG host.`);
      }
      
      await interaction.editReply({
        content: `Successfully transferred host privileges to ${newHost} for ${listing.activityName}.`
      });
      
    } catch (error) {
      Logger.error(`Error finding or transferring to user:`, error);
      await interaction.editReply({
        content: `Error: ${error.message}`
      });
    }
    
  } catch (error) {
    Logger.error('Error in transfer host modal:', error);
    await interaction.editReply({
      content: 'There was an error transferring host privileges. Please try using the /transferhost command instead.'
    });
  }
}

module.exports = {
  handleModalSubmit
};