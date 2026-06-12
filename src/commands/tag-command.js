/**
 * Handler for the /tag command to add or remove tags from an LFG listing
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const listingService = require('../services/listing-service');
const messageService = require('../services/message-service');
const { LFG_TAGS } = require('../config/activities');
const Logger = require('../utils/logger');

// Command definition
const data = new SlashCommandBuilder()
  .setName('tag')
  .setDescription('Add or remove tags from your LFG listing')
  .addSubcommand(subcommand => 
    subcommand
      .setName('add')
      .setDescription('Add tags to your LFG listing')
      .addStringOption(option => 
        option
          .setName('listing_id')
          .setDescription('The ID of the listing to tag')
          .setRequired(true)
      )
      .addStringOption(option => 
        option
          .setName('tag')
          .setDescription('The tag to add')
          .setRequired(true)
          .addChoices(
            ...LFG_TAGS.map(tag => ({ name: tag.label, value: tag.value }))
          )
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('remove')
      .setDescription('Remove tags from your LFG listing')
      .addStringOption(option => 
        option
          .setName('listing_id')
          .setDescription('The ID of the listing to modify')
          .setRequired(true)
      )
      .addStringOption(option => 
        option
          .setName('tag')
          .setDescription('The tag to remove')
          .setRequired(true)
          .addChoices(
            ...LFG_TAGS.map(tag => ({ name: tag.label, value: tag.value }))
          )
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('list')
      .setDescription('List all available tags and their descriptions')
  );

/**
 * Execute the /tag command
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function execute(interaction, client) {
  try {
    // No need to defer reply here as it's already deferred in the main handler
    
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'list') {
      return await listTags(interaction);
    }
    
    // For add and remove subcommands
    const listingId = interaction.options.getString('listing_id');
    const tagValue = interaction.options.getString('tag');
    
    // Get the listing
    const listing = listingService.getListing(listingId);
    if (!listing) {
      await interaction.editReply({
        content: `No listing found with ID ${listingId}. Please check the ID and try again.`
      });
      return;
    }
    
    // Check if the user is the host
    if (listing.hostId !== interaction.user.id) {
      await interaction.editReply({
        content: 'You can only modify tags for listings that you created.'
      });
      return;
    }
    
    // Get the tag details
    const tag = LFG_TAGS.find(t => t.value === tagValue);
    if (!tag) {
      await interaction.editReply({
        content: `Invalid tag: ${tagValue}. Use /tag list to see available tags.`
      });
      return;
    }
    
    if (subcommand === 'add') {
      return await addTag(interaction, listing, tag);
    } else if (subcommand === 'remove') {
      return await removeTag(interaction, listing, tag);
    }
    
  } catch (error) {
    Logger.error('Error in tag command:', error);
    await interaction.editReply({
      content: 'There was an error processing your request. Please try again.'
    });
  }
}

/**
 * List all available tags
 * @param {CommandInteraction} interaction - Discord interaction
 */
async function listTags(interaction) {
  try {
    const { EmbedBuilder } = require('discord.js');
    
    // Create an embed to display all tags
    const embed = new EmbedBuilder()
      .setTitle('Available LFG Tags')
      .setDescription('Here are all the tags you can add to your LFG listings:')
      .setColor('#0099ff');
    
    // Add each tag as a field
    LFG_TAGS.forEach(tag => {
      embed.addFields({
        name: tag.label,
        value: `**Command value:** \`${tag.value}\`\n${tag.description}`
      });
    });
    
    // Add usage examples
    embed.addFields({
      name: 'Usage Examples',
      value: 
        '`/tag add listing_id sherpa` - Add "Sherpa Run" tag\n' +
        '`/tag remove listing_id kwtd` - Remove "KWTD" tag\n' +
        '`When creating a new LFG, you can include tags in the form`'
    });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    Logger.error('Error listing tags:', error);
    await interaction.editReply({
      content: 'There was an error listing the tags. Please try again.'
    });
  }
}

/**
 * Add a tag to a listing
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {Object} tag - The tag to add
 */
async function addTag(interaction, listing, tag) {
  try {
    // Check if tag is already present
    if (listing.tags.includes(tag.value)) {
      await interaction.editReply({
        content: `The listing already has the "${tag.label}" tag.`
      });
      return;
    }
    
    // Add the tag
    listing.tags.push(tag.value);
    
    // Update all messages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
    // Send a notification in the activity's text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (textChannel) {
      await textChannel.send(`${interaction.user} added the "${tag.label}" tag to this LFG.`);
    }
    
    await interaction.editReply({
      content: `Successfully added the "${tag.label}" tag to your LFG for ${listing.activityName}.`
    });
    
  } catch (error) {
    Logger.error('Error adding tag:', error);
    await interaction.editReply({
      content: 'There was an error adding the tag. Please try again.'
    });
  }
}

/**
 * Remove a tag from a listing
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {Listing} listing - The listing
 * @param {Object} tag - The tag to remove
 */
async function removeTag(interaction, listing, tag) {
  try {
    // Check if tag is present
    if (!listing.tags.includes(tag.value)) {
      await interaction.editReply({
        content: `The listing doesn't have the "${tag.label}" tag.`
      });
      return;
    }
    
    // Remove the tag
    listing.tags = listing.tags.filter(t => t !== tag.value);
    
    // Update all messages
    await messageService.updateAllListingMessages(listing, interaction.guild);
    
    // Send a notification in the activity's text channel
    const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
    if (textChannel) {
      await textChannel.send(`${interaction.user} removed the "${tag.label}" tag from this LFG.`);
    }
    
    await interaction.editReply({
      content: `Successfully removed the "${tag.label}" tag from your LFG for ${listing.activityName}.`
    });
    
  } catch (error) {
    Logger.error('Error removing tag:', error);
    await interaction.editReply({
      content: 'There was an error removing the tag. Please try again.'
    });
  }
}

module.exports = {
  data,
  execute
};