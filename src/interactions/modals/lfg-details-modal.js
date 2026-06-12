/**
 * Handler for LFG details modal submissions - PROTECTED VERSION
 */
const { sessionService, LfgState } = require('../../services/session-service');
const listingService = require('../../services/listing-service');
const channelService = require('../../services/channel-service');
const messageService = require('../../services/message-service');
const cleanupService = require('../../services/cleanup-service');
const embedBuilder = require('../../utils/embed-builder');
const { formatActivityWithDifficulty } = require('../../config/activities');
const { parseUserDate } = require('../../utils/date-utils');
const uiBuilder = require('../../utils/ui-builder');
const config = require('../../config');
const Logger = require('../../utils/logger');

/**
 * Handle LFG details modal submission
 * @param {ModalSubmitInteraction} interaction - Modal interaction
 */
async function handleModalSubmit(interaction) {
  try {
    // Get user session
    const userId = interaction.user.id;
    const session = sessionService.getSession(userId);
    
    if (!session) {
      await interaction.reply({
        content: 'Your session has expired. Please use the /lfg command again.',
        flags: ['Ephemeral']
      });
      return;
    }
    
    // Get form values
    const startTimeStr = interaction.fields.getTextInputValue('start_time');
    const description = interaction.fields.getTextInputValue('description');
    const fireteamSizeStr = interaction.fields.getTextInputValue('fireteam_size');
    
    // Process tags input (if provided)
    let tags = [];
    try {
      if (interaction.fields.getTextInputValue('lfg_tags')) {
        const tagsInput = interaction.fields.getTextInputValue('lfg_tags');
        if (tagsInput && tagsInput.trim()) {
          // Split by comma and trim whitespace
          tags = tagsInput.split(',').map(tag => tag.trim().toLowerCase());
          
          // Validate tags against known tags
          const validTags = [];
          const { LFG_TAGS } = require('../../config/activities');
          const validTagValues = LFG_TAGS.map(tag => tag.value);
          
          for (const tag of tags) {
            if (validTagValues.includes(tag)) {
              validTags.push(tag);
            }
          }
          
          tags = validTags;
        }
      }
    } catch (error) {
      Logger.error('Error processing tags input:', error);
      // Continue without tags if there's an error
      tags = [];
    }
    
    // Get custom name if provided (for "other" activities)
    if (session.data.isCustomActivity) {
      const customName = interaction.fields.getTextInputValue('custom_name');
      if (!customName || customName.trim() === '') {
        await interaction.reply({
          content: 'You must provide a custom activity name.',
          flags: ['Ephemeral']
        });
        return;
      }
      
      // Update the activity name in the session with the custom name
      session.updateData({ activityName: customName });
    }
    
    // Validate inputs
    let startTime, isIndefinite, fireteamSize;
    
    try {
      // Parse start time
      const timeResult = parseUserDate(startTimeStr);
      startTime = timeResult.date;
      isIndefinite = timeResult.isIndefinite;
      
      // Parse fireteam size
      fireteamSize = parseInt(fireteamSizeStr, 10);
      if (isNaN(fireteamSize) || fireteamSize < 2 || fireteamSize > 12) {
        throw new Error('Fireteam size must be between 2 and 12 players.');
      }
    } catch (error) {
      await interaction.reply({
        content: `Invalid input: ${error.message}`,
        flags: ['Ephemeral']
      });
      return;
    }
    
    // Update session with form data
    session.updateData({
      startTime,
      description,
      fireteamSize,
      isIndefinite,
      tags
    });
    
    // Set state to creating
    session.setState(LfgState.CREATING);
    
    // Reply to acknowledge the submission
    await interaction.reply({
      content: `Creating your LFG listing for ${session.data.activityName}...`,
      flags: ['Ephemeral']
    });
    
    // Create the listing
    try {
      const result = await createLfgListing(interaction, session);
      
      if (result.success) {
        // Update reply with success message
        await interaction.editReply({
          content: `Your LFG for ${session.data.activityName} has been created! Check out <#${result.textChannelId}> to get started. Your listing ID is: ${result.listingId}`
        });
        
        // Clean up the session
        sessionService.removeSession(userId);
      } else {
        // Handle creation failure
        await interaction.editReply({
          content: `There was an error creating your LFG listing: ${result.error}. Please try again.`
        });
      }
      
    } catch (error) {
      Logger.error('Error creating LFG listing:', error);
      await interaction.editReply({
        content: 'There was an error creating your LFG listing. Please try again.'
      });
    }
    
  } catch (error) {
    Logger.error('Error handling LFG details form:', error);
    
    if (!interaction.replied) {
      await interaction.reply({
        content: 'There was an error creating your LFG listing. Please try again.',
        flags: ['Ephemeral']
      });
    } else {
      await interaction.editReply({
        content: 'There was an error creating your LFG listing. Please try again.'
      });
    }
  }
}

/**
 * Validate that a channel still exists and is accessible
 * @param {Guild} guild - Discord guild
 * @param {string} channelId - Channel ID to validate
 * @returns {Promise<TextChannel|null>} Channel if valid, null otherwise
 */
async function validateChannel(guild, channelId) {
  try {
    // First check cache
    let channel = guild.channels.cache.get(channelId);
    if (channel) {
      return channel;
    }
    
    // If not in cache, try to fetch
    channel = await guild.channels.fetch(channelId);
    return channel;
  } catch (error) {
    Logger.debug(`Channel ${channelId} validation failed:`, error.message);
    return null;
  }
}

/**
 * Create an LFG listing from session data - PROTECTED VERSION
 * @param {ModalSubmitInteraction} interaction - Modal interaction
 * @param {Session} session - User session
 * @returns {Promise<Object>} Result with success status and details
 */
async function createLfgListing(interaction, session) {
  const { 
    activityValue, 
    activityName, 
    difficultyValue, 
    startTime, 
    description, 
    fireteamSize, 
    isIndefinite,
    tags
  } = session.data;
  
  const guild = interaction.guild;
  
  // Format the activity name with difficulty if applicable
  const formattedName = difficultyValue ? 
    formatActivityWithDifficulty(activityName, difficultyValue) : 
    activityName;
  
  // Generate a listing ID that encodes the actual start time and lifetime
  const listingId = listingService.generateId(startTime, config.LISTING_LIFETIME_MS, false, isIndefinite);
  
  // PROTECTION: Mark this operation as ongoing to prevent cleanup interference
  cleanupService.markOperationStart(listingId);
  
  let role, channels;
  
  try {
    Logger.debug(`Starting LFG creation for listing ${listingId}`);
    
    // Create role for the LFG
    role = await guild.roles.create({
      name: `LFG-${formattedName}-${listingId}`,
      color: 0x0099FF,
      reason: 'LFG Bot - New activity listing'
    });
    
    Logger.debug(`Created role ${role.id} for listing ${listingId}`);
    
    // Assign the role to the creator
    await interaction.member.roles.add(role).catch(err => {
      Logger.error(`Could not add role to creator:`, err);
    });
    
    // Create channels
    channels = await channelService.createChannels(
      guild,
      formattedName,
      activityValue,
      listingId,
      role.id,
      fireteamSize
    );
    
    Logger.debug(`Created channels for listing ${listingId}: text=${channels.textChannelId}, voice=${channels.voiceChannelId}, category=${channels.categoryId}`);
    
    // Validate channels were created successfully
    const textChannel = await validateChannel(guild, channels.textChannelId);
    if (!textChannel) {
      throw new Error('Text channel creation failed or channel was immediately deleted');
    }
    
    // Add the host to channels with host permissions
    await channelService.addUserToChannels(
      guild,
      channels,
      interaction.user.id,
      false, // Not a substitute
      true   // Is the host
    );
    
    // Create the listing in the service FIRST (before sending messages)
    const listing = listingService.createListing({
      id: listingId,
      guildId: guild.id,
      hostId: interaction.user.id,
      activityValue,
      activityName: formattedName,
      difficultyValue,
      startTime: startTime.toISOString(),
      indefinite: isIndefinite,
      description,
      fireteamSize,
      textChannelId: channels.textChannelId,
      voiceChannelId: channels.voiceChannelId,
      categoryId: channels.categoryId,
      roleId: role.id,
      participants: [interaction.user.id],
      tags: tags || []
    });
    
    Logger.debug(`Created listing record for ${listingId}`);
    
    // STEP 1: Send welcome message with validation
    const welcomeEmbed = embedBuilder.createWelcomeEmbed(listing);
    
    // Double-check channel still exists
    const validTextChannel = await validateChannel(guild, channels.textChannelId);
    if (!validTextChannel) {
      throw new Error('Text channel was deleted before welcome message could be sent');
    }
    
    const welcomeMessage = await validTextChannel.send({
      content: `<@&${role.id}> Welcome to the LFG channel! <@${interaction.user.id}> will be hosting this activity.`,
      embeds: [welcomeEmbed]
    });
    
    Logger.debug(`Sent welcome message for listing ${listingId}`);
    
    // STEP 2: Send host controls with validation
    const hostControlsRows = uiBuilder.createHostControls(listingId);
    
    // Validate channel AGAIN before sending host controls
    const stillValidChannel = await validateChannel(guild, channels.textChannelId);
    if (!stillValidChannel) {
      Logger.error(`Text channel ${channels.textChannelId} was deleted between welcome message and host controls`);
      throw new Error('Text channel was deleted during LFG creation');
    }
    
    const controlsMessage = await stillValidChannel.send({
      content: `**HOST CONTROLS** - Only <@${interaction.user.id}> can use these buttons:`,
      components: hostControlsRows
    });
    
    Logger.debug(`Sent host controls message for listing ${listingId}`);
    
    // STEP 3: Pin messages with robust error handling
    try {
      await welcomeMessage.pin();
      Logger.debug(`Pinned welcome message for listing ${listingId}`);
      
      await controlsMessage.pin();
      Logger.debug(`Pinned host controls message for listing ${listingId}`);
    } catch (error) {
      Logger.error(`Error pinning messages for listing ${listingId} (non-critical): ${error.message}`);
      // Continue even if pinning fails
    }
    
    // STEP 4: Create the listing post in the designated LFG channel
    const lfgChannel = channelService.getLfgChannel(guild);
    if (lfgChannel) {
      try {
        const listingEmbed = embedBuilder.createListingEmbed(listing);
        const participantControlsRow = uiBuilder.createParticipantControls(listingId);
        
        const listingMessage = await lfgChannel.send({
          embeds: [listingEmbed],
          components: [participantControlsRow]
        });
        
        // Update the listing with the message ID
        listing.messageId = listingMessage.id;
        Logger.debug(`Created main listing message for ${listingId} with ID ${listingMessage.id}`);
      } catch (error) {
        Logger.error(`Error creating main listing message for ${listingId}:`, error);
        // Don't fail the entire creation for this
      }
    }
    
    Logger.info(`Successfully created LFG listing ${listingId}`);
    
    return {
      success: true,
      listingId,
      textChannelId: channels.textChannelId
    };
    
  } catch (error) {
    Logger.error(`Error creating LFG listing ${listingId}:`, error);
    
    // Clean up on failure
    try {
      // Remove listing if it was created
      if (listingId) {
        listingService.removeListing(listingId);
      }
      
      // Delete channels if they were created
      if (channels) {
        await channelService.deleteChannels(guild, channels, 'LFG creation failed');
      }
      
      // Delete role if it was created
      if (role) {
        await role.delete('LFG creation failed');
      }
    } catch (cleanupError) {
      Logger.error('Error during cleanup after failed LFG creation:', cleanupError);
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error during LFG creation'
    };
  } finally {
    // PROTECTION: Always mark operation as complete
    cleanupService.markOperationComplete(listingId);
    Logger.debug(`Marked LFG creation operation complete for listing ${listingId}`);
  }
}

module.exports = {
  handleModalSubmit
};