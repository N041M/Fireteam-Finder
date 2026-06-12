/**
 * Handler for the /listings command to view active LFG listings
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const listingService = require('../services/listing-service');
const { createCompactListingEmbed } = require('../utils/embed-builder');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('listings')
  .setDescription('View all active LFG listings');

/**
 * Execute the /listings command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Get all active listings
    const listings = listingService.getAllListings();
    Logger.debug(`Found ${listings.length} active listings`);
    
    if (listings.length === 0) {
      // No active listings
      await interaction.editReply({
        content: 'There are no active LFG listings at the moment. Create one with the `/lfg` command!'
      });
      return;
    }
    
    // Create embeds for each listing (compact view)
    const listingEmbeds = listings.map(listing => createCompactListingEmbed(listing));
    
    // Split embeds into chunks of 10 if there are many
    const embedChunks = [];
    for (let i = 0; i < listingEmbeds.length; i += 10) {
      embedChunks.push(listingEmbeds.slice(i, i + 10));
    }
    
    // Send the first chunk
    await interaction.editReply({
      content: `Found ${listings.length} active LFG listings:`,
      embeds: embedChunks[0]
    });
    
    // Send additional chunks as follow-up messages if needed
    for (let i = 1; i < embedChunks.length; i++) {
      await interaction.followUp({
        embeds: embedChunks[i],
        ephemeral: true
      });
    }
  } catch (error) {
    Logger.error('Error in listings command:', error);
    await interaction.editReply({
      content: 'There was an error retrieving the active listings. Please try again.'
    });
  }
}

module.exports = {
  data,
  execute
};