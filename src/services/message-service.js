/**
 * Service for managing and updating LFG-related messages
 */
const { EmbedBuilder } = require('discord.js');
const { formatDateTime, discordTimestamp } = require('../utils/date-utils');
const { LFG_TAGS } = require('../config/activities');
const channelService = require('./channel-service');
const Logger = require('../utils/logger');

/**
 * Create an embed for an LFG listing
 * @param {Listing} listing - The listing
 * @returns {EmbedBuilder} The embed
 */
function createListingEmbed(listing) {
  // Create participants list with proper spacing
  const participantsList = Array(listing.fireteamSize).fill('___ Available ___');
  
  listing.participants.forEach((participantId, index) => {
    if (index < participantsList.length) {
      if (participantId === listing.hostId) {
        participantsList[index] = `<@${participantId}> (Host)`;
      } else {
        participantsList[index] = `<@${participantId}>`;
      }
    }
  });
  
  // Format participants as a numbered list
  const participantsText = participantsList
    .map((participant, index) => `${index + 1}. ${participant}`)
    .join('\n');
  
  // Format time display
  const timeDisplay = listing.indefinite 
    ? 'No scheduled end (indefinite)' 
    : discordTimestamp(listing.startTime, 'F');
  
  // Format tags if present
  let tagsDisplay = '';
  if (listing.tags && listing.tags.length > 0) {
    const tagLabels = listing.tags.map(tagValue => {
      const tagObj = LFG_TAGS.find(t => t.value === tagValue);
      return tagObj ? tagObj.label : tagValue;
    });
    tagsDisplay = `\n**Tags:** ${tagLabels.join(', ')}`;
  }
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle(`LFG: ${listing.activityName}`)
    .setDescription(
      `**Host:** <@${listing.hostId}>\n` +
      `**Time:** ${timeDisplay}` +
      tagsDisplay + 
      `\n**Description:** ${listing.description}\n\n` +
      `**Fireteam (${listing.participants.length}/${listing.fireteamSize}):**\n` +
      participantsText
    )
    .setColor('#0099ff')
    .setFooter({ text: `Listing ID: ${listing.id}` });
  
  // Add substitutes if there are any
  if (listing.substitutes && listing.substitutes.length > 0) {
    const substitutesText = listing.substitutes
      .map(id => `<@${id}>`)
      .join('\n');
    
    embed.addFields({ 
      name: `Substitutes (${listing.substitutes.length})`, 
      value: substitutesText 
    });
  }
  
  return embed;
}

/**
 * Create a compact listing embed for listings overview
 * @param {Listing} listing - The listing
 * @returns {EmbedBuilder} The embed
 */
function createCompactListingEmbed(listing) {
  // Format time display
  const timeDisplay = listing.indefinite 
    ? 'No scheduled end (indefinite)' 
    : discordTimestamp(listing.startTime, 'F');
  
  // Format tags if present
  let tagsDisplay = '';
  if (listing.tags && listing.tags.length > 0) {
    const tagLabels = listing.tags.map(tagValue => {
      const tagObj = LFG_TAGS.find(t => t.value === tagValue);
      return tagObj ? tagObj.label : tagValue;
    });
    tagsDisplay = ` | Tags: ${tagLabels.join(', ')}`;
  }
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle(`LFG: ${listing.activityName}`)
    .setDescription(
      `**ID:** ${listing.id}\n` +
      `**Host:** <@${listing.hostId}>\n` +
      `**Time:** ${timeDisplay}\n` +
      `**Description:** ${listing.description.substring(0, 100)}${listing.description.length > 100 ? '...' : ''}`
    )
    .setColor('#0099ff')
    .addFields(
      { 
        name: 'Status', 
        value: `Fireteam: ${listing.participants.length}/${listing.fireteamSize} | Substitutes: ${listing.substitutes.length}${tagsDisplay}`,
        inline: true
      },
      {
        name: 'Channel',
        value: `<#${listing.textChannelId}>`,
        inline: true
      }
    );
  
  return embed;
}

/**
 * Create a detailed info embed for a listing
 * @param {Listing} listing - The listing
 * @param {number} lifetimeMs - Listing lifetime in milliseconds
 * @returns {EmbedBuilder} The embed
 */
function createDetailedInfoEmbed(listing, lifetimeMs) {
  // Format time display
  const timeDisplay = listing.indefinite 
    ? 'No scheduled end (indefinite)' 
    : discordTimestamp(listing.startTime, 'F');
  
  // Format tags if present
  let tagsText = 'None';
  if (listing.tags && listing.tags.length > 0) {
    const tagLabels = listing.tags.map(tagValue => {
      const tagObj = LFG_TAGS.find(t => t.value === tagValue);
      return tagObj ? tagObj.label : tagValue;
    });
    tagsText = tagLabels.join(', ');
  }
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle(`Fireteam Info: ${listing.activityName}`)
    .setDescription(
      `**Host:** <@${listing.hostId}>\n` +
      `**Time:** ${timeDisplay}\n` +
      `**Description:** ${listing.description}`
    )
    .setColor('#0099ff')
    .addFields(
      { 
        name: 'Fireteam ID', 
        value: listing.id, 
        inline: true 
      },
      { 
        name: 'Created', 
        value: discordTimestamp(listing.createdAt, 'R'), 
        inline: true 
      },
      { 
        name: 'Status', 
        value: `${listing.participants.length}/${listing.fireteamSize} Guardians`, 
        inline: true 
      },
      {
        name: 'Tags',
        value: tagsText,
        inline: false
      }
    )
    .setFooter({ text: 'Join the voice channel to participate' });
  
  // Add participants
  const participantsText = listing.participants.length > 0
    ? listing.participants
        .map((id, index) => `${index + 1}. <@${id}>${id === listing.hostId ? ' (Host)' : ''}`)
        .join('\n')
    : 'No participants yet';
  
  embed.addFields({ 
    name: 'Current Fireteam', 
    value: participantsText 
  });
  
  // Add substitutes if there are any
  if (listing.substitutes && listing.substitutes.length > 0) {
    const substitutesText = listing.substitutes
      .map((id, index) => `${index + 1}. <@${id}>`)
      .join('\n');
    
    embed.addFields({ 
      name: 'Substitutes', 
      value: substitutesText 
    });
  }
  
  // Add channel information
  embed.addFields(
    { 
      name: 'Text Channel', 
      value: `<#${listing.textChannelId}>`, 
      inline: true 
    },
    { 
      name: 'Voice Channel', 
      value: `<#${listing.voiceChannelId}>`, 
      inline: true 
    }
  );
  
  // Add cleanup information
  if (!listing.indefinite) {
    // Use start time instead of creation time for auto-cleanup calculation
    const expiryTime = new Date(new Date(listing.startTime).getTime() + lifetimeMs);
    
    embed.addFields({ 
      name: 'Auto-Cleanup', 
      value: `Channels will be automatically removed ${discordTimestamp(expiryTime, 'R')}`
    });
  } else {
    embed.addFields({ 
      name: 'Auto-Cleanup', 
      value: 'This listing is set to remain open indefinitely until manually cancelled.'
    });
  }
  
  return embed;
}

/**
 * Create a welcome embed for the text channel
 * @param {Listing} listing - The listing
 * @returns {EmbedBuilder} The embed
 */
function createWelcomeEmbed(listing) {
  // Format time display
  const timeDisplay = listing.indefinite 
    ? 'No scheduled end (indefinite)' 
    : discordTimestamp(listing.startTime, 'F');
  
  // Format tags if present
  let tagsDisplay = '';
  if (listing.tags && listing.tags.length > 0) {
    const tagLabels = listing.tags.map(tagValue => {
      const tagObj = LFG_TAGS.find(t => t.value === tagValue);
      return tagObj ? tagObj.label : tagValue;
    });
    tagsDisplay = `\n**Tags:** ${tagLabels.join(', ')}`;
  }
  
  // Format participants as a numbered list
  const participantsList = listing.participants.map((id, index) => {
    if (id === listing.hostId) {
      return `${index + 1}. <@${id}> (Host)`;
    } else {
      return `${index + 1}. <@${id}>`;
    }
  });

  // Fill remaining slots with "Available" placeholders
  for (let i = participantsList.length; i < listing.fireteamSize; i++) {
    participantsList.push(`${i + 1}. ___ Available ___`);
  }

  const participantsText = participantsList.join('\n');
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle(`LFG: ${listing.activityName}`)
    .setDescription(
      `**Host:** <@${listing.hostId}>\n` +
      `**Time:** ${timeDisplay}` +
      tagsDisplay + 
      `\n**Description:** ${listing.description}`
    )
    .setColor('#0099ff')
    .addFields([
      {
        name: 'Fireteam Size:',
        value: `${listing.fireteamSize}`,
        inline: true
      },
      {
        name: `Participants`,
        value: `**Fireteam (${listing.participants.length}/${listing.fireteamSize}):**\n${participantsText}`,
        inline: false
      }
    ]);
    
  // Add substitutes if there are any
  if (listing.substitutes && listing.substitutes.length > 0) {
    const substitutesList = listing.substitutes.map(id => `<@${id}>`).join(', ');
    embed.addFields({
      name: `Substitutes (${listing.substitutes.length})`,
      value: substitutesList,
      inline: false
    });
  }
  
  // Add Getting Started field
  embed.addFields({
    name: 'Getting Started',
    value: 'Please use the voice channel for communication during the activity. The host can add or remove players using the controls below. Joining this channel will give you access to the LFG voice channel.',
    inline: false
  });
  
  embed.setFooter({ text: `Listing ID: ${listing.id}` });
  
  return embed;
}

/**
 * Update the listing message with the latest embed
 * @param {Listing} listing - The listing to update
 * @param {Guild} guild - Discord guild
 * @returns {Promise<boolean>} Success status
 */
async function updateListingMessage(listing, guild) {
  try {
    if (!listing.messageId) return false;
    
    // Get the LFG channel
    const lfgChannel = channelService.getLfgChannel(guild);
    if (!lfgChannel) return false;
    
    // Get and update the message
    const message = await lfgChannel.messages.fetch(listing.messageId).catch(() => null);
    if (message) {
      const embed = createListingEmbed(listing);
      await message.edit({ embeds: [embed] });
      return true;
    }
    return false;
  } catch (error) {
    Logger.error('Error updating listing message:', error);
    return false;
  }
}

/**
 * Update the welcome message in the LFG channel
 * @param {Listing} listing - The listing
 * @param {Guild} guild - Discord guild
 * @returns {Promise<boolean>} Success status
 */
async function updateWelcomeMessage(listing, guild) {
  try {
    const textChannel = guild.channels.cache.get(listing.textChannelId);
    if (!textChannel) return false;

    // Fetch recent messages to find the welcome message
    const messages = await textChannel.messages.fetch({
      limit: 20
    });

    // Find the welcome message (usually first in the channel with embeds)
    const welcomeMessage = messages.find(message =>
      message.author.bot &&
      message.content.includes('hosting this activity') &&
      message.embeds &&
      message.embeds.length > 0
    );

    if (welcomeMessage) {
      const embed = createWelcomeEmbed(listing);
      
      // Update the message content - keep the original content with role/user pings
      let content = welcomeMessage.content;
      
      // Update host reference in content if needed
      if (content.includes("will be hosting") && !content.includes(`<@${listing.hostId}>`)) {
        // Replace old host mention with new host
        content = content.replace(/<@\d+> will be hosting/, `<@${listing.hostId}> will be hosting`);
      } else if (content.includes("is now hosting") && !content.includes(`<@${listing.hostId}>`)) {
        // Replace old host mention with new host
        content = content.replace(/<@\d+> is now hosting/, `<@${listing.hostId}> is now hosting`);
      }
      
      await welcomeMessage.edit({
        content: content,
        embeds: [embed]
      });
      
      Logger.debug(`Updated welcome message for listing ${listing.id}`);
      return true;
    }
    return false;
  } catch (error) {
    Logger.error(`Error updating welcome message:`, error);
    return false;
  }
}

/**
 * Update the host controls message with the new host
 * @param {Listing} listing - The listing
 * @param {Guild} guild - Discord guild
 * @param {string} oldHostId - Old host ID (optional)
 * @returns {Promise<boolean>} Success status
 */
async function updateHostControlsMessage(listing, guild, oldHostId = null) {
  try {
    const textChannel = guild.channels.cache.get(listing.textChannelId);
    if (!textChannel) return false;

    // Fetch more messages to find the host controls message
    const messages = await textChannel.messages.fetch({ limit: 30 });
    
    // Find the host controls message
    const hostControlsMessage = messages.find(message => 
      message.author.bot &&
      message.content.includes('HOST CONTROLS') && 
      message.components && 
      message.components.length > 0
    );
    
    if (hostControlsMessage) {
      // Update the controls message content
      await hostControlsMessage.edit({
        content: `**HOST CONTROLS** - Only <@${listing.hostId}> can use these buttons:`,
        components: hostControlsMessage.components // Keep the same buttons
      });
      
      Logger.debug(`Updated host controls message for listing ${listing.id}`);
      return true;
    }
    return false;
  } catch (error) {
    Logger.error(`Error updating host controls message:`, error);
    return false;
  }
}

/**
 * Update all messages associated with a listing
 * @param {Listing} listing - The listing
 * @param {Guild} guild - Discord guild
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Results of the updates
 */
async function updateAllListingMessages(listing, guild, options = {}) {
  const results = {
    listingMessage: false,
    welcomeMessage: false,
    hostControlsMessage: false
  };
  
  // Update the main listing message
  results.listingMessage = await updateListingMessage(listing, guild);
  
  // Update the welcome message
  results.welcomeMessage = await updateWelcomeMessage(listing, guild);
  
  // Update host controls message if host has changed
  if (options.oldHostId) {
    results.hostControlsMessage = await updateHostControlsMessage(listing, guild, options.oldHostId);
  }
  
  return results;
}

module.exports = {
  // Embed creators
  createListingEmbed,
  createCompactListingEmbed,
  createDetailedInfoEmbed,
  createWelcomeEmbed,
  
  // Message updaters
  updateListingMessage,
  updateWelcomeMessage,
  updateHostControlsMessage,
  updateAllListingMessages
};