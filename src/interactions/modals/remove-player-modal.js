/**
 * Handler for remove player modal submissions
 */
const listingService = require('../../services/listing-service');
const channelService = require('../../services/channel-service');
const messageService = require('../../services/message-service');
const notificationService = require('../../services/notification-service');
const { logAdminAction } = require('../../utils/permission-utils');
const Logger = require('../../utils/logger');

/**
 * Handle remove player modal submission
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
        content: 'Only the host can remove players from this listing.'
      });
      return;
    }
    
    // Get player input from the form
    const playerInput = interaction.fields.getTextInputValue('player_id');
    
    // Try to find the user
    let targetUser, targetMember;
    
    try {
      // Try by mention or ID
      const mentionMatch = playerInput.match(/<@!?(\d+)>/);
      const idMatch = playerInput.match(/^\d+$/);
      
      if (mentionMatch) {
        // User was mentioned
        const userId = mentionMatch[1];
        targetUser = await interaction.client.users.fetch(userId).catch(() => null);
        if (targetUser) {
          targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
        }
      } else if (idMatch) {
        // User ID was provided
        targetUser = await interaction.client.users.fetch(playerInput).catch(() => null);
        if (targetUser) {
          targetMember = await interaction.guild.members.fetch(playerInput).catch(() => null);
        }
      } else {
        // Try by username
        const members = await interaction.guild.members.search({ query: playerInput, limit: 1 });
        if (members.size > 0) {
          targetMember = members.first();
          targetUser = targetMember.user;
        }
      }
      
      // If user not found
      if (!targetUser) {
        await interaction.editReply({
          content: `Could not find a user with the ID/username "${playerInput}".`
        });
        return;
      }
      
      // Check if the target is the host
      if (targetUser.id === listing.hostId) {
        await interaction.editReply({
          content: `You can't remove the host. Use the Cancel button or /cancel command to cancel the LFG.`
        });
        return;
      }
      
      // Log if this is an admin action
      if (isAdmin) {
        logAdminAction(
          interaction.member,
          'REMOVE_PLAYER',
          listing,
          `Moderator removed player ${targetUser.tag} (${targetUser.id}) from listing`
        );
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
      
      // Remove the user from the appropriate list
      if (isParticipant) {
        listing.removeParticipant(targetUser.id);
      } else {
        listing.removeSubstitute(targetUser.id);
      }
      
      // Remove role if it exists
      if (listing.roleId && targetMember) {
        const role = interaction.guild.roles.cache.get(listing.roleId);
        if (role) {
          await targetMember.roles.remove(role).catch(err => {
            Logger.error(`Could not remove role from user:`, err);
          });
        }
      }
      
      // Remove channel permissions
      await channelService.removeUserFromChannels(
        interaction.guild,
        {
          categoryId: listing.categoryId,
          textChannelId: listing.textChannelId,
          voiceChannelId: listing.voiceChannelId
        },
        targetUser.id
      );
      
      // Send message in the text channel
      const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
      if (textChannel) {
        const actionMessage = isAdmin 
          ? `${targetUser} has been removed from the ${isParticipant ? 'fireteam' : 'substitute list'} by moderator ${interaction.user}.`
          : `${targetUser} has been removed from the ${isParticipant ? 'fireteam' : 'substitute list'} by ${interaction.user}.`;
          
        await textChannel.send(actionMessage);
      }
      
      // Update all messages - Important to update both listing message and welcome message
      await messageService.updateAllListingMessages(listing, interaction.guild);
      
      // Success message
      await interaction.editReply({
        content: `Successfully removed ${targetUser} from the ${isParticipant ? 'fireteam' : 'substitute list'} for ${listing.activityName}.`
      });
      
      // Notify host if admin action
      if (isAdmin) {
        try {
          const hostUser = await interaction.client.users.fetch(listing.hostId);
          if (hostUser && hostUser.id !== interaction.user.id) {
            await hostUser.send({
              content: `Player ${targetUser.tag} was removed from your LFG for ${listing.activityName} by a server moderator.`
            }).catch(err => {
              // Don't worry if we can't DM them
              Logger.debug(`Could not DM host about admin player removal: ${err.message}`);
            });
          }
        } catch (error) {
          Logger.error(`Error notifying host about admin player removal:`, error);
        }
      }
      
      // If a participant was removed, notify substitutes about the open spot
      if (isParticipant && listing.substitutes.length > 0 && !listing.isFull()) {
        await notificationService.notifySubstitutesOfOpenSpot(listing, interaction.client);
      }
      
    } catch (error) {
      Logger.error(`Error finding or removing user:`, error);
      await interaction.editReply({
        content: `Error: ${error.message}`
      });
    }
    
  } catch (error) {
    Logger.error('Error in remove player modal:', error);
    await interaction.editReply({
      content: 'There was an error removing the player. Please try using the /removeplayer command instead.'
    });
  }
}

module.exports = {
  handleModalSubmit
};