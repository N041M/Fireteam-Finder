/**
 * Handlers for host control buttons
 */
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const listingService = require('../../services/listing-service');
const channelService = require('../../services/channel-service');
const messageService = require('../../services/message-service');
const { canManageListing, logAdminAction } = require('../../utils/permission-utils');
const uiBuilder = require('../../utils/ui-builder');
const Logger = require('../../utils/logger');

/**
 * Handle host control buttons
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {string} action - Button action (cancel, extend, add, remove, transfer, addspot, removespot)
 * @param {string} listingId - Listing ID
 * @param {Client} client - Discord client
 */
async function handleButton(interaction, action, listingId, client) {
  // Check if the listing exists first
  const listing = listingService.getListing(listingId);
  
  if (!listing) {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply({
        content: 'This listing no longer exists or has expired.',
        ephemeral: true
      });
    } else {
      return await interaction.editReply({
        content: 'This listing no longer exists or has expired.'
      });
    }
  }
  
  // Check if the user has permission to use these controls
  const member = interaction.member;
  const isAdmin = member.id !== listing.hostId && canManageListing(member, listing);
  const hasPermission = member.id === listing.hostId || isAdmin;
  
  if (!hasPermission) {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply({
        content: 'Only the host or moderators can use these controls.',
        ephemeral: true
      });
    } else {
      return await interaction.editReply({
        content: 'Only the host or moderators can use these controls.'
      });
    }
  }
  
  // Log admin action if applicable
  if (isAdmin) {
    logAdminAction(
      member,
      `HOST_CONTROL_${action.toUpperCase()}`,
      listing,
      `Admin using host control: ${action}`
    );
  }
  
  // Route to the appropriate handler
  switch (action) {
    case 'cancel':
      return await handleCancelButton(interaction, listing, isAdmin);
    case 'extend':
      return await handleExtendButton(interaction, listing, isAdmin);
    case 'add':
      return await handleAddPlayerButton(interaction, listing, isAdmin);
    case 'remove':
      return await handleRemovePlayerButton(interaction, listing, isAdmin);
    case 'transfer':
      return await handleTransferHostButton(interaction, listing, isAdmin);
    case 'addspot':
      return await handleAddSpotButton(interaction, listing, isAdmin);
    case 'removespot':
      return await handleRemoveSpotButton(interaction, listing, isAdmin);
  }
}

/**
 * Handle the cancel button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {boolean} isAdmin - Whether the user is an admin
 */
async function handleCancelButton(interaction, listing, isAdmin = false) {
  // Only use deferReply if not already replied or deferred
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  try {
    const guild = interaction.guild;
    
    // IMPORTANT: Send confirmation message BEFORE we start deleting anything
    const confirmMessage = `${isAdmin ? 'As moderator: ' : ''}Cancelling LFG for ${listing.activityName}...`;
    await interaction.editReply({ content: confirmMessage });
    
    // If admin, notify the host via DM BEFORE deletion
    if (isAdmin) {
      try {
        const hostUser = await interaction.client.users.fetch(listing.hostId);
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
    
    // Store relevant info before deleting
    const activityName = listing.activityName;
    
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
    
    return true;
  } catch (error) {
    Logger.error(`Error cancelling listing ${listing.id}:`, error);
    
    try {
      // This might fail if channels are already deleted, so wrap in try/catch
      await interaction.editReply({
        content: 'There was an error cancelling the listing. Please try using the /cancel command instead.'
      });
    } catch (replyError) {
      // If this fails too, log but don't try further responses
      Logger.error(`Error sending error message for cancellation:`, replyError);
    }
    
    return false;
  }
}

/**
 * Handle the extend button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {boolean} isAdmin - Whether the user is an admin
 */
async function handleExtendButton(interaction, listing, isAdmin = false) {
  // Check if listing is indefinite
  if (listing.indefinite) {
    return await interaction.reply({
      content: 'This listing is already set to remain open indefinitely.',
      ephemeral: true
    });
  }
  
  try {
    // Create and show the modal for extending time
    const modal = uiBuilder.createExtendTimeModal(listing.id, listing.activityName);
    
    // Add admin flag to custom ID if admin is using it
    if (isAdmin) {
      modal.setCustomId(`extend_time_admin_${listing.id}`);
    }
    
    await interaction.showModal(modal);
    return true;
  } catch (error) {
    Logger.error(`Error showing extend time modal:`, error);
    return await interaction.reply({
      content: 'There was an error processing your request. Please use the /extend command instead.',
      ephemeral: true
    });
  }
}

/**
 * Handle the add player button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {boolean} isAdmin - Whether the user is an admin
 */
async function handleAddPlayerButton(interaction, listing, isAdmin = false) {
  try {
    // Create and show the modal for adding a player
    const modal = uiBuilder.createAddPlayerModal(listing.id, listing.activityName);
    
    // Add admin flag to custom ID if admin is using it
    if (isAdmin) {
      modal.setCustomId(`add_player_admin_${listing.id}`);
    }
    
    await interaction.showModal(modal);
    return true;
  } catch (error) {
    Logger.error(`Error showing add player modal:`, error);
    return await interaction.reply({
      content: 'There was an error processing your request. Please use the /addplayer command instead.',
      ephemeral: true
    });
  }
}

/**
 * Handle the remove player button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {boolean} isAdmin - Whether the user is an admin
 */
async function handleRemovePlayerButton(interaction, listing, isAdmin = false) {
  try {
    // Create and show the modal for removing a player
    const modal = uiBuilder.createRemovePlayerModal(listing.id, listing.activityName);
    
    // Add admin flag to custom ID if admin is using it
    if (isAdmin) {
      modal.setCustomId(`remove_player_admin_${listing.id}`);
    }
    
    await interaction.showModal(modal);
    return true;
  } catch (error) {
    Logger.error(`Error showing remove player modal:`, error);
    return await interaction.reply({
      content: 'There was an error processing your request. Please use the /removeplayer command instead.',
      ephemeral: true
    });
  }
}

/**
 * Handle the transfer host button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {boolean} isAdmin - Whether the user is an admin
 */
async function handleTransferHostButton(interaction, listing, isAdmin = false) {
  try {
    // Create and show the modal for transferring host
    const modal = uiBuilder.createTransferHostModal(listing.id, listing.activityName);
    
    // Add admin flag to custom ID if admin is using it
    if (isAdmin) {
      modal.setCustomId(`transfer_host_admin_${listing.id}`);
    }
    
    await interaction.showModal(modal);
    return true;
  } catch (error) {
    Logger.error(`Error showing transfer host modal:`, error);
    return await interaction.reply({
      content: 'There was an error processing your request. Please use the /transferhost command instead.',
      ephemeral: true
    });
  }
}

/**
 * Handle the add spot button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {boolean} isAdmin - Whether the user is an admin
 */
async function handleAddSpotButton(interaction, listing, isAdmin = false) {
  try {
    // Check spot count
    if (listing.fireteamSize >= 12) {
      return await interaction.reply({
        content: 'This listing already has the maximum allowed fireteam size (12).',
        ephemeral: true
      });
    }
    
    // Create a modal for adding spots
    const modal = uiBuilder.createAddSpotModal(listing.id, listing.activityName);
    
    // Add admin flag to custom ID if admin is using it
    if (isAdmin) {
      modal.setCustomId(`addspot_modal_admin_${listing.id}`);
    }
    
    // Show the modal
    await interaction.showModal(modal);
    return true;
  } catch (error) {
    Logger.error(`Error showing add spot modal:`, error);
    return await interaction.reply({
      content: 'There was an error processing your request. Please use the /addspot command instead.',
      ephemeral: true
    });
  }
}

/**
 * Handle the remove spot button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {boolean} isAdmin - Whether the user is an admin
 */
async function handleRemoveSpotButton(interaction, listing, isAdmin = false) {
  try {
    // Check if removing spots would be allowed
    const minSize = Math.max(listing.participants.length, 2);
    if (listing.fireteamSize <= minSize) {
      return await interaction.reply({
        content: `Cannot remove any more spots. The fireteam size must be at least as large as the current number of participants (${listing.participants.length}) and not less than 2.`,
        ephemeral: true
      });
    }
    
    // Create a modal for removing spots
    const modal = uiBuilder.createRemoveSpotModal(listing.id, listing.activityName);
    
    // Add admin flag to custom ID if admin is using it
    if (isAdmin) {
      modal.setCustomId(`removespot_modal_admin_${listing.id}`);
    }
    
    // Show the modal
    await interaction.showModal(modal);
    return true;
  } catch (error) {
    Logger.error(`Error showing remove spot modal:`, error);
    return await interaction.reply({
      content: 'There was an error processing your request. Please use the /removespot command instead.',
      ephemeral: true
    });
  }
}

module.exports = {
  handleButton
};