/**
 * Central handler for all Discord interactions
 */
const { Events } = require('discord.js');
const { handleCommand } = require('../commands');
const buttonHandlers = require('./buttons');
const selectHandlers = require('./select-handlers');
const modalHandlers = require('./modal-handlers'); // Changed from './modals/modal-handlers'
const Logger = require('../utils/logger');

/**
 * Set up interaction handlers for the Discord client
 * @param {Client} client - Discord client
 */
function setupInteractionHandlers(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      // Handle different interaction types
      if (interaction.isChatInputCommand()) {
        // Handle slash commands
        await handleCommands(interaction, client);
      } else if (interaction.isButton()) {
        // Handle button interactions
        await handleButtons(interaction, client);
      } else if (interaction.isStringSelectMenu()) {
        // Handle select menu interactions
        await handleSelectMenus(interaction, client);
      } else if (interaction.isModalSubmit()) {
        // Handle modal submissions
        await handleModals(interaction, client);
      }
    } catch (error) {
      Logger.error('Error handling interaction:', error);
      
      // Try to respond with an error message
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'There was an error processing your request. Please try again.',
            flags: ['Ephemeral'] // FIXED: Use flags instead of ephemeral property
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: 'There was an error processing your request. Please try again.'
          });
        } else {
          await interaction.followUp({
            content: 'There was an error processing your request. Please try again.',
            flags: ['Ephemeral'] // FIXED: Use flags instead of ephemeral property
          });
        }
      } catch (followUpError) {
        Logger.error('Error sending error response:', followUpError);
      }
    }
  });
}

/**
 * Handle slash command interactions
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleCommands(interaction, client) {
  // Defer reply for commands that may take longer
  if (interaction.commandName !== 'lfg') {
    await interaction.deferReply({ flags: ['Ephemeral'] }); // FIXED: Use flags instead of ephemeral property
  }
  
  // Pass to command handler
  await handleCommand(interaction, client);
}

/**
 * Handle button interactions
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleButtons(interaction, client) {
  const { customId } = interaction;
  
  // Check if this button will show a modal (shouldn't defer these)
  const willShowModal = buttonHandlers.willShowModal(customId);
  
  // Only defer for buttons that don't show modals
  if (!willShowModal) {
    await interaction.deferReply({ flags: ['Ephemeral'] }); // FIXED: Use flags instead of ephemeral property
  }
  
  // Route to the specialized button handlers
  await buttonHandlers.handleButton(interaction, client);
}

/**
 * Handle select menu interactions
 * @param {SelectMenuInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleSelectMenus(interaction, client) {
  // Select menus don't need deferring as they're quick to respond
  await selectHandlers.handleSelectMenu(interaction, client);
}

/**
 * Handle modal submissions
 * @param {ModalSubmitInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleModals(interaction, client) {
  const { customId } = interaction;
  
  // For most modals, defer reply immediately except for LFG details
  if (!customId.startsWith('lfg_details')) {
    await interaction.deferReply({ flags: ['Ephemeral'] }); // FIXED: Use flags instead of ephemeral property
  }
  
  // Route to appropriate handler
  await modalHandlers.handleModalSubmit(interaction, client);
}

module.exports = {
  setupInteractionHandlers
};