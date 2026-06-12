/**
 * Enhanced utilities for date/time formatting and handling
 * Provides user-friendly parsing and time zone support
 */

/**
 * Format a date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateTime(date) {
  if (!date) return 'Unknown';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Format a date as a Discord timestamp
 * @param {string|Date} date - Date to format
 * @param {string} format - Discord timestamp format (R: relative, F: full, etc.)
 * @returns {string} Discord timestamp string
 */
function discordTimestamp(date, format = 'F') {
  if (!date) return 'Unknown';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const timestamp = Math.floor(dateObj.getTime() / 1000);
  
  return `<t:${timestamp}:${format}>`;
}

/**
 * Calculate time until date in minutes
 * @param {string|Date} date - Target date
 * @returns {number} Minutes until date
 */
function minutesUntil(date) {
  if (!date) return 0;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const diffMs = dateObj.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

/**
 * Common time zones with their UTC offsets
 */
const TIME_ZONES = {
  'est': -5, 'edt': -4, 'et': -5,   // Eastern
  'cst': -6, 'cdt': -5, 'ct': -6,   // Central
  'mst': -7, 'mdt': -6, 'mt': -7,   // Mountain
  'pst': -8, 'pdt': -7, 'pt': -8,   // Pacific
  'hst': -10,                       // Hawaii
  'akst': -9, 'akdt': -8,           // Alaska
  'gmt': 0, 'utc': 0,               // GMT/UTC
  'bst': 1,                         // British Summer Time
  'cet': 1, 'cest': 2,              // Central European
  'eet': 2, 'eest': 3,              // Eastern European
  'jst': 9,                         // Japan
  'aest': 10, 'aedt': 11,           // Australian Eastern
  'nzst': 12, 'nzdt': 13            // New Zealand
};

/**
 * Parse a user-friendly time input
 * @param {string} input - User input string
 * @returns {Object} Parsed result with date and isIndefinite flag
 */
function parseUserDate(input) {
  // Trim and convert to lowercase for consistent processing
  const processedInput = input.trim().toLowerCase();
  
  // Handle special keywords
  if (processedInput === 'indefinite') {
    return {
      date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now as placeholder
      isIndefinite: true
    };
  }
  
  if (processedInput === 'now') {
    return {
      date: new Date(), // Current system time
      isIndefinite: false
    };
  }

  // Try to parse relative time expressions
  const relativeMatch = processedInput.match(/^in\s+(\d+)\s+(minute|minutes|min|mins|hour|hours|hr|hrs|day|days)$/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    
    const now = new Date();
    
    if (unit.startsWith('minute') || unit.startsWith('min')) {
      now.setMinutes(now.getMinutes() + amount);
    } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
      now.setHours(now.getHours() + amount);
    } else if (unit.startsWith('day')) {
      now.setDate(now.getDate() + amount);
    }
    
    return {
      date: now,
      isIndefinite: false
    };
  }
  
  // Try to parse "today/tomorrow/day after tomorrow at HH:MM AM/PM [TIMEZONE]"
  const dayTimeMatch = processedInput.match(/^(today|tomorrow|day after tomorrow)\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*([a-z]{2,5})?$/i);
  if (dayTimeMatch) {
    const dayRef = dayTimeMatch[1].toLowerCase();
    let hours = parseInt(dayTimeMatch[2], 10);
    const minutes = dayTimeMatch[3] ? parseInt(dayTimeMatch[3], 10) : 0;
    const ampm = dayTimeMatch[4] ? dayTimeMatch[4].toLowerCase() : null;
    const timezone = dayTimeMatch[5] ? dayTimeMatch[5].toLowerCase() : null;
    
    // Adjust hours for AM/PM
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    
    const now = new Date();
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes
    );
    
    // Adjust for "tomorrow" or "day after tomorrow"
    if (dayRef === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (dayRef === 'day after tomorrow') {
      date.setDate(date.getDate() + 2);
    }
    
    // Apply timezone offset if provided
    if (timezone && TIME_ZONES[timezone] !== undefined) {
      // Get the local timezone offset in hours
      const localOffset = -date.getTimezoneOffset() / 60;
      // Get the target timezone offset
      const targetOffset = TIME_ZONES[timezone];
      // Calculate the difference and adjust
      const diff = targetOffset - localOffset;
      date.setHours(date.getHours() - diff);
    }
    
    return {
      date,
      isIndefinite: false
    };
  }
  
  // Parse weekday formats: "Monday at 8PM", "Tuesday 15:30 EST"
  const weekdayMatch = processedInput.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*([a-z]{2,5})?$/i);
  if (weekdayMatch) {
    const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      .indexOf(weekdayMatch[1].toLowerCase());
    let hours = parseInt(weekdayMatch[2], 10);
    const minutes = weekdayMatch[3] ? parseInt(weekdayMatch[3], 10) : 0;
    const ampm = weekdayMatch[4] ? weekdayMatch[4].toLowerCase() : null;
    const timezone = weekdayMatch[5] ? weekdayMatch[5].toLowerCase() : null;
    
    // Adjust hours for AM/PM
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to add
    let daysToAdd = weekday - currentDay;
    if (daysToAdd <= 0) {
      daysToAdd += 7; // Go to next week if day has passed
    }
    
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysToAdd,
      hours,
      minutes
    );
    
    // Apply timezone offset if provided
    if (timezone && TIME_ZONES[timezone] !== undefined) {
      // Get the local timezone offset in hours
      const localOffset = -date.getTimezoneOffset() / 60;
      // Get the target timezone offset
      const targetOffset = TIME_ZONES[timezone];
      // Calculate the difference and adjust
      const diff = targetOffset - localOffset;
      date.setHours(date.getHours() - diff);
    }
    
    return {
      date,
      isIndefinite: false
    };
  }
  
  // Try to parse time-only format (assumes today): "8PM", "20:30 EST"
  const timeOnlyMatch = processedInput.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*([a-z]{2,5})?$/i);
  if (timeOnlyMatch) {
    let hours = parseInt(timeOnlyMatch[1], 10);
    const minutes = timeOnlyMatch[2] ? parseInt(timeOnlyMatch[2], 10) : 0;
    const ampm = timeOnlyMatch[3] ? timeOnlyMatch[3].toLowerCase() : null;
    const timezone = timeOnlyMatch[4] ? timeOnlyMatch[4].toLowerCase() : null;
    
    // Adjust hours for AM/PM
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    
    const now = new Date();
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes
    );
    
    // If the time has already passed today, assume tomorrow
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }
    
    // Apply timezone offset if provided
    if (timezone && TIME_ZONES[timezone] !== undefined) {
      // Get the local timezone offset in hours
      const localOffset = -date.getTimezoneOffset() / 60;
      // Get the target timezone offset
      const targetOffset = TIME_ZONES[timezone];
      // Calculate the difference and adjust
      const diff = targetOffset - localOffset;
      date.setHours(date.getHours() - diff);
    }
    
    return {
      date,
      isIndefinite: false
    };
  }
  
  // Try to parse full date format: "YYYY-MM-DD HH:MM [Timezone]"
  const fullDateMatch = processedInput.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?:\s+([a-z]{2,5}))?)?$/i);
  if (fullDateMatch) {
    const year = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10) - 1; // JS months are 0-based
    const day = parseInt(fullDateMatch[3], 10);
    const hours = fullDateMatch[4] ? parseInt(fullDateMatch[4], 10) : 0;
    const minutes = fullDateMatch[5] ? parseInt(fullDateMatch[5], 10) : 0;
    const timezone = fullDateMatch[6] ? fullDateMatch[6].toLowerCase() : null;
    
    const date = new Date(year, month, day, hours, minutes);
    
    // Apply timezone offset if provided
    if (timezone && TIME_ZONES[timezone] !== undefined) {
      // Get the local timezone offset in hours
      const localOffset = -date.getTimezoneOffset() / 60;
      // Get the target timezone offset
      const targetOffset = TIME_ZONES[timezone];
      // Calculate the difference and adjust
      const diff = targetOffset - localOffset;
      date.setHours(date.getHours() - diff);
    }
    
    return {
      date,
      isIndefinite: false
    };
  }
  
  // As a fallback, try the standard Date parser
  try {
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      return {
        date,
        isIndefinite: false
      };
    }
  } catch (error) {
    // If this fails, we'll throw the general error below
  }
  
  // If all parsing attempts fail, provide a helpful error message
  throw new Error(
    'Invalid time format. You can use:\n' +
    '• "now" - Current time\n' +
    '• "indefinite" - No end time\n' +
    '• "in X hours/minutes" - Relative time\n' +
    '• "today/tomorrow at HH:MM AM/PM [TZ]" - Day reference\n' +
    '• "Monday at 8PM [TZ]" - Weekday reference\n' +
    '• "8PM [TZ]" - Time today or tomorrow\n' +
    '• "YYYY-MM-DD HH:MM [TZ]" - Full date and time\n\n' +
    'Valid time zones include: EST, EDT, CST, MST, PST, GMT, UTC, etc.'
  );
}

/**
 * Get information about supported time formats
 * @returns {string} Formatted information
 */
function getTimeFormatHelp() {
  return (
    '**Supported Time Formats:**\n\n' +
    '• `now` - Current time\n' +
    '• `indefinite` - No end time\n' +
    '• `in X hours/minutes` - Example: "in 2 hours"\n' +
    '• `today/tomorrow at HH:MM AM/PM` - Example: "tomorrow at 8:30 PM"\n' +
    '• `Monday at 8PM` - Any weekday with time\n' +
    '• `8PM EST` - Time with optional time zone\n' +
    '• `YYYY-MM-DD HH:MM` - Standard date format\n\n' +
    '**Supported Time Zones:** EST, EDT, CST, CDT, MST, MDT, PST, PDT, HST, GMT, UTC'
  );
}

module.exports = {
  formatDateTime,
  discordTimestamp,
  minutesUntil,
  parseUserDate,
  getTimeFormatHelp,
  TIME_ZONES
};