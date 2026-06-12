/**
 * Handlers for modal submissions
 */
const Logger = require('../utils/logger');
const lfgDetailsModal = require('./modals/lfg-details-modal');
const extendTimeModal = require('./modals/extend-time-modal');
const addPlayerModal = require('./modals/add-player-modal');
const removePlayerModal = require('./modals/remove-player-modal');
const transferHostModal = require('./modals/transfer-host-modal');
const addSpotModal = require('./modals/add-spot-modal');
const removeSpotModal = require('./modals/remove-spot-modal');

/**
 * Extract listing ID from a modal custom ID, handling both regular and admin formats
 * @param {string} customId - The modal custom ID
 * @param {string} prefix - The prefix to search for (e.g., 'extend_time_')
 * @returns {string} The extracted listing ID
 */
function extractListingId(customId, prefix) {
  // Extract all parts after the prefix
  const baseString = customId.substring(prefix.length);
  
  // Check if this is an admin action by looking for 'admin_' in the string
  const isAdminAction = baseString.startsWith('admin_');
  
  // If admin action, return the ID after 'admin_'
  if (isAdminAction) {
    return baseString.substring(6); // 'admin_' is 6 characters
  }
  
  // Otherwise return the base string as the ID
  return baseString;
}

/**
 * Handle a modal submission
 * @param {ModalSubmitInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleModalSubmit(interaction, client) {
  try {
    const { customId } = interaction;
    Logger.debug(`Handling modal submission: ${customId}`);
    
    // LFG details form
    if (customId === 'lfg_details_modal') {
      return await lfgDetailsModal.handleModalSubmit(interaction);
    }
    
    // Extend time modal - support both regular and admin versions
    if (customId.startsWith('extend_time_')) {
      const listingId = extractListingId(customId, 'extend_time_');
      return await extendTimeModal.handleModalSubmit(interaction, listingId);
    }
    
    // Add player modal - support both regular and admin versions
    if (customId.startsWith('add_player_')) {
      const listingId = extractListingId(customId, 'add_player_');
      return await addPlayerModal.handleModalSubmit(interaction, listingId);
    }
    
    // Remove player modal - support both regular and admin versions
    if (customId.startsWith('remove_player_')) {
      const listingId = extractListingId(customId, 'remove_player_');
      return await removePlayerModal.handleModalSubmit(interaction, listingId);
    }
    
    // Transfer host modal - support both regular and admin versions
    if (customId.startsWith('transfer_host_')) {
      const listingId = extractListingId(customId, 'transfer_host_');
      return await transferHostModal.handleModalSubmit(interaction, listingId);
    }
    
    // Add spot modal - support both regular and admin versions
    if (customId.startsWith('addspot_modal_')) {
      const listingId = extractListingId(customId, 'addspot_modal_');
      return await addSpotModal.handleModalSubmit(interaction, listingId);
    }
    
    // Remove spot modal - support both regular and admin versions
    if (customId.startsWith('removespot_modal_')) {
      const listingId = extractListingId(customId, 'removespot_modal_');
      return await removeSpotModal.handleModalSubmit(interaction, listingId);
    }
    
    Logger.debug(`Unknown modal type: ${customId}`);
    await interaction.reply({
      content: 'This form is not currently supported.',
      ephemeral: true
    });
    
  } catch (error) {
    Logger.error('Error handling modal submission:', error);
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error processing your submission. Please try again.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: 'There was an error processing your submission. Please try again.'
        });
      } else {
        await interaction.followUp({
          content: 'There was an error processing your submission. Please try again.',
          ephemeral: true
        });
      }
    } catch (followUpError) {
      Logger.error('Error sending error message:', followUpError);
    }
  }
}

module.exports = {
  handleModalSubmit
};