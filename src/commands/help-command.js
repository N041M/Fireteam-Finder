/**
 * Handler for the /help command
 */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { LFG_TAGS } = require('../config/activities');
const { getTimeFormatHelp } = require('../utils/date-utils');

// Command definition
const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Display information about available LFG commands');

/**
 * Execute the /help command
 * @param {CommandInteraction} interaction - Discord interaction
 */
async function execute(interaction) {
  try {
    // Create a help embed
    const embed = new EmbedBuilder()
      .setTitle('Destiny 2 LFG Bot - Commands')
      .setDescription('Here are the available commands for managing LFG activities:')
      .setColor('#0099ff')
      .addFields(
        { 
          name: '/lfg', 
          value: 'Create a new Looking For Group listing through an interactive menu.',
          inline: false 
        },
        { 
          name: '/listings', 
          value: 'View all active LFG listings.',
          inline: false
        },
        { 
          name: '/cancel <listing_id>', 
          value: 'Cancel one of your LFG listings and clean up all associated channels and roles.',
          inline: false 
        },
        { 
          name: '/extend <listing_id> <hours> [indefinite]', 
          value: 'Extend the time of your LFG listing by a specified number of hours or make it indefinite.',
          inline: false 
        },
        { 
          name: '/addplayer <listing_id> <player>', 
          value: 'Add a player to your fireteam without them needing to interact with the bot.',
          inline: false 
        },
        { 
          name: '/removeplayer <listing_id> <player>', 
          value: 'Remove a player from your fireteam or substitute list.',
          inline: false 
        },
        { 
          name: '/transferhost <listing_id> <new_host>', 
          value: 'Transfer host privileges to another player in your fireteam.',
          inline: false 
        },
        { 
          name: '/tag', 
          value: 'Manage tags for your LFG listings:\n' +
                 '• `/tag add <listing_id> <tag>` - Add a tag to your listing\n' +
                 '• `/tag remove <listing_id> <tag>` - Remove a tag from your listing\n' +
                 '• `/tag list` - View all available tags and their descriptions',
          inline: false 
        },
        { 
          name: '/help', 
          value: 'Display this help information.',
          inline: false 
        }
      )
      .addFields(
        {
          name: 'Interaction Buttons',
          value: 
            'Each LFG listing has interactive buttons that anyone can use:\n' +
            '• **Join Fireteam** - Join as a regular participant\n' +
            '• **Join as Substitute** - Join the substitute list for when spots open up\n' + 
            '• **Leave** - Leave the fireteam or substitute list\n' +
            '• **Info** - View detailed information about the listing',
          inline: false
        },
        {
          name: 'Host Controls',
          value: 
            'As a host, you have additional controls in your LFG text channel:\n' +
            '• **Extend Time** - Change when the LFG expires\n' +
            '• **Add Player** - Add a specific player to your fireteam\n' + 
            '• **Remove Player** - Remove someone from your fireteam\n' +
            '• **Transfer Host** - Give host privileges to another player\n' +
            '• **Cancel LFG** - End the LFG and clean up channels',
          inline: false
        },
        {
          name: 'Time Format Options',
          value: getTimeFormatHelp(),
          inline: false
        },
        {
          name: 'Available Tags',
          value: formatTagsList(),
          inline: false
        }
      )
      .setFooter({ text: 'Tip: You can manage players using the buttons in your LFG channel or with slash commands.' });
    
    // Send the embed
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error in help command:', error);
    await interaction.editReply({
      content: 'There was an error displaying the help information. Please try again.'
    });
  }
}

/**
 * Format the list of available tags for the help command
 * @returns {string} Formatted tags list
 */
function formatTagsList() {
  if (!LFG_TAGS || LFG_TAGS.length === 0) {
    return 'No tags available.';
  }

  // Group tags into pairs for a more compact display
  let result = '';
  for (let i = 0; i < LFG_TAGS.length; i += 2) {
    const tag1 = LFG_TAGS[i];
    const tag2 = i + 1 < LFG_TAGS.length ? LFG_TAGS[i + 1] : null;
    
    if (tag2) {
      result += `• **${tag1.label}** | **${tag2.label}**\n`;
    } else {
      result += `• **${tag1.label}**\n`;
    }
  }
  
  return result + '\n\nUse `/tag list` for detailed tag descriptions.';
}

module.exports = {
  data,
  execute
};