/**
 * Utilities for building Discord embeds
 * Note: Most functionality has been moved to message-service.js
 * This file remains for backward compatibility
 */
const messageService = require('../services/message-service');

/**
 * Create an embed for an LFG listing
 * @param {Listing} listing - The listing
 * @returns {EmbedBuilder} The embed
 */
function createListingEmbed(listing) {
  return messageService.createListingEmbed(listing);
}

/**
 * Create a compact listing embed for listings overview
 * @param {Listing} listing - The listing
 * @returns {EmbedBuilder} The embed
 */
function createCompactListingEmbed(listing) {
  return messageService.createCompactListingEmbed(listing);
}

/**
 * Create a detailed info embed for a listing
 * @param {Listing} listing - The listing
 * @param {number} lifetimeMs - Listing lifetime in milliseconds
 * @returns {EmbedBuilder} The embed
 */
function createDetailedInfoEmbed(listing, lifetimeMs) {
  return messageService.createDetailedInfoEmbed(listing, lifetimeMs);
}

/**
 * Create a welcome embed for the text channel
 * @param {Listing} listing - The listing
 * @returns {EmbedBuilder} The embed
 */
function createWelcomeEmbed(listing) {
  return messageService.createWelcomeEmbed(listing);
}

module.exports = {
  createListingEmbed,
  createCompactListingEmbed,
  createDetailedInfoEmbed,
  createWelcomeEmbed
};