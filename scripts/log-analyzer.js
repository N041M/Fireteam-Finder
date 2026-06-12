/**
 * Utility script to analyze interaction logs
 * 
 * This script parses interaction logs and provides statistics and insights
 * Run with: node log-analyzer.js <options>
 * 
 * Options:
 *   --path=<path>          : Path to log file or directory (default: logs/interactions)
 *   --days=<number>        : Only analyze logs from the past N days (default: 7)
 *   --user=<userId>        : Filter logs for specific user ID
 *   --type=<activity_type> : Filter by activity type (command, button, etc.)
 *   --errors               : Only show errors
 *   --output=<file>        : Save results to file
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  path: './logs/interactions/user-activity.log',
  days: 7,
  user: null,
  type: null,
  errors: false,
  output: null
};

// Parse arguments
args.forEach(arg => {
  if (arg.startsWith('--path=')) {
    options.path = arg.split('=')[1];
  } else if (arg.startsWith('--days=')) {
    options.days = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--user=')) {
    options.user = arg.split('=')[1];
  } else if (arg.startsWith('--type=')) {
    options.type = arg.split('=')[1];
  } else if (arg === '--errors') {
    options.errors = true;
  } else if (arg.startsWith('--output=')) {
    options.output = arg.split('=')[1];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Interaction Log Analyzer
========================

Usage: node log-analyzer.js [options]

Options:
  --path=<path>          : Path to log file or directory (default: logs/interactions)
  --days=<number>        : Only analyze logs from the past N days (default: 7)
  --user=<userId>        : Filter logs for specific user ID
  --type=<activity_type> : Filter by activity type (command, button, etc.)
  --errors               : Only show errors
  --output=<file>        : Save results to file
  --help, -h             : Show this help message
    `);
    process.exit(0);
  }
});

// Initialize statistics trackers
const stats = {
  totalEntries: 0,
  errors: 0,
  commands: {},
  buttonClicks: {},
  users: {},
  activities: {},
  hourlyActivity: Array(24).fill(0),
  dailyActivity: {},
};

/**
 * Get all log files to analyze
 * @returns {Array<string>} Array of log file paths
 */
function getLogFiles() {
  // If path is a directory, get all log files
  if (fs.statSync(options.path).isDirectory()) {
    return fs.readdirSync(options.path)
      .filter(file => file.endsWith('.log'))
      .map(file => path.join(options.path, file));
  }
  
  // If path is a file, return just that file
  return [options.path];
}

/**
 * Parse a log entry
 * @param {string} line - Log line to parse
 * @returns {Object|null} Parsed log entry or null if invalid
 */
function parseLogLine(line) {
  try {
    // Example format: [2025-03-24T15:30:45.123Z] [INFO] User 123456789 used command: /lfg {"activity":"raid","players":6}
    const timestampMatch = line.match(/\[(.*?)\]/);
    if (!timestampMatch) return null;
    
    const timestamp = new Date(timestampMatch[1]);
    
    // Check if the log is within the time range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.days);
    if (timestamp < cutoffDate) return null;
    
    // Extract log level
    const levelMatch = line.match(/\]\s+\[(.*?)\]/);
    const level = levelMatch ? levelMatch[1] : 'UNKNOWN';
    
    // If only looking for errors and this isn't one, skip
    if (options.errors && level !== 'ERROR') return null;
    
    // Extract user ID
    const userMatch = line.match(/User\s+(\w+)/);
    const userId = userMatch ? userMatch[1] : 'system';
    
    // If filtering by user and this isn't a match, skip
    if (options.user && userId !== options.user) return null;
    
    // Extract action and details
    let action = 'unknown';
    let details = '';
    let activityType = '';
    
    if (line.includes('used command:')) {
      action = 'command';
      const commandMatch = line.match(/used command:\s+\/(\w+)/);
      details = commandMatch ? commandMatch[1] : 'unknown';
      activityType = 'command';
    } else if (line.includes('clicked button:')) {
      action = 'button';
      const buttonMatch = line.match(/clicked button:\s+([\w_]+)/);
      details = buttonMatch ? buttonMatch[1] : 'unknown';
      activityType = 'button';
    } else if (line.includes('selected from menu:')) {
      action = 'selectMenu';
      const menuMatch = line.match(/selected from menu:\s+([\w_]+)/);
      details = menuMatch ? menuMatch[1] : 'unknown';
      activityType = 'menu';
    } else if (line.includes('submitted modal:')) {
      action = 'modal';
      const modalMatch = line.match(/submitted modal:\s+([\w_]+)/);
      details = modalMatch ? modalMatch[1] : 'unknown';
      activityType = 'modal';
    } else if (line.includes('joined') || line.includes('left')) {
      action = line.includes('joined') ? 'joined' : 'left';
      const activityMatch = line.match(/activity:\s+(.*?)\s+\(/);
      details = activityMatch ? activityMatch[1] : 'unknown';
      activityType = 'participation';
    } else if (line.includes('created listing:') || line.includes('modified listing:') || line.includes('cancelled listing:')) {
      if (line.includes('created')) action = 'created';
      else if (line.includes('modified')) action = 'modified';
      else action = 'cancelled';
      
      const listingMatch = line.match(/listing:\s+(\w+)/);
      details = listingMatch ? listingMatch[1] : 'unknown';
      activityType = 'listing';
    } else if (level === 'ERROR') {
      action = 'error';
      const errorMatch = line.match(/\] (.+)$/);
      details = errorMatch ? errorMatch[1] : 'unknown error';
      activityType = 'error';
    }
    
    // If filtering by activity type and this isn't a match, skip
    if (options.type && activityType !== options.type) return null;
    
    // Extract JSON data if present
    let data = null;
    const jsonMatch = line.match(/\{.*\}$/);
    if (jsonMatch) {
      try {
        data = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    return {
      timestamp,
      level,
      userId,
      action,
      details,
      activityType,
      data
    };
  } catch (error) {
    console.error('Error parsing log line:', error);
    return null;
  }
}

/**
 * Process a log file and update statistics
 * @param {string} filePath - Path to log file
 * @returns {Promise<void>}
 */
async function processLogFile(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    const logEntry = parseLogLine(line);
    if (!logEntry) continue;
    
    stats.totalEntries++;
    
    // Track by hour of day
    const hour = logEntry.timestamp.getHours();
    stats.hourlyActivity[hour]++;
    
    // Track by day
    const dateStr = logEntry.timestamp.toISOString().split('T')[0];
    stats.dailyActivity[dateStr] = (stats.dailyActivity[dateStr] || 0) + 1;
    
    // Track user activity
    if (!stats.users[logEntry.userId]) {
      stats.users[logEntry.userId] = { 
        total: 0, 
        commands: 0, 
        buttons: 0, 
        participations: 0,
        errors: 0
      };
    }
    stats.users[logEntry.userId].total++;
    
    // Track by activity type
    if (logEntry.level === 'ERROR') {
      stats.errors++;
      stats.users[logEntry.userId].errors++;
    }
    
    if (logEntry.action === 'command') {
      stats.commands[logEntry.details] = (stats.commands[logEntry.details] || 0) + 1;
      stats.users[logEntry.userId].commands++;
    } else if (logEntry.action === 'button') {
      // Extract base button type (e.g., join, cancel, etc.)
      const baseButtonType = logEntry.details.split('_')[0];
      stats.buttonClicks[baseButtonType] = (stats.buttonClicks[baseButtonType] || 0) + 1;
      stats.users[logEntry.userId].buttons++;
    } else if (logEntry.action === 'joined' || logEntry.action === 'left') {
      // Track participation in activities
      if (!stats.activities[logEntry.details]) {
        stats.activities[logEntry.details] = { joins: 0, leaves: 0 };
      }
      
      if (logEntry.action === 'joined') {
        stats.activities[logEntry.details].joins++;
      } else {
        stats.activities[logEntry.details].leaves++;
      }
      
      stats.users[logEntry.userId].participations++;
    }
  }
}

/**
 * Format statistics for output
 * @returns {string} Formatted statistics
 */
function formatStatistics() {
  const now = new Date();
  const result = [];
  
  result.push(`Interaction Log Analysis`);
  result.push(`======================`);
  result.push(`Generated: ${now.toISOString()}`);
  result.push(`Analyzed logs from the past ${options.days} days`);
  result.push(`Total entries: ${stats.totalEntries}`);
  result.push(`Errors: ${stats.errors}`);
  result.push(``);
  
  // Top commands
  const sortedCommands = Object.entries(stats.commands)
    .sort((a, b) => b[1] - a[1]);
  
  result.push(`Top Commands Used:`);
  result.push(`----------------`);
  sortedCommands.slice(0, 10).forEach(([command, count], index) => {
    result.push(`${index + 1}. /${command}: ${count} uses (${((count / stats.totalEntries) * 100).toFixed(1)}%)`);
  });
  result.push(``);
  
  // Top button interactions
  const sortedButtons = Object.entries(stats.buttonClicks)
    .sort((a, b) => b[1] - a[1]);
  
  result.push(`Top Button Interactions:`);
  result.push(`----------------------`);
  sortedButtons.slice(0, 10).forEach(([button, count], index) => {
    result.push(`${index + 1}. ${button}: ${count} clicks (${((count / stats.totalEntries) * 100).toFixed(1)}%)`);
  });
  result.push(``);
  
  // Popular activities
  const sortedActivities = Object.entries(stats.activities)
    .sort((a, b) => b[1].joins - a[1].joins);
  
  result.push(`Most Popular Activities:`);
  result.push(`---------------------`);
  sortedActivities.slice(0, 10).forEach(([activity, counts], index) => {
    result.push(`${index + 1}. ${activity}: ${counts.joins} joins, ${counts.leaves} leaves`);
  });
  result.push(``);
  
  // Most active users
  const sortedUsers = Object.entries(stats.users)
    .sort((a, b) => b[1].total - a[1].total);
  
  result.push(`Most Active Users:`);
  result.push(`----------------`);
  sortedUsers.slice(0, 10).forEach(([userId, counts], index) => {
    result.push(`${index + 1}. User ${userId}: ${counts.total} interactions`);
    result.push(`   Commands: ${counts.commands}, Buttons: ${counts.buttons}, Participations: ${counts.participations}, Errors: ${counts.errors}`);
  });
  result.push(``);
  
  // Activity by hour
  result.push(`Activity by Hour of Day:`);
  result.push(`---------------------`);
  let maxHourlyActivity = Math.max(...stats.hourlyActivity);
  const hourWidth = 30; // Width of the bar chart
  
  stats.hourlyActivity.forEach((count, hour) => {
    const barLength = Math.round((count / maxHourlyActivity) * hourWidth);
    const bar = '█'.repeat(barLength);
    result.push(`${hour.toString().padStart(2, '0')}:00 | ${bar} ${count}`);
  });
  result.push(``);
  
  // Activity by day
  result.push(`Activity by Day:`);
  result.push(`--------------`);
  const sortedDays = Object.entries(stats.dailyActivity)
    .sort((a, b) => a[0].localeCompare(b[0])); // Sort by date
  
  sortedDays.forEach(([day, count]) => {
    result.push(`${day}: ${count} interactions`);
  });
  
  return result.join('\n');
}

/**
 * Main function
 */
async function main() {
  console.log('Interaction Log Analyzer');
  console.log('=======================');
  console.log(`Analyzing logs from: ${options.path}`);
  console.log(`Time range: Last ${options.days} days`);
  if (options.user) console.log(`Filtering for user: ${options.user}`);
  if (options.type) console.log(`Filtering for activity type: ${options.type}`);
  if (options.errors) console.log(`Showing only errors`);
  console.log('');
  
  try {
    const logFiles = getLogFiles();
    console.log(`Found ${logFiles.length} log files.`);
    
    for (const file of logFiles) {
      console.log(`Processing: ${file}`);
      await processLogFile(file);
    }
    
    const formattedStats = formatStatistics();
    
    if (options.output) {
      fs.writeFileSync(options.output, formattedStats);
      console.log(`\nResults saved to ${options.output}`);
    } else {
      console.log('\n' + formattedStats);
    }
    
  } catch (error) {
    console.error('Error analyzing logs:', error);
    process.exit(1);
  }
}

// Run the script
main();