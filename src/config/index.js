// Configuration loading from environment variables
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const LFG_CHANNEL_ID = process.env.LFG_CHANNEL_ID;
const SHERPA_ROLE_ID = process.env.SHERPA_ROLE_ID;

// Load admin roles from environment (comma-separated list)
const ADMIN_ROLE_IDS = process.env.ADMIN_ROLE_IDS 
  ? process.env.ADMIN_ROLE_IDS.split(',').map(id => id.trim())
  : [];

// Validate required configuration
if (!TOKEN) {
  console.error('Missing TOKEN in environment variables');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('Missing CLIENT_ID in environment variables');
  process.exit(1);
}

module.exports = {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  LFG_CHANNEL_ID,
  SHERPA_ROLE_ID,
  ADMIN_ROLE_IDS,
  
  // Application constants - FIXED: More reasonable timing
  CLEANUP_INTERVAL: '*/30 * * * *', // Run cleanup every 30 minutes (much less aggressive)
  LISTING_LIFETIME_MS: 4 * 60 * 60 * 1000, // 4 hours after start time (reasonable duration)
  SESSION_TIMEOUT_MS: 10 * 60 * 1000 // 10 minutes for session timeout
};