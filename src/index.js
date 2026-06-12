// Main entry point for the Destiny 2 LFG Discord Bot
const { Client, GatewayIntentBits, Events, ActivityType } = require('discord.js');
require('dotenv').config();

// Initialize logger configuration first to ensure all logs are captured
const { configureInteractionLogger } = require('./config/logger-config');
const interactionLogger = configureInteractionLogger();

// Import core modules
const { registerCommands } = require('./commands');
const { setupInteractionHandlers } = require('./interactions');
const Logger = require('./utils/logger');
const config = require('./config');
const cleanupService = require('./services/cleanup-service');
const listingService = require('./services/listing-service');

// Create client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Error handling
process.on('unhandledRejection', error => {
  Logger.error('Unhandled promise rejection:', error);
  interactionLogger.error('system', 'Unhandled promise rejection', error);
});

client.on(Events.Error, error => {
  Logger.error('Client error:', error);
  interactionLogger.error('system', 'Discord client error', error);
});

// Update bot's activity with current LFG stats
function updateBotActivity(client, isHelpMode = false) {
  try {
    if (isHelpMode) {
      // Set help mode activity
      client.user.setActivity({
        name: '/help',
        type: ActivityType.Custom
      });
      Logger.debug('Switched to help mode activity');
    } else {
      // Set dynamic LFG stats activity
      const listings = listingService.getAllListings();
      const activitiesCount = listings.length;
      
      // Count unique participants (guardians) across all listings
      const uniqueParticipants = new Set();
      listings.forEach(listing => {
        listing.participants.forEach(participantId => {
          uniqueParticipants.add(participantId);
        });
        // Also count substitutes as participating guardians
        listing.substitutes.forEach(substituteId => {
          uniqueParticipants.add(substituteId);
        });
      });
      const uniqueGuardiansCount = uniqueParticipants.size;

      client.user.setActivity({
        name: `${activitiesCount} LFG • ${uniqueGuardiansCount} Guardians`,
        type: ActivityType.Custom
      });
      Logger.debug(`Updated bot activity: ${activitiesCount} active LFGs, ${uniqueGuardiansCount} unique guardians`);
    }
  } catch (error) {
    Logger.error('Error updating bot activity:', error);
    interactionLogger.error('system', 'Error updating bot activity', error);
  }
}

// Ready event
client.once(Events.ClientReady, async () => {
  Logger.info(`Ready! Logged in as ${client.user.tag}`);
  interactionLogger.interaction('system', 'bot startup', `Bot initialized as ${client.user.tag}`);
  
  // Register commands
  try {
    await registerCommands(config.CLIENT_ID, config.GUILD_ID);
    Logger.info('Slash commands registered');
    interactionLogger.interaction('system', 'commands registered', 
      `Registered slash commands to client ID ${config.CLIENT_ID}${config.GUILD_ID ? ` in guild ${config.GUILD_ID}` : ' globally'}`
    );
  } catch (error) {
    Logger.error('Error registering commands:', error);
    interactionLogger.error('system', 'Failed to register commands', error);
  }
  
  // Start cleanup task for expired listings
  cleanupService.startCleanupTask(client);
  interactionLogger.interaction('system', 'cleanup initialized', 
    `Started cleanup task with interval: ${config.CLEANUP_INTERVAL}, listing lifetime: ${config.LISTING_LIFETIME_MS}ms`
  );

  // Track the current activity mode
  let isHelpMode = true;

  // Set initial activity
  updateBotActivity(client, isHelpMode);

  // Alternate between help and dynamic stats every 30 seconds
  setInterval(() => {
    isHelpMode = !isHelpMode;
    updateBotActivity(client, isHelpMode);
  }, 30 * 1000);
});

// Log guild events for better tracking
client.on(Events.GuildCreate, guild => {
  Logger.info(`Bot added to new guild: ${guild.name} (${guild.id})`);
  interactionLogger.interaction('system', 'guild added', 
    `Bot was added to guild ${guild.name}`,
    { guildId: guild.id, memberCount: guild.memberCount }
  );
});

client.on(Events.GuildDelete, guild => {
  Logger.info(`Bot removed from guild: ${guild.name} (${guild.id})`);
  interactionLogger.interaction('system', 'guild removed', 
    `Bot was removed from guild ${guild.name}`, 
    { guildId: guild.id }
  );
});

// Set up interaction handlers
setupInteractionHandlers(client);

// Process shutdown handling
process.on('SIGINT', async () => {
  Logger.info('Received SIGINT signal, shutting down...');
  interactionLogger.interaction('system', 'shutdown', 'Bot shutting down gracefully on SIGINT');
  
  try {
    await client.destroy();
    Logger.info('Disconnected from Discord');
    process.exit(0);
  } catch (error) {
    Logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  Logger.info('Received SIGTERM signal, shutting down...');
  interactionLogger.interaction('system', 'shutdown', 'Bot shutting down gracefully on SIGTERM');
  
  try {
    await client.destroy();
    Logger.info('Disconnected from Discord');
    process.exit(0);
  } catch (error) {
    Logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Login
client.login(config.TOKEN)
  .catch(error => {
    Logger.error('Failed to login:', error);
    interactionLogger.error('system', 'login failed', error);
    process.exit(1);
  });