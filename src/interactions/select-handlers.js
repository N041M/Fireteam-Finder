/**
 * Handlers for select menu interactions
 */
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { sessionService, LfgState } = require('../services/session-service');
const { getActivitiesByType, getActivityName, hasDifficultyOptions, getDifficultyOptions, formatActivityWithDifficulty } = require('../config/activities');
const Logger = require('../utils/logger');

/**
 * Handle a select menu interaction
 * @param {SelectMenuInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleSelectMenu(interaction, client) {
  const { customId, values } = interaction;
  const value = values[0];
  
  // Route based on the customId
  if (customId === 'lfg_activity_type') {
    return handleActivityTypeSelect(interaction, value);
  } else if (customId === 'lfg_specific_activity') {
    return handleSpecificActivitySelect(interaction, value);
  } else if (customId === 'lfg_difficulty') {
    return handleDifficultySelect(interaction, value);
  } else {
    Logger.debug(`Unknown select menu: ${customId}`);
    await interaction.reply({
      content: 'This selection menu is not currently supported.',
      ephemeral: true
    });
  }
}

/**
 * Handle the activity type selection
 * @param {SelectMenuInteraction} interaction - Discord interaction
 * @param {string} activityType - Selected activity type
 */
async function handleActivityTypeSelect(interaction, activityType) {
  try {
    // Get user session
    const userId = interaction.user.id;
    const session = sessionService.getSession(userId);
    
    if (!session) {
      Logger.debug(`No session found for user ${userId} in activity type selection`);
      await interaction.update({
        content: 'Your session has expired. Please use the /lfg command again.',
        components: [],
        embeds: []
      });
      return;
    }
    
    // Update session
    session.setState(LfgState.SPECIFIC_ACTIVITY);
    session.updateData({ activityType });
    
    // Get activities of the selected type
    const activities = getActivitiesByType(activityType);
    
    // Create the activity selection menu
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('lfg_specific_activity')
          .setPlaceholder('Select specific activity')
          .addOptions(activities)
      );
    
    // Add cancel button
    const cancelRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('lfg_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Update the embed
    const embed = new EmbedBuilder()
      .setTitle('Create a Looking For Group (LFG) Listing')
      .setDescription('Choose the specific activity:')
      .setColor('#0099ff')
      .setFooter({ text: 'Step 2 of 3 or 4' });
    
    // Update the message
    await interaction.update({
      embeds: [embed],
      components: [row, cancelRow]
    });
    
  } catch (error) {
    Logger.error('Error in activity type selection:', error);
    await interaction.update({
      content: 'There was an error processing your selection. Please try again.',
      components: [],
      embeds: []
    });
  }
}

/**
 * Handle the specific activity selection
 * @param {SelectMenuInteraction} interaction - Discord interaction
 * @param {string} activityValue - Selected activity
 */
async function handleSpecificActivitySelect(interaction, activityValue) {
  try {
    // Get user session
    const userId = interaction.user.id;
    const session = sessionService.getSession(userId);
    
    if (!session) {
      Logger.debug(`No session found for user ${userId} in specific activity selection`);
      await interaction.update({
        content: 'Your session has expired. Please use the /lfg command again.',
        components: [],
        embeds: []
      });
      return;
    }
    
    // Get activity name
    const activityName = getActivityName(activityValue);
    
    // Update session
    session.updateData({ activityValue, activityName });
    
    // Set a flag for custom activity if type is "other"
    if (activityValue === 'other') {
      session.updateData({ isCustomActivity: true });
    } else {
      session.updateData({ isCustomActivity: false });
    }
    
    // Check if this activity has difficulty options
    if (hasDifficultyOptions(activityValue)) {
      // Move to difficulty selection state
      session.setState(LfgState.DIFFICULTY);
      
      // Get difficulty options
      const difficultyOptions = getDifficultyOptions(activityValue);
      
      // Create difficulty selection menu
      const row = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('lfg_difficulty')
            .setPlaceholder('Select difficulty')
            .addOptions(difficultyOptions)
        );
      
      // Add cancel button
      const cancelRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('lfg_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
      
      // Update the embed
      const embed = new EmbedBuilder()
        .setTitle('Create a Looking For Group (LFG) Listing')
        .setDescription(`You selected **${activityName}**. Please select the difficulty:`)
        .setColor('#0099ff')
        .setFooter({ text: 'Step 3 of 4' });
      
      // Update the message
      await interaction.update({
        embeds: [embed],
        components: [row, cancelRow]
      });
    } else {
      // Skip to details form 
      session.setState(LfgState.DETAILS);
      
      // Create button to open details form
      const detailsRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('lfg_details_button')
            .setLabel('Fill Out Details')
            .setStyle(ButtonStyle.Primary)
        );
      
      // Add cancel button
      const cancelRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('lfg_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
      
      // Update the embed
      const embed = new EmbedBuilder()
        .setTitle('Create a Looking For Group (LFG) Listing')
        .setDescription(`You selected **${activityName}**. Click the button below to fill out the remaining details:`)
        .setColor('#0099ff')
        .setFooter({ text: 'Step 3 of 3' });
      
      // Update the message
      await interaction.update({
        embeds: [embed],
        components: [detailsRow, cancelRow]
      });
    }
    
  } catch (error) {
    Logger.error('Error in specific activity selection:', error);
    await interaction.update({
      content: 'There was an error processing your selection. Please try again.',
      components: [],
      embeds: []
    });
  }
}

/**
 * Handle the difficulty selection
 * @param {SelectMenuInteraction} interaction - Discord interaction
 * @param {string} difficultyValue - Selected difficulty
 */
async function handleDifficultySelect(interaction, difficultyValue) {
  try {
    // Get user session
    const userId = interaction.user.id;
    const session = sessionService.getSession(userId);
    
    if (!session) {
      Logger.debug(`No session found for user ${userId} in difficulty selection`);
      await interaction.update({
        content: 'Your session has expired. Please use the /lfg command again.',
        components: [],
        embeds: []
      });
      return;
    }
    
    // Get activity details
    const { activityName } = session.data;
    const formattedActivityName = formatActivityWithDifficulty(activityName, difficultyValue);
    
    // Update session
    session.setState(LfgState.DETAILS);
    session.updateData({ difficultyValue });
    
    // Create button to open details form
    const detailsRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('lfg_details_button')
          .setLabel('Fill Out Details')
          .setStyle(ButtonStyle.Primary)
      );
    
    // Add cancel button
    const cancelRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('lfg_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Update the embed
    const embed = new EmbedBuilder()
      .setTitle('Create a Looking For Group (LFG) Listing')
      .setDescription(`You selected **${formattedActivityName}**. Click the button below to fill out the remaining details:`)
      .setColor('#0099ff')
      .setFooter({ text: 'Step 4 of 4' });
    
    // Update the message
    await interaction.update({
      embeds: [embed],
      components: [detailsRow, cancelRow]
    });
    
  } catch (error) {
    Logger.error('Error in difficulty selection:', error);
    await interaction.update({
      content: 'There was an error processing your selection. Please try again.',
      components: [],
      embeds: []
    });
  }
}

module.exports = {
  handleSelectMenu
};