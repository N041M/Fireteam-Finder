/**
 * Handler for the info button
 */
const listingService = require('../../services/listing-service');
const { createDetailedInfoEmbed } = require('../../utils/embed-builder');
const config = require('../../config');
const Logger = require('../../utils/logger');

/**
 * Handle the info button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {string} listingId - Listing ID
 */
async function handleInfoButton(interaction, listingId) {
  try {
    // Get the listing
    const listing = listingService.getListing(listingId);
    
    if (!listing) {
      await interaction.editReply({
        content: 'This listing no longer exists or has expired.'
      });
      return;
    }
    
    // Create a detailed info embed
    const infoEmbed = createDetailedInfoEmbed(listing, config.LISTING_LIFETIME_MS);
    
    // Send the info embed
    await interaction.editReply({
      content: null,
      embeds: [infoEmbed]
    });
    
  } catch (error) {
    Logger.error('Error handling info button:', error);
    await interaction.editReply({
      content: 'There was an error retrieving information for this LFG. Please try again.'
    });
  }
}

module.exports = {
  handleInfoButton
};