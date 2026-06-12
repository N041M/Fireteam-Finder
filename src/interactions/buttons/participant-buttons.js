/**
 * Button handlers for participant actions (join, substitute, leave)
 */
const listingService = require('../../services/listing-service');
const channelService = require('../../services/channel-service');
const notificationService = require('../../services/notification-service');
const messageService = require('../../services/message-service');
const Logger = require('../../utils/logger');

/**
 * Handle participant buttons
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {string} action - Button action (join, sub, leave)
 * @param {string} listingId - Listing ID
 * @param {Client} client - Discord client
 */
async function handleButton(interaction, action, listingId, client) {
  switch (action) {
    case 'join':
      return await handleJoinButton(interaction, listingId, client);
    case 'sub':
      return await handleSubButton(interaction, listingId, client);
    case 'leave':
      return await handleLeaveButton(interaction, listingId, client);
  }
}

/**
 * Handle the join button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {string} listingId - Listing ID
 * @param {Client} client - Discord client
 */
async function handleJoinButton(interaction, listingId, client) {
  try {
    // Get the listing
    const listing = listingService.getListing(listingId);
    
    if (!listing) {
      await interaction.editReply({
        content: 'This listing no longer exists or has expired.'
      });
      return;
    }
    
    // Check if user is already a participant
    if (listing.hasParticipant(interaction.user.id)) {
      await interaction.editReply({
        content: 'You are already part of this fireteam.'
      });
      return;
    }
    
    // Check if fireteam is full
    if (listing.isFull()) {
      await interaction.editReply({
        content: `The fireteam for ${listing.activityName} is already full. You can join as a substitute instead.`
      });
      return;
    }
    
    // Check if user is already a substitute and promote them
    if (listing.hasSubstitute(interaction.user.id)) {
      // Promote from substitute to participant
      listing.promoteSubstitute(interaction.user.id);
      
      // Update channel permissions
      await channelService.promoteSubstituteInChannels(
        interaction.guild,
        {
          categoryId: listing.categoryId,
          textChannelId: listing.textChannelId,
          voiceChannelId: listing.voiceChannelId
        },
        interaction.user.id
      );
      
      // Send notification in the text channel
      const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
      if (textChannel) {
        await textChannel.send(`${interaction.user} has been promoted from substitute to full fireteam member!`);
      }
      
      // Update all messages
      await messageService.updateAllListingMessages(listing, interaction.guild);
      
      await interaction.editReply({
        content: `You have been promoted from substitute to the fireteam for ${listing.activityName}! Check out <#${listing.textChannelId}> to participate.`
      });
      return;
    }
    
    // Add to fireteam
    listing.addParticipant(interaction.user.id);
    
    // Add the role to the user if it exists
    if (listing.roleId) {
      const role = interaction.guild.roles.cache.get(listing.roleId);
      if (role) {
        await interaction.member.roles.add(role).catch(err => {
          Logger.error(`Could not add role to user:`, err);
        });
      }
    }
    
    // Add channel permissions
    await channelService.addUserToChannels(
      interaction.guild,
      {
        categoryId: listing.categoryId,
        textChannelId: listing.textChannelId,
        voiceChannelId: listing.voiceChannelId
      },
      interaction.user.id,
      false // Not a substitute
    );
    
    // Send notification in the text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (textChannel) {
      await textChannel.send(`${interaction.user} has joined the fireteam!`);
    }
    
    // Update all messages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
    await interaction.editReply({
      content: `You have joined the fireteam for ${listing.activityName}! Check out <#${listing.textChannelId}> to participate.`
    });
    
  } catch (error) {
    Logger.error('Error handling join button:', error);
    await interaction.editReply({
      content: 'There was an error joining the fireteam. Please try again.'
    });
  }
}

/**
 * Handle the substitute button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {string} listingId - Listing ID
 * @param {Client} client - Discord client
 */
async function handleSubButton(interaction, listingId, client) {
  try {
    // Get the listing
    const listing = listingService.getListing(listingId);
    
    if (!listing) {
      await interaction.editReply({
        content: 'This listing no longer exists or has expired.'
      });
      return;
    }
    
    // Check if user is already a participant
    if (listing.hasParticipant(interaction.user.id)) {
      await interaction.editReply({
        content: 'You are already part of this fireteam. If you want to become a substitute, leave the fireteam first.'
      });
      return;
    }
    
    // Check if user is already a substitute
    if (listing.hasSubstitute(interaction.user.id)) {
      await interaction.editReply({
        content: 'You are already on the substitute list for this activity.'
      });
      return;
    }
    
    // Add to substitutes
    listing.addSubstitute(interaction.user.id);
    
    // Add the role to the user if it exists
    if (listing.roleId) {
      const role = interaction.guild.roles.cache.get(listing.roleId);
      if (role) {
        await interaction.member.roles.add(role).catch(err => {
          Logger.error(`Could not add role to user:`, err);
        });
      }
    }
    
    // Add channel permissions
    await channelService.addUserToChannels(
      interaction.guild,
      {
        categoryId: listing.categoryId,
        textChannelId: listing.textChannelId,
        voiceChannelId: listing.voiceChannelId
      },
      interaction.user.id,
      true // Is a substitute
    );
    
    // Send notification in the text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (textChannel) {
      await textChannel.send(`${interaction.user} has joined as a substitute!`);
    }
    
    // Update all messages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
    await interaction.editReply({
      content: `You have joined as a substitute for ${listing.activityName}! You'll be notified if a spot opens up. Check out <#${listing.textChannelId}> to follow along (you can read but not send messages).`
    });
    
  } catch (error) {
    Logger.error('Error handling substitute button:', error);
    await interaction.editReply({
      content: 'There was an error joining as a substitute. Please try again.'
    });
  }
}

/**
 * Handle the leave button
 * @param {ButtonInteraction} interaction - Discord interaction
 * @param {string} listingId - Listing ID
 * @param {Client} client - Discord client
 */
async function handleLeaveButton(interaction, listingId, client) {
  try {
    // Get the listing
    const listing = listingService.getListing(listingId);
    
    if (!listing) {
      await interaction.editReply({
        content: 'This listing no longer exists or has expired.'
      });
      return;
    }
    
    // Check if user is the host
    if (interaction.user.id === listing.hostId) {
      await interaction.editReply({
        content: "As the host, you can't leave your own LFG. Use the Cancel button in the LFG channel or the `/cancel` command if you want to cancel this activity."
      });
      return;
    }
    
    // Check if user is in the fireteam or is a substitute
    const isParticipant = listing.hasParticipant(interaction.user.id);
    const isSubstitute = listing.hasSubstitute(interaction.user.id);
    
    if (!isParticipant && !isSubstitute) {
      await interaction.editReply({
        content: "You're not part of this LFG."
      });
      return;
    }
    
    // Remove from the appropriate list
    if (isParticipant) {
      listing.removeParticipant(interaction.user.id);
    } else {
      listing.removeSubstitute(interaction.user.id);
    }
    
    // Remove the role if it exists
    if (listing.roleId) {
      const role = interaction.guild.roles.cache.get(listing.roleId);
      if (role && interaction.member) {
        await interaction.member.roles.remove(role).catch(err => {
          Logger.error(`Could not remove role from user:`, err);
        });
      }
    }
    
    // Remove channel permissions
    await channelService.removeUserFromChannels(
      interaction.guild,
      {
        categoryId: listing.categoryId,
        textChannelId: listing.textChannelId,
        voiceChannelId: listing.voiceChannelId
      },
      interaction.user.id
    );
    
    // Update all messages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
    // Send notification in the text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (textChannel) {
      await textChannel.send(`${interaction.user} has left the ${isParticipant ? 'fireteam' : 'substitute list'}.`);
    }
    
    await interaction.editReply({
      content: `You have left the ${isParticipant ? 'fireteam' : 'substitute list'} for ${listing.activityName}.`
    });
    
    // If a participant left, notify substitutes about the open spot
    if (isParticipant && listing.substitutes.length > 0 && !listing.isFull()) {
      await notificationService.notifySubstitutesOfOpenSpot(listing, client);
    }
    
  } catch (error) {
    Logger.error('Error handling leave button:', error);
    await interaction.editReply({
      content: 'There was an error leaving the LFG. Please try again.'
    });
  }
}

module.exports = {
  handleButton
};