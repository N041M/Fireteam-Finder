/**
 * Handler for the /lfg command to create LFG listings
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { sessionService, LfgState } = require('../services/session-service');
const { getActivitiesByType } = require('../config/activities');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('lfg')
  .setDescription('Create a new Looking For Group listing');

/**
 * Execute the /lfg command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Create a new session for this user
    const session = sessionService.getOrCreateSession(
      interaction.user.id,
      interaction.channelId
    );
    
    // Reset the session if it exists already
    session.reset();
    
    // Create activity type selection UI
    const embed = new EmbedBuilder()
      .setTitle('Create a Looking For Group (LFG) Listing')
      .setDescription('Select the type of activity you want to create an LFG for:')
      .setColor('#0099ff');
    
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('lfg_activity_type')
          .setPlaceholder('Select activity type')
          .addOptions([
            {
              label: 'Raids',
              value: 'raids',
              description: 'All raids (6-player activities)'
            },
            {
              label: 'PvE Activities',
              value: 'pve',
              description: 'Nightfalls, dungeons, etc.'
            },
            {
              label: 'PvP Activities',
              value: 'pvp',
              description: 'Crucible, Trials, Iron Banner, etc.'
            },
            {
              label: 'Other',
              value: 'other',
              description: 'Custom activities'
            }
          ])
      );
    
    // FIXED: Send the initial reply with proper flag usage
    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: ['Ephemeral'], // FIXED: Use flags instead of ephemeral property
      withResponse: true     // FIXED: Use withResponse instead of fetchReply
    });
    
    // Update session with message ID (withResponse returns an
    // InteractionCallbackResponse; the message lives on .resource)
    session.setMessageId(response.resource?.message?.id ?? null);
    
    Logger.debug(`Started LFG creation for user ${interaction.user.id}`);
    
  } catch (error) {
    Logger.error('Error in LFG command:', error);
    
    if (!interaction.replied) {
      await interaction.reply({
        content: 'There was an error starting the LFG creation process. Please try again.',
        flags: ['Ephemeral'] // FIXED: Use flags instead of ephemeral property
      });
    }
  }
}

module.exports = {
  data,
  execute
};