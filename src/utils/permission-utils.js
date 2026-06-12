/**
 * Utilities for permission checking
 */
const config = require('../config');
const Logger = require('./logger');

/**
 * Check if a user has permission to manage a listing
 * Permission is granted if:
 * 1. The user is the host of the listing
 * 2. The user has an admin role defined in config
 * 3. The user is a server administrator
 * 
 * @param {GuildMember} member - Guild member to check
 * @param {Listing} listing - Listing to check permissions for
 * @returns {boolean} True if the user has permission
 */
function canManageListing(member, listing) {
  // If user is the host, always allow
  if (member.id === listing.hostId) {
    return true;
  }
  
  // Check for administrator permission
  if (member.permissions.has('Administrator')) {
    return true;
  }
  
  // Check for admin roles
  if (config.ADMIN_ROLE_IDS && config.ADMIN_ROLE_IDS.length > 0) {
    const hasAdminRole = member.roles.cache.some(role => config.ADMIN_ROLE_IDS.includes(role.id));
    if (hasAdminRole) {
      return true;
    }
  }
  
  // No permission
  return false;
}

/**
 * Check if a user has general admin permissions in the server
 * 
 * @param {GuildMember} member - Guild member to check
 * @returns {boolean} True if the user has admin permissions
 */
function hasAdminPermission(member) {
  // Check for administrator permission
  if (member.permissions.has('Administrator')) {
    return true;
  }
  
  // Check for admin roles
  if (config.ADMIN_ROLE_IDS && config.ADMIN_ROLE_IDS.length > 0) {
    return member.roles.cache.some(role => config.ADMIN_ROLE_IDS.includes(role.id));
  }
  
  return false;
}

/**
 * Log an admin action for audit purposes
 * 
 * @param {GuildMember} admin - Admin who performed the action
 * @param {string} action - Action performed
 * @param {Listing} listing - Affected listing
 * @param {string} details - Additional details
 */
function logAdminAction(admin, action, listing, details = '') {
  const interactionLogger = require('./interaction-logger');
  
  interactionLogger.interaction(
    admin.id,
    `ADMIN_ACTION:${action}`,
    `Admin ${admin.user.tag} (${admin.id}) performed ${action} on listing ${listing.id}`,
    {
      adminId: admin.id,
      adminTag: admin.user.tag,
      listingId: listing.id,
      hostId: listing.hostId,
      activityName: listing.activityName,
      details: details
    }
  );
  
  Logger.info(`Admin action: ${admin.user.tag} (${admin.id}) performed ${action} on listing ${listing.id} - ${details}`);
}

module.exports = {
  canManageListing,
  hasAdminPermission,
  logAdminAction
};