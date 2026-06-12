/**
 * Button handlers for LFG creation flow
 */
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { sessionService } = require('../../services/session-service');
const { getDefaultPlayerCount, formatActivityWithDifficulty } = require('../../config/activities');
const Logger = require('../../utils/logger');

/**
 * Handle buttons for the LFG creation flow
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {string} customId - Button customId
 */
async function handleButton(interaction, customId) {
  try {
    if (customId === 'lfg_cancel') {
      return await handleCancelButton(interaction);
    } else if (customId === 'lfg_details_button') {
      return await handleDetailsButton(interaction);
    }
  } catch (error) {
    Logger.error('Error in LFG flow button handler:', error);
    
    try {
      // Check if interaction has already been replied to or deferred
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error processing your request. Please try again.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: 'There was an error processing your request. Please try again.'
        });
      } else {
        await interaction.followUp({
          content: 'There was an error processing your request. Please try again.',
          ephemeral: true
        });
      }
    } catch (followUpError) {
      Logger.error('Error sending error message:', followUpError);
    }
  }
}

/**
 * Handle the cancel button during LFG creation
 * @param {ButtonInteraction} interaction - Discord interaction
 */
async function handleCancelButton(interaction) {
  const userId = interaction.user.id;
  
  // Check if a session exists
  const session = sessionService.getSession(userId);
  
  // If no active session or session is in completed state, prompt to start a new LFG
  if (!session || session.state === 'completed') {
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'No active LFG creation in progress. Use the /lfg command to start a new listing.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: 'No active LFG creation in progress. Use the /lfg command to start a new listing.'
        });
      } else {
        await interaction.followUp({
          content: 'No active LFG creation in progress. Use the /lfg command to start a new listing.',
          ephemeral: true
        });
      }
      return;
    } catch (error) {
      Logger.error('Error handling cancel for completed session:', error);
      return;
    }
  }
  
  // Remove the session
  sessionService.removeSession(userId);
  
  // Check if the interaction has been replied to or deferred
  try {
    if (!interaction.replied && !interaction.deferred) {
      // If not replied or deferred, use reply
      await interaction.reply({
        content: 'LFG creation cancelled.',
        ephemeral: true
      });
    } else if (interaction.deferred) {
      // If deferred, edit the reply
      await interaction.editReply({
        content: 'LFG creation cancelled.',
        components: [],
        embeds: []
      });
    } else {
      // If already replied, use followUp
      await interaction.followUp({
        content: 'LFG creation cancelled.',
        ephemeral: true
      });
    }
  } catch (error) {
    Logger.error('Error handling cancel button:', error);
    
    // If update fails due to already replied, just log the error
    if (error.code === 'InteractionAlreadyReplied') {
      Logger.warn('Interaction was already replied to. Skipping further action.');
      return;
    }
    
    // Fallback error handling
    try {
      await interaction.followUp({
        content: 'LFG creation cancelled.',
        ephemeral: true
      });
    } catch (followUpError) {
      Logger.error('Error sending followUp for cancel button:', followUpError);
    }
  }
}

/**
 * Handle the button to show the details form
 * @param {ButtonInteraction} interaction - Discord interaction
 */
async function handleDetailsButton(interaction) {
  // Get the session
  const userId = interaction.user.id;
  const session = sessionService.getSession(userId);
  
  if (!session) {
    // Use appropriate response method based on interaction state
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'No active LFG creation in progress. Use the /lfg command to start a new listing.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: 'No active LFG creation in progress. Use the /lfg command to start a new listing.'
        });
      } else {
        await interaction.followUp({
          content: 'No active LFG creation in progress. Use the /lfg command to start a new listing.',
          ephemeral: true
        });
      }
    } catch (error) {
      Logger.error('Error handling details for no session:', error);
    }
    return;
  }
  
  // Get formatted activity name
  const { activityValue, activityName, difficultyValue, isCustomActivity } = session.data;
  const formattedName = difficultyValue ? 
    formatActivityWithDifficulty(activityName, difficultyValue) : 
    activityName;
  
  // Create the details form modal
  const modal = new ModalBuilder()
    .setCustomId('lfg_details_modal')
    .setTitle(`LFG for ${formattedName.substring(0, 35)}`);
  
  // Add custom activity name field if this is an "other" activity
  if (isCustomActivity) {
    const customNameInput = new TextInputBuilder()
      .setCustomId('custom_name')
      .setLabel('Custom Activity Name')
      .setPlaceholder('Enter the name of your custom activity')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    modal.addComponents(
      new ActionRowBuilder().addComponents(customNameInput)
    );
  }
  
  // Add LFG tags field
  const tagsInput = new TextInputBuilder()
    .setCustomId('lfg_tags')
    .setLabel('LFG Tags (Optional)')
    .setPlaceholder('e.g., sherpa, lowman, flawless (comma separated)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  
  // Add form fields
  const startTimeInput = new TextInputBuilder()
    .setCustomId('start_time')
    .setLabel('Start Time (YYYY-MM-DD HH:MM)')
    .setPlaceholder('e.g., 2025-03-20 19:30 or type "indefinite"')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setPlaceholder('Any specific requirements or information')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  
  const defaultSize = getDefaultPlayerCount(activityValue);
  const fireteamSizeInput = new TextInputBuilder()
    .setCustomId('fireteam_size')
    .setLabel('Fireteam Size (including you)')
    .setValue(defaultSize.toString())
    .setPlaceholder(`Default: ${defaultSize}`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Add inputs to the modal
  modal.addComponents(
    new ActionRowBuilder().addComponents(tagsInput),
    new ActionRowBuilder().addComponents(startTimeInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(fireteamSizeInput)
  );
  
  // Show the modal, handling potential interaction state issues
  try {
    await interaction.showModal(modal);
  } catch (error) {
    Logger.error('Error showing details modal:', error);
    
    // Fallback response if modal show fails
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error opening the details form. Please try again.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: 'There was an error opening the details form. Please try again.'
        });
      } else {
        await interaction.followUp({
          content: 'There was an error opening the details form. Please try again.',
          ephemeral: true
        });
      }
    } catch (followUpError) {
      Logger.error('Error sending fallback message:', followUpError);
    }
  }
}

module.exports = {
  handleButton
};