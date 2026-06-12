# Destiny 2 LFG Bot - Technical Documentation

## Overview

The Destiny 2 LFG Bot is a Discord bot for creating and managing Looking For Group (LFG) activities for Destiny 2 players. Built on Discord.js v14, it uses an event-driven architecture with service layer patterns for state management. The bot handles multi-step user workflows through interactive components (buttons, select menus, modals) while maintaining session state across interactions. It manages Discord resources including channel creation/deletion, role assignment, and permission handling. The system includes a substitute queue with DM notifications, time-based cleanup services, and admin override capabilities. All operations are logged for audit purposes. The bot handles edge cases like missing resources or permission conflicts.

## Technical Summary & Glossary

### Architecture Components

- **Service Layer**: Singleton services (`ListingService`, `SessionService`, etc.) that manage application state and business logic
- **Event Router**: Central handler (`interactions/index.js`) that routes Discord events to appropriate handlers
- **State Machine**: Session-based state tracking for multi-step workflows (e.g., LFG creation)
- **Cleanup Service**: Cron-based service that removes expired listings and associated Discord resources

### Key Terms

- **Listing**: Core data model representing an LFG activity with participants, channels, and metadata
- **Session**: Temporary state container for tracking user progress through multi-step interactions
- **Substitute Queue**: FIFO queue of users waiting for spots to open in a full fireteam
- **Host Override**: Permission flag allowing hosts to bypass normal constraints (e.g., fireteam size limits)
- **Defer Strategy**: Discord.js pattern for acknowledging interactions before processing
- **Ephemeral**: Discord message visibility flag - only visible to the interaction user

### Data Structures

- **Map Storage**: In-memory key-value storage using JavaScript Map for O(1) lookups
- **Participant Arrays**: Ordered lists maintaining fireteam members and substitutes
- **Permission Overwrites**: Discord channel-specific permission configurations
- **Custom IDs**: String identifiers for Discord components following pattern: `action_listingId`

### Discord.js Concepts

- **Intents**: Gateway permissions defining what events the bot receives
- **Interactions**: User-initiated events (commands, buttons, modals, select menus)
- **Components**: Interactive UI elements (ActionRow, Button, SelectMenu, Modal)
- **Embeds**: Rich message formatting objects with fields, colors, and metadata
- **Cache**: In-memory storage of Discord objects to minimize API calls

### Design Patterns

- **Singleton Pattern**: Single instance services shared across the application
- **Command Pattern**: Slash commands with execute methods and option definitions
- **Observer Pattern**: Event-driven interaction handling
- **State Pattern**: Session-based state machine for complex workflows
- **Repository Pattern**: Service layer abstracting data storage

### Critical Flows

1. **LFG Creation**: Multi-step wizard using session state and modal forms
2. **Join/Leave**: Button-based participation with role and channel permission updates
3. **Substitute Promotion**: Automatic queue processing with timeout handling
4. **Resource Cleanup**: Cascading deletion of roles, messages, and channels
5. **Admin Override**: Permission-based command modifications with audit logging

## Core Architecture

### Service Layer Pattern
The bot implements a service layer pattern with singleton instances for state management:

```javascript
// Example: ListingService singleton
class ListingService {
  constructor() {
    this.listings = new Map(); // In-memory storage
  }
}
const listingService = new ListingService();
module.exports = listingService;
```

## Critical Functions Reference

### ListingService Functions

#### `getListing(id)`
```javascript
getListing(id) {
  if (!id) return null;
  
  // Exact match first for performance
  const exactMatch = this.listings.get(id);
  if (exactMatch) return exactMatch;
  
  // Case-insensitive fallback
  const upperCaseId = id.toUpperCase();
  for (const [listingId, listing] of this.listings.entries()) {
    if (listingId.toUpperCase() === upperCaseId) {
      return listing;
    }
  }
  
  return null;
}
```
**Implementation Notes:**
- Performs case-insensitive lookup as fallback
- O(1) for exact match, O(n) for case-insensitive
- Critical for user-facing commands where case may vary

#### `getExpiredListings(lifetimeMs)`
```javascript
getExpiredListings(lifetimeMs) {
  return this.getAllListings().filter(listing => listing.isExpired(lifetimeMs));
}
```
**Technical Details:**
- Used by cleanup service for batch processing
- Delegates expiration logic to Listing model
- Returns array for Promise.allSettled() processing

### Listing Model Methods

#### `isExpired(lifetimeMs)`
```javascript
isExpired(lifetimeMs) {
  // Indefinite listings never expire
  if (this.indefinite) {
    return false;
  }
  
  const now = new Date();
  const startTime = new Date(this.startTime);
  
  // Expires if: now >= startTime && now > (startTime + lifetimeMs)
  return now >= startTime && (now > new Date(startTime.getTime() + lifetimeMs));
}
```
**Key Points:**
- Uses start time, not creation time for expiration
- Handles indefinite listings via early return
- Critical for cleanup scheduling

#### `promoteSubstitute(userId, hostOverride = false)`
```javascript
promoteSubstitute(userId, hostOverride = false) {
  if (!this.hasSubstitute(userId)) {
    return false;
  }
  
  if (!hostOverride && this.isFull()) {
    return false;
  }
  
  // Atomic operation: remove from substitutes, add to participants
  this.removeSubstitute(userId);
  return this.addParticipant(userId, hostOverride);
}
```
**Implementation Details:**
- Maintains data consistency with atomic operations
- `hostOverride` bypasses size constraints
- Returns boolean for operation success

### ChannelService Functions

#### `createChannels(guild, activityName, activityValue, listingId, roleId, fireteamSize)`
```javascript
async function createChannels(guild, activityName, activityValue, listingId, roleId, fireteamSize = 6) {
  const permissions = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    }
  ];
  
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
  
  // Sherpa role special handling
  if (config.SHERPA_ROLE_ID) {
    const sherpaRole = guild.roles.cache.get(config.SHERPA_ROLE_ID);
    if (sherpaRole) {
      permissions.push({
        id: sherpaRole.id,
        allow: [
          // ... base permissions
          PermissionFlagsBits.MentionEveryone,
          PermissionFlagsBits.MuteMembers
        ]
      });
    }
  }
  
  const category = await guild.channels.create({
    name: `🔥 LFG: ${activityName} (${listingId})`,
    type: ChannelType.GuildCategory,
    permissionOverwrites: permissions
  });
  
  // ... create text and voice channels
}
```
**Technical Considerations:**
- Permission inheritance from category
- Voice channel userLimit set to fireteamSize
- Handles missing Sherpa role gracefully

#### `deleteChannels(guild, channels, reason)`
```javascript
async function deleteChannels(guild, channels, reason = 'LFG listing ended') {
  const { categoryId, textChannelId, voiceChannelId } = channels;
  
  // Critical: Delete children before parent
  const textChannel = guild.channels.cache.get(textChannelId);
  const voiceChannel = guild.channels.cache.get(voiceChannelId);
  const category = guild.channels.cache.get(categoryId);
  
  if (textChannel) {
    await textChannel.delete(reason).catch(error => {
      Logger.error(`Failed to delete text channel ${textChannelId}:`, error);
    });
  }
  
  if (voiceChannel) {
    await voiceChannel.delete(reason).catch(error => {
      Logger.error(`Failed to delete voice channel ${voiceChannelId}:`, error);
    });
  }
  
  // Delete category last to avoid orphaned channels
  if (category) {
    await category.delete(reason).catch(error => {
      Logger.error(`Failed to delete category ${categoryId}:`, error);
    });
  }
}
```
**Critical Implementation Details:**
- Order matters: children before parent
- Each deletion wrapped in individual try-catch
- Continues on failure for partial cleanup

### MessageService Functions

#### `updateAllListingMessages(listing, guild, options = {})`
```javascript
async function updateAllListingMessages(listing, guild, options = {}) {
  const results = {
    listingMessage: false,
    welcomeMessage: false,
    hostControlsMessage: false
  };
  
  // Parallel updates for performance
  results.listingMessage = await updateListingMessage(listing, guild);
  results.welcomeMessage = await updateWelcomeMessage(listing, guild);
  
  // Conditional update based on options
  if (options.oldHostId) {
    results.hostControlsMessage = await updateHostControlsMessage(listing, guild, options.oldHostId);
  }
  
  return results;
}
```
**Usage Pattern:**
```javascript
// After any listing modification
await messageService.updateAllListingMessages(listing, interaction.guild);

// After host transfer
await messageService.updateAllListingMessages(listing, interaction.guild, {
  oldHostId: previousHostId
});
```

#### `updateWelcomeMessage(listing, guild)`
```javascript
async function updateWelcomeMessage(listing, guild) {
  const textChannel = guild.channels.cache.get(listing.textChannelId);
  if (!textChannel) return false;

  // Fetch recent messages (pinned messages are usually at top)
  const messages = await textChannel.messages.fetch({ limit: 20 });

  // Pattern matching for bot's welcome message
  const welcomeMessage = messages.find(message =>
    message.author.bot &&
    message.content.includes('hosting this activity') &&
    message.embeds?.length > 0
  );

  if (welcomeMessage) {
    const embed = createWelcomeEmbed(listing);
    
    // Preserve original content structure, update host reference
    let content = welcomeMessage.content;
    if (content.includes("will be hosting") && !content.includes(`<@${listing.hostId}>`)) {
      content = content.replace(/<@\d+> will be hosting/, `<@${listing.hostId}> will be hosting`);
    }
    
    await welcomeMessage.edit({ content, embeds: [embed] });
    return true;
  }
  return false;
}
```
**Technical Details:**
- Uses heuristic message detection
- Preserves role pings in content
- Regex replacement for host updates

### NotificationService Functions

#### `notifySubstitutesOfOpenSpot(listing, client)`
```javascript
async function notifySubstitutesOfOpenSpot(listing, client) {
  if (listing.substitutes.length === 0 || listing.isFull()) {
    return;
  }
  
  const substituteId = listing.substitutes[0]; // FIFO queue
  
  try {
    const user = await client.users.fetch(substituteId);
    const timeInfo = getTimeInfo(listing);
    const buttonRow = uiBuilder.createSubstituteNotificationButtons(listing.id);
    
    const dmMessage = await user.send({
      content: generateNotificationContent(listing, timeInfo),
      components: [buttonRow]
    });
    
    // Timeout handling for non-indefinite listings
    if (timeInfo.minutesRemaining !== Infinity) {
      const timeoutDuration = Math.min(5 * 60 * 1000, timeInfo.timeRemaining - 10000);
      
      if (timeoutDuration > 0) {
        setTimeout(async () => {
          const currentListing = listingService.getListing(listing.id);
          if (!currentListing) return;
          
          // Verify user hasn't responded
          if (currentListing.hasSubstitute(substituteId) && 
              !currentListing.hasParticipant(substituteId) && 
              !currentListing.isFull()) {
            
            moveSubstituteToEnd(currentListing, substituteId);
            
            // Update DM to show timeout
            await dmMessage.edit({
              content: `The spot has been offered to another substitute...`,
              components: []
            }).catch(() => {}); // Graceful failure
            
            // Recursive call for next substitute
            await notifySubstitutesOfOpenSpot(currentListing, client);
          }
        }, timeoutDuration);
      }
    }
  } catch (error) {
    // On failure, move to next substitute
    moveSubstituteToEnd(listing, substituteId);
    
    if (listing.substitutes.length > 0) {
      await notifySubstitutesOfOpenSpot(listing, client);
    }
  }
}
```
**Key Implementation Details:**
- Recursive pattern for queue processing
- Timeout calculation prevents negative delays
- Graceful degradation on DM failures
- State verification before timeout actions

### SessionService State Machine

#### `Session` Class State Transitions
```javascript
class Session {
  setState(state) {
    // Valid state transitions enforced by LfgState enum
    this.state = state;
    this.updatedAt = Date.now(); // Reset timeout
    return this;
  }
  
  isExpired() {
    return (Date.now() - this.updatedAt) > config.SESSION_TIMEOUT_MS;
  }
}
```
**State Flow:**
```
ACTIVITY_TYPE → SPECIFIC_ACTIVITY → [DIFFICULTY] → DETAILS → CREATING → COMPLETED
                                                      ↓
                                                    ERROR
```

### CleanupService Implementation

#### `cleanupListing(listing, client)`
```javascript
async function cleanupListing(listing, client) {
  const guild = client.guilds.cache.get(listing.guildId);
  if (!guild) {
    listingService.removeListing(listing.id);
    return true;
  }
  
  // Cleanup order is critical:
  // 1. Role removal from members (prevents permission issues)
  if (listing.roleId) {
    const role = guild.roles.cache.get(listing.roleId);
    if (role) {
      const membersWithRole = guild.members.cache.filter(member => 
        member.roles.cache.has(listing.roleId)
      );
      
      // Batch operations with Promise.allSettled
      await Promise.allSettled(
        membersWithRole.map(member => 
          member.roles.remove(role).catch(err => {
            Logger.error(`Role removal failed for ${member.id}:`, err);
          })
        )
      );
      
      await role.delete('LFG expired');
    }
  }
  
  // 2. Message deletion (before channel deletion)
  if (listing.messageId) {
    const lfgChannel = channelService.getLfgChannel(guild);
    if (lfgChannel) {
      const message = await lfgChannel.messages.fetch(listing.messageId).catch(() => null);
      if (message) await message.delete();
    }
  }
  
  // 3. Channel deletion (handled by channelService)
  await channelService.deleteChannels(guild, {
    categoryId: listing.categoryId,
    textChannelId: listing.textChannelId,
    voiceChannelId: listing.voiceChannelId
  }, 'LFG expired');
  
  // 4. Remove from registry (last step)
  listingService.removeListing(listing.id);
  
  return true;
}
```
**Critical Considerations:**
- Order prevents orphaned resources
- Promise.allSettled for resilience
- Continues on partial failures

### Date Parsing Engine

#### `parseUserDate(input)` State Machine
```javascript
function parseUserDate(input) {
  const processedInput = input.trim().toLowerCase();
  
  // Priority order of parsing attempts:
  // 1. Special keywords
  if (processedInput === 'indefinite') {
    return { date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isIndefinite: true };
  }
  
  // 2. Relative expressions with regex
  const relativeMatch = processedInput.match(/^in\s+(\d+)\s+(minute|minutes|min|mins|hour|hours|hr|hrs|day|days)$/i);
  
  // 3. Day references with time
  const dayTimeMatch = processedInput.match(/^(today|tomorrow|day after tomorrow)\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*([a-z]{2,5})?$/i);
  
  // 4. Weekday patterns
  // 5. Time-only (assumes today/tomorrow)
  // 6. Full date format
  // 7. Fallback to native Date parser
}
```
**Timezone Handling:**
```javascript
if (timezone && TIME_ZONES[timezone] !== undefined) {
  const localOffset = -date.getTimezoneOffset() / 60;
  const targetOffset = TIME_ZONES[timezone];
  const diff = targetOffset - localOffset;
  date.setHours(date.getHours() - diff);
}
```

### Interaction Router Pattern

#### Central Event Router (`interactions/index.js`)
```javascript
async function handleButtons(interaction, client) {
  const { customId } = interaction;
  
  // Pre-defer decision based on modal display
  const willShowModal = buttonHandlers.willShowModal(customId);
  
  if (!willShowModal) {
    await interaction.deferReply({ ephemeral: true });
  }
  
  await buttonHandlers.handleButton(interaction, client);
}
```
**Technical Pattern:**
- Modal-showing buttons must not be deferred
- Consistent defer strategy prevents "Unknown Interaction" errors
- Centralized routing for maintainability

### Permission Validation

#### `canManageListing(member, listing)`
```javascript
function canManageListing(member, listing) {
  // Permission hierarchy:
  // 1. Host always has permission
  if (member.id === listing.hostId) return true;
  
  // 2. Discord Administrator
  if (member.permissions.has('Administrator')) return true;
  
  // 3. Configured admin roles
  if (config.ADMIN_ROLE_IDS?.length > 0) {
    return member.roles.cache.some(role => 
      config.ADMIN_ROLE_IDS.includes(role.id)
    );
  }
  
  return false;
}
```
**Usage Pattern:**
```javascript
const isAdmin = member.id !== listing.hostId && canManageListing(member, listing);
if (isAdmin) {
  logAdminAction(member, 'ACTION_TYPE', listing, 'details');
}
```

### Error Boundary Patterns

#### Channel Deletion Safety
```javascript
// From cancel-command.js
try {
  await interaction.editReply({ content: confirmMessage });
  
  // ... cleanup operations ...
  
  await channelService.deleteChannels(guild, channels, reason);
} catch (error) {
  // Can't reply after channel deletion
  Logger.error(`Error in cancel: ${error.message}`);
}
```

#### Interaction Reply State Machine
```javascript
// Standard pattern for safe replies
try {
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content, ephemeral: true });
  } else if (interaction.deferred) {
    await interaction.editReply({ content });
  } else {
    await interaction.followUp({ content, ephemeral: true });
  }
} catch (error) {
  Logger.error('Reply failed:', error);
}
```

### Logging Architecture

#### Circular Reference Handler
```javascript
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  };
}
```

#### Log Rotation Implementation
```javascript
rotateLogFiles() {
  // Delete oldest: file.4.log
  // Rename: file.3.log → file.4.log
  // ...
  // Rename: file.log → file.0.log
  // Create new: file.log
  
  for (let i = this.options.maxFiles - 2; i >= 0; i--) {
    const currentLog = `${basename}.${i}${ext}`;
    const newLog = `${basename}.${i + 1}${ext}`;
    if (fs.existsSync(currentLog)) {
      fs.renameSync(currentLog, newLog);
    }
  }
}
```

## Performance Considerations

### Map vs Object Storage
```javascript
// ListingService uses Map for O(1) lookups
this.listings = new Map();

// Benefits:
// - .size property
// - Iteration order guaranteed
// - Any value as key
// - Better performance for frequent additions/deletions
```

### Batch Operations
```javascript
// From cleanup service
const results = await Promise.allSettled(
  expiredListings.map(listing => cleanupListing(listing, client))
);
```

### Caching Strategies
```javascript
// Channel cache usage prevents API calls
const channel = guild.channels.cache.get(channelId);
// Only fetches if not in cache
const message = await channel.messages.fetch(messageId).catch(() => null);
```

## Security Considerations

### Input Validation
```javascript
// From parseUserDate
const processedInput = input.trim().toLowerCase();
// Regex patterns prevent injection
```

### Permission Checks
```javascript
// Every sensitive operation validates permissions
if (interaction.user.id !== listing.hostId) {
  await interaction.editReply({ content: 'Unauthorized' });
  return;
}
```

### Rate Limiting Considerations
- Cleanup runs on configurable cron schedule
- Notification timeouts prevent spam
- Batch operations reduce API calls

## Data Flow Architecture

### Command Execution Flow
```
User Input → Discord Event → Event Router → Command Handler → Service Layer → Discord API
     ↑                                                                              ↓
     ←←←←←←←←←←←←←←←←←←←←←← Response ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

### State Management Flow
```javascript
// Session-based state for multi-step processes
User Interaction → Session Creation/Update → State Validation → Progress to Next State
                            ↓
                    Timeout → Cleanup
```

### Listing Lifecycle
```
Create → Active → [Modified] → Expired → Cleanup
   ↓                   ↑           ↓
Role/Channel     Update/Extend   Delete
  Creation                     Resources
```

## Advanced Patterns

### Modal ID Extraction for Admin Actions
```javascript
function extractListingId(customId, prefix) {
  const baseString = customId.substring(prefix.length);
  const isAdminAction = baseString.startsWith('admin_');
  
  if (isAdminAction) {
    return baseString.substring(6); // 'admin_' is 6 characters
  }
  
  return baseString;
}
```

### Recursive Substitute Notification
```javascript
async function notifyNext(listing, client) {
  if (listing.substitutes.length === 0) return;
  
  try {
    await notifySubstitute(listing.substitutes[0]);
  } catch (error) {
    moveToEnd(listing.substitutes[0]);
    await notifyNext(listing, client); // Recursive call
  }
}
```

### Voice Channel Dynamic Limits
```javascript
// From addSpots
const voiceChannel = interaction.guild.channels.cache.get(listing.voiceChannelId);
if (voiceChannel) {
  await voiceChannel.setUserLimit(newSize);
}
```

## Common Pitfalls & Solutions

### 1. Interaction Already Replied
**Problem:** Attempting to reply multiple times to same interaction
**Solution:** State checking pattern
```javascript
if (!interaction.replied && !interaction.deferred) {
  await interaction.reply();
} else if (interaction.deferred) {
  await interaction.editReply();
} else {
  await interaction.followUp();
}
```

### 2. Channel Deletion Race Conditions
**Problem:** Trying to send messages after channel deletion
**Solution:** Send confirmations before cleanup operations

### 3. Permission Overwrites on Deleted Roles
**Problem:** Role might be deleted before channel permissions
**Solution:** Graceful error handling with .catch()

### 4. Case Sensitivity in User Input
**Problem:** Users might type listing IDs in wrong case
**Solution:** Case-insensitive lookup in getListing()

### 5. Timezone Confusion
**Problem:** Users in different timezones
**Solution:** Discord timestamps with `<t:timestamp:F>` format

## Testing Considerations

### Unit Test Targets
- Date parsing with various formats
- Permission validation logic
- State machine transitions
- Listing expiration calculations

### Integration Test Scenarios
- Full LFG creation workflow
- Substitute promotion flow
- Admin override operations
- Cleanup service execution

### Load Testing Points
- Multiple concurrent LFG creations
- Bulk cleanup operations
- High substitute queue turnover

## Monitoring & Debugging

### Key Metrics
- Active listings count
- Average session duration
- Cleanup execution time
- Failed interaction rate

### Debug Points
```javascript
Logger.debug(`Processing ${action} for listing: ${listingId}`);
Logger.debug(`Session state transition: ${oldState} → ${newState}`);
Logger.debug(`Cleanup found ${count} expired listings`);
```

### Error Tracking
- Interaction failures logged with context
- Admin actions tracked separately
- Cleanup failures don't halt process

## Future Enhancement Considerations

### Database Integration Points
- ListingService Map → Database table
- Session storage → Redis/Memory cache
- Persistent configuration

### Scalability Paths
- Sharding support via guild-based partitioning
- Queue system for notifications
- Distributed cleanup workers

### Feature Extensions
- Listing templates
- Recurring events
- Cross-server listings
- Advanced search/filtering