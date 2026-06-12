/**
 * Central handler for button interactions
 */
const hostControlButtons = require('./host-control-buttons');
const participantButtons = require('./participant-buttons');
const substituteButtons = require('./substitute-buttons');
const lfgFlowButtons = require('./lfg-flow-buttons');
const infoButton = require('./info-button');
const listingService = require('../../services/listing-service');
const Logger = require('../../utils/logger');

/**
 * Determine if a button will show a modal
 * @param {string} customId - Button customId
 * @returns {boolean} Whether the button will show a modal
 */
function willShowModal(customId) {
  // Buttons that show modals directly
  if (
    customId.startsWith('add_') ||
    customId.startsWith('remove_') ||
    customId.startsWith('transfer_') ||
    customId.startsWith('extend_') ||
    customId.startsWith('addspot_') ||
    customId.startsWith('removespot_') ||
    customId === 'lfg_details_button'
  ) {
    return true;
  }
  
  // All other buttons don't show modals
  return false;
}

/**
 * Handle a button interaction
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleButton(interaction, client) {
  try {
    const { customId } = interaction;
    Logger.debug(`Handling button: ${customId}`);
    
    // LFG creation flow buttons
    if (customId === 'lfg_cancel' || customId === 'lfg_details_button') {
      return await lfgFlowButtons.handleButton(interaction, customId);
    }
    
    // Info button (special case that doesn't follow the standard format)
    if (customId.startsWith('info_')) {
      const listingId = customId.replace('info_', '');
      return await infoButton.handleInfoButton(interaction, listingId);
    }
    
    // Extract action and listingId from the customId
    // Format is generally: action_listingId
    const [action, ...rest] = customId.split('_');
    const listingId = rest.join('_');
    
    // Check if the listing exists before routing to specific handlers
    const listing = listingService.getListing(listingId);
    if (!listing) {
      // Provide a more informative error message
      const replyContent = 'This listing is no longer available. It may have been canceled by the host or automatically expired. Please check the current LFG listings by using the `/listings` command.';
      
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({
          content: replyContent,
          ephemeral: true
        });
      } else {
        return await interaction.editReply({
          content: replyContent
        });
      }
    }
    
    // Route to the appropriate handler
    if (['extend', 'add', 'remove', 'transfer', 'cancel', 'addspot', 'removespot'].includes(action)) {
      return await hostControlButtons.handleButton(interaction, action, listingId, client);
    } else if (['join', 'sub', 'leave'].includes(action)) {
      return await participantButtons.handleButton(interaction, action, listingId, client);
    } else if (['accept', 'decline'].includes(action)) {
      return await substituteButtons.handleButton(interaction, action, listingId, client);
    } else {
      Logger.debug(`Unknown button action: ${action}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'This button is not currently supported.',
          ephemeral: true
        });
      } else {
        await interaction.followUp({
          content: 'This button is not currently supported.',
          ephemeral: true
        });
      }
    }
  } catch (error) {
    Logger.error('Error handling button interaction:', error);
    
    try {
      // IMPROVED ERROR HANDLING: Check if interaction is still valid before replying
      // This prevents errors when channels have been deleted
      if (interaction.channel) {
        // Only attempt to reply if the channel still exists
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'There was an error processing your request. Please try again or use the `/listings` command to see active LFGs.',
            ephemeral: true
          });
        } else if (interaction.replied) {
          // Only use followUp if successfully replied
          await interaction.followUp({
            content: 'There was an error processing your request. Please try again or use the `/listings` command to see active LFGs.',
            ephemeral: true
          }).catch(e => {
            // Silently fail if followUp fails - channel might be gone
            Logger.debug(`Could not send followUp: ${e.message}`);
          });
        }
      } else {
        Logger.debug('Cannot reply to interaction - channel no longer exists');
      }
    } catch (followUpError) {
      // Just log and continue if we can't reply - don't crash
      Logger.error('Error sending error response:', followUpError);
    }
  }
}

module.exports = {
  willShowModal,
  handleButton
};