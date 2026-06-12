const { REST, Routes } = require('discord.js');
const config = require('../config');
const lfgCommand = require('./lfg-command');
const listingsCommand = require('./listings-command');
const cancelCommand = require('./cancel-command');
const extendCommand = require('./extend-command');
const addPlayerCommand = require('./add-player-command');
const removePlayerCommand = require('./remove-player-command');
const transferHostCommand = require('./transfer-host-command');
const helpCommand = require('./help-command');
const addSpotCommand = require('./add-spot-command');
const removeSpotCommand = require('./remove-spot-command');
const tagCommand = require('./tag-command');
const Logger = require('../utils/logger');

// Collect all command definitions and convert to JSON format
const commands = [
  lfgCommand.data.toJSON(),
  listingsCommand.data.toJSON(),
  cancelCommand.data.toJSON(),
  extendCommand.data.toJSON(),
  addPlayerCommand.data.toJSON(),
  removePlayerCommand.data.toJSON(),
  transferHostCommand.data.toJSON(),
  addSpotCommand.data.toJSON(),
  removeSpotCommand.data.toJSON(),
  helpCommand.data.toJSON(),
  tagCommand.data.toJSON()
];

/**
 * Register commands with Discord API
 * @param {string} clientId - Application client ID
 * @param {string} guildId - Optional guild ID for development
 * @returns {Promise<void>}
 */
async function registerCommands(clientId, guildId) {
  const rest = new REST({ version: '10' }).setToken(config.TOKEN);
  
  try {
    Logger.info('Started refreshing application commands...');
    
    if (guildId) {
      // Register guild commands (faster updates, good for testing)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      Logger.info(`Successfully registered ${commands.length} commands for guild: ${guildId}`);
    } else {
      // Register global commands (up to 1 hour to update)
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      Logger.info(`Successfully registered ${commands.length} global commands`);
    }
  } catch (error) {
    Logger.error('Error registering commands:', error);
    throw error;
  }
}

/**
 * Handle command interactions
 * @param {Interaction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleCommand(interaction, client) {
  const { commandName } = interaction;
  
  try {
    switch (commandName) {
      case 'lfg':
        return await lfgCommand.execute(interaction, client);
      case 'listings':
        return await listingsCommand.execute(interaction, client);
      case 'cancel':
        return await cancelCommand.execute(interaction, client);
      case 'extend':
        return await extendCommand.execute(interaction, client);
      case 'addplayer':
        return await addPlayerCommand.execute(interaction, client);
      case 'removeplayer':
        return await removePlayerCommand.execute(interaction, client);
      case 'transferhost':
        return await transferHostCommand.execute(interaction, client);
      case 'addspot':
        return await addSpotCommand.execute(interaction, client);
      case 'removespot':
        return await removeSpotCommand.execute(interaction, client);
      case 'tag':
        return await tagCommand.execute(interaction, client);
      case 'help':
        return await helpCommand.execute(interaction, client);
      default:
        Logger.debug(`Unknown command: ${commandName}`);
        await interaction.reply({
          content: 'Unknown command.',
          ephemeral: true
        });
    }
  } catch (error) {
    Logger.error(`Error executing command ${commandName}:`, error);
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error executing this command. Please try again.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: 'There was an error executing this command. Please try again.'
        });
      } else {
        await interaction.followUp({
          content: 'There was an error executing this command. Please try again.',
          ephemeral: true
        });
      }
    } catch (followupError) {
      Logger.error('Error sending error message:', followupError);
    }
  }
}

module.exports = {
  registerCommands,
  handleCommand
};