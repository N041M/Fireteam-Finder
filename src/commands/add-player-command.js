/**
 * Handler for the /addplayer command to add a player to a listing
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const listingService = require('../services/listing-service');
const channelService = require('../services/channel-service');
const messageService = require('../services/message-service');
const { canManageListing, logAdminAction } = require('../utils/permission-utils');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('addplayer')
  .setDescription('Add a player to an LFG listing without them needing to interact')
  .addStringOption(option => 
    option
      .setName('listing_id')
      .setDescription('The ID of the listing to add player to')
      .setRequired(true)
  )
  .addUserOption(option => 
    option
      .setName('player')
      .setDescription('The player to add to the fireteam')
      .setRequired(true)
  );

/**
 * Execute the /addplayer command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // Get command options
    const listingId = interaction.options.getString('listing_id');
    const targetUser = interaction.options.getUser('player');
    const targetMember = interaction.options.getMember('player');
    
    Logger.debug(`Processing add player command for listing: ${listingId}, player: ${targetUser.id}`);
    
    // Get the listing
    const listing = listingService.getListing(listingId);
    if (!listing) {
      await interaction.editReply({
        content: `No listing found with ID ${listingId}. Please check the ID and try again.`
      });
      return;
    }
    
    // Check if the user has permission to modify this listing
    const member = interaction.member;
    const isAdmin = member.id !== listing.hostId && canManageListing(member, listing);
    const hasPermission = member.id === listing.hostId || isAdmin;
    
    if (!hasPermission) {
      await interaction.editReply({
        content: 'You don\'t have permission to add players to this listing. Only the host or moderators can add players.'
      });
      return;
    }
    
    // Log if this is an admin override action
    if (isAdmin) {
      logAdminAction(
        member, 
        'ADD_PLAYER', 
        listing, 
        `Admin added player ${targetUser.tag} (${targetUser.id}) to listing`
      );
    }
    
    // Check if the player is already a participant
    if (listing.hasParticipant(targetUser.id)) {
      await interaction.editReply({
        content: `${targetUser} is already part of the fireteam.`
      });
      return;
    }
    
    // Check if the fireteam is already full, but provide a warning instead of blocking
    if (listing.isFull()) {
      // Still proceed, but warn the user
      await interaction.editReply({
        content: `Warning: The fireteam for ${listing.activityName} is already at the limit of ${listing.fireteamSize} players. Adding this player will exceed the specified limit.`
      });
      
      // Wait 2 seconds to allow the user to see the warning
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Follow up to show we're proceeding
      await interaction.followUp({
        content: `Proceeding to add ${targetUser} to the fireteam...`,
        ephemeral: true
      });
    }
    
    // Check if the player is a substitute
    if (listing.hasSubstitute(targetUser.id)) {
      // Promote from substitute to participant (using host override)
      listing.promoteSubstitute(targetUser.id, true); // Use hostOverride=true
      
      // Update permissions to allow sending messages
      await channelService.promoteSubstituteInChannels(
        interaction.guild,
        {
          categoryId: listing.categoryId,
          textChannelId: listing.textChannelId,
          voiceChannelId: listing.voiceChannelId
        },
        targetUser.id
      );
      
      // Update all messages
      await messageService.updateAllListingMessages(listing, interaction.guild);
      
      // Send a message in the activity's text channel
      const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
      if (textChannel) {
        const actionMessage = isAdmin 
          ? `${targetUser} has been promoted from substitute to full fireteam member by moderator ${interaction.user}!`
          : `${targetUser} has been promoted from substitute to full fireteam member by ${interaction.user}!`;
        
        await textChannel.send(actionMessage);
      }
      
      await interaction.editReply({
        content: `${targetUser} has been promoted from substitute to the fireteam for ${listing.activityName}!`
      });
      
      // Notify the host if admin action
      if (isAdmin) {
        notifyHost(client, listing, `Player ${targetUser.tag} was promoted from substitute to full fireteam member in your LFG for ${listing.activityName} by a server moderator.`);
      }
      
      return;
    }
    
    // Add the player to the listing with host override
    listing.addParticipant(targetUser.id, true);
    
    // Add the role to the player if it exists
    if (listing.roleId && targetMember) {
      const role = interaction.guild.roles.cache.get(listing.roleId);
      if (role) {
        await targetMember.roles.add(role).catch(err => {
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
      targetUser.id,
      false, // Not a substitute
      targetUser.id === listing.hostId // Is host check
    );
    
    // Update all messages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
    // Send a message in the activity's text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (textChannel) {
      const actionMessage = isAdmin 
        ? `${targetUser} has been added to the fireteam by moderator ${interaction.user}!`
        : `${targetUser} has been added to the fireteam by ${interaction.user}!`;
      
      await textChannel.send(actionMessage);
    }
    
    await interaction.editReply({
      content: `Successfully added ${targetUser} to the fireteam for ${listing.activityName}!`
    });
    
    // Notify the host if admin action
    if (isAdmin) {
      notifyHost(client, listing, `Player ${targetUser.tag} was added to your LFG for ${listing.activityName} by a server moderator.`);
    }
    
  } catch (error) {
    Logger.error('Error in add player command:', error);
    await interaction.editReply({
      content: 'There was an error adding the player to the fireteam. Please try again.'
    });
  }
}

/**
 * Notify the host of admin actions
 * @param {Client} client - Discord client
 * @param {Listing} listing - The listing
 * @param {string} message - Message to send
 */
async function notifyHost(client, listing, message) {
  try {
    const hostUser = await client.users.fetch(listing.hostId);
    if (hostUser) {
      await hostUser.send({
        content: message
      }).catch(err => {
        // Don't worry if we can't DM them
        Logger.debug(`Could not DM host: ${err.message}`);
      });
    }
  } catch (error) {
    Logger.error(`Error notifying host:`, error);
  }
}

module.exports = {
  data,
  execute
};