/**
 * Service for creating and managing Discord channels for LFG listings
 */
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../config');
const Logger = require('../utils/logger');

/**
 * Create channels for an LFG listing
 * @param {Guild} guild - Discord guild
 * @param {string} activityName - Activity name
 * @param {string} activityValue - Activity ID
 * @param {string} listingId - Listing ID
 * @param {string} roleId - Role ID for permissions
 * @param {number} fireteamSize - Size of the fireteam (for voice channel user limit)
 * @returns {Promise<Object>} Channel IDs
 */
async function createChannels(guild, activityName, activityValue, listingId, roleId, fireteamSize = 6) {
  try {
    // Check for Sherpa role
    let sherpaRole = null;
    if (config.SHERPA_ROLE_ID) {
      sherpaRole = guild.roles.cache.get(config.SHERPA_ROLE_ID);
    }
    
    // Base permissions for created channels
    const permissions = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      }
    ];
    
    // Add role permissions if a role exists
    if (roleId) {
      permissions.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      });
    }
    
    // Add Sherpa role permissions if it exists
    if (sherpaRole) {
      permissions.push({
        id: sherpaRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.MentionEveryone,
          PermissionFlagsBits.MuteMembers // Add ability to mute members
        ]
      });
    }
    
    // Create a category
    const category = await guild.channels.create({
      name: `🔥 LFG: ${activityName} (${listingId})`,
      type: ChannelType.GuildCategory,
      permissionOverwrites: permissions
    });
    
    // Create a text channel
    const textChannel = await guild.channels.create({
      name: `lfg-${activityValue}-${listingId.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: permissions
    });
    
    // Create a voice channel with user limit matching the fireteam size
    const voiceChannel = await guild.channels.create({
      name: `🎮 ${activityName} - ${listingId}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: permissions,
      userLimit: fireteamSize // Set user limit to the specified fireteam size
    });
    
    Logger.debug(`Created voice channel with limit of ${fireteamSize} players for listing ${listingId}`);
    
    return {
      categoryId: category.id,
      textChannelId: textChannel.id,
      voiceChannelId: voiceChannel.id
    };
  } catch (error) {
    Logger.error('Error creating channels:', error);
    throw error;
  }
}

/**
 * Add a user to channels
 * @param {Guild} guild - Discord guild
 * @param {Object} channels - Channel IDs object
 * @param {string} userId - User ID
 * @param {boolean} isSubstitute - Whether user is a substitute
 * @param {boolean} isHost - Whether user is the host
 */
async function addUserToChannels(guild, channels, userId, isSubstitute = false, isHost = false) {
  try {
    const { categoryId, textChannelId, voiceChannelId } = channels;
    
    // Define base permissions
    const basePermissions = {
      ViewChannel: true,
      ReadMessageHistory: true
    };
    
    // Add different permissions based on user type
    const textPermissions = {
      ...basePermissions,
      SendMessages: !isSubstitute // Substitutes can't send messages
    };
    
    const voicePermissions = {
      ...basePermissions,
      Connect: true,
      Speak: true
    };
    
    // If this user is the host, give them moderation permissions
    if (isHost) {
      textPermissions.MentionEveryone = true;
      voicePermissions.MuteMembers = true;
      voicePermissions.PrioritySpeaker = true; // Give host priority speaker
    }
    
    // Update permissions on all channels
    const category = guild.channels.cache.get(categoryId);
    const textChannel = guild.channels.cache.get(textChannelId);
    const voiceChannel = guild.channels.cache.get(voiceChannelId);
    
    if (category) {
      await category.permissionOverwrites.create(userId, basePermissions);
    }
    
    if (textChannel) {
      await textChannel.permissionOverwrites.create(userId, textPermissions);
    }
    
    if (voiceChannel) {
      await voiceChannel.permissionOverwrites.create(userId, voicePermissions);
    }
  } catch (error) {
    Logger.error('Error adding user to channels:', error);
    throw error;
  }
}

/**
 * Promote a substitute to a full participant
 * @param {Guild} guild - Discord guild
 * @param {Object} channels - Channel IDs object
 * @param {string} userId - User ID
 */
async function promoteSubstituteInChannels(guild, channels, userId) {
  try {
    const { textChannelId } = channels;
    
    // Only need to update text channel permissions
    const textChannel = guild.channels.cache.get(textChannelId);
    
    if (textChannel) {
      await textChannel.permissionOverwrites.create(userId, {
        SendMessages: true
      });
    }
  } catch (error) {
    Logger.error('Error promoting substitute in channels:', error);
    throw error;
  }
}

/**
 * Remove a user from channels
 * @param {Guild} guild - Discord guild
 * @param {Object} channels - Channel IDs object
 * @param {string} userId - User ID
 */
async function removeUserFromChannels(guild, channels, userId) {
  try {
    const { categoryId, textChannelId, voiceChannelId } = channels;
    
    // Remove permissions from all channels
    const category = guild.channels.cache.get(categoryId);
    const textChannel = guild.channels.cache.get(textChannelId);
    const voiceChannel = guild.channels.cache.get(voiceChannelId);
    
    if (category) {
      const permissions = category.permissionOverwrites.cache.get(userId);
      if (permissions) await permissions.delete();
    }
    
    if (textChannel) {
      const permissions = textChannel.permissionOverwrites.cache.get(userId);
      if (permissions) await permissions.delete();
    }
    
    if (voiceChannel) {
      const permissions = voiceChannel.permissionOverwrites.cache.get(userId);
      if (permissions) await permissions.delete();
    }
  } catch (error) {
    Logger.error('Error removing user from channels:', error);
    throw error;
  }
}

/**
 * Delete channels
 * @param {Guild} guild - Discord guild
 * @param {Object} channels - Channel IDs object
 * @param {string} reason - Reason for deletion
 */
async function deleteChannels(guild, channels, reason = 'LFG listing ended') {
  try {
    const { categoryId, textChannelId, voiceChannelId } = channels;
    
    // Delete channels in the correct order (text and voice first, then category)
    const textChannel = guild.channels.cache.get(textChannelId);
    const voiceChannel = guild.channels.cache.get(voiceChannelId);
    const category = guild.channels.cache.get(categoryId);
    
    // Delete text channel
    if (textChannel) {
      await textChannel.delete(reason).catch(error => {
        Logger.error(`Failed to delete text channel ${textChannelId}:`, error);
      });
    }
    
    // Delete voice channel
    if (voiceChannel) {
      await voiceChannel.delete(reason).catch(error => {
        Logger.error(`Failed to delete voice channel ${voiceChannelId}:`, error);
      });
    }
    
    // Delete category last
    if (category) {
      await category.delete(reason).catch(error => {
        Logger.error(`Failed to delete category ${categoryId}:`, error);
      });
    }
  } catch (error) {
    Logger.error('Error deleting channels:', error);
    throw error;
  }
}

/**
 * Get the LFG channel for the server
 * @param {Guild} guild - Discord guild
 * @param {TextChannel} fallbackChannel - Fallback channel
 * @returns {TextChannel} The LFG channel or fallback
 */
function getLfgChannel(guild, fallbackChannel = null) {
  // Try to use configured channel ID first
  if (config.LFG_CHANNEL_ID) {
    const configuredChannel = guild.channels.cache.get(config.LFG_CHANNEL_ID);
    if (configuredChannel) {
      return configuredChannel;
    }
  }
  
  // If fallback provided, use it
  if (fallbackChannel) {
    return fallbackChannel;
  }
  
  // Otherwise try to find a general channel
  return guild.channels.cache.find(channel => 
    channel.name.toLowerCase().includes('general') && 
    channel.type === ChannelType.GuildText
  );
}

module.exports = {
  createChannels,
  addUserToChannels,
  promoteSubstituteInChannels,
  removeUserFromChannels,
  deleteChannels,
  getLfgChannel
};