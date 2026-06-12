/**
 * Definitions of Destiny 2 activities for LFG listings
 */

// Raids
const RAIDS = [
  { 
    label: 'Last Wish', 
    value: 'last_wish', 
    description: 'Forsaken raid in the Dreaming City', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'Garden of Salvation', 
    value: 'garden', 
    description: 'Shadowkeep raid on the Moon', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'Deep Stone Crypt', 
    value: 'dsc', 
    description: 'Beyond Light raid on Europa', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'Vault of Glass', 
    value: 'vog', 
    description: 'Remastered classic raid', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'Vow of the Disciple', 
    value: 'vow', 
    description: 'The Witch Queen raid in the Throne World', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'King\'s Fall', 
    value: 'kf', 
    description: 'Remastered raid from The Taken King', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'Root of Nightmares', 
    value: 'root', 
    description: 'Lightfall raid on Neomuna', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'Crota\'s End', 
    value: 'crota', 
    description: 'Remastered raid from The Dark Below', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'Salvation\'s Edge', 
    value: 'salvation', 
    description: 'The Final Shape raid', 
    playerCount: 6,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard raid difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  }
];

// PvE activities
const PVE_ACTIVITIES = [
  { 
    label: 'Nightfall', 
    value: 'nightfall', 
    description: 'High-difficulty strike', 
    playerCount: 3,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard Nightfall difficulty' },
      { label: 'Hero', value: 'hero', description: 'Hero difficulty with champions' },
      { label: 'Legend', value: 'legend', description: 'Legend difficulty (matchmaking disabled)' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' },
      { label: 'Grandmaster', value: 'grandmaster', description: 'Highest difficulty tier' }
    ]
  },
  { 
    label: 'Dungeon', 
    value: 'dungeon', 
    description: 'Three-player mini-raid', 
    playerCount: 3,
    hasDifficulty: true,
    difficulties: [
      { label: 'Normal', value: 'normal', description: 'Standard dungeon difficulty' },
      { label: 'Master', value: 'master', description: 'Master difficulty with extra modifiers' }
    ]
  },
  { 
    label: 'Exotic Quest', 
    value: 'exotic', 
    description: 'Special mission for exotic weapons', 
    playerCount: 3,
    hasDifficulty: false,
    difficulties: []
  }
];

// PvP activities
const PVP_ACTIVITIES = [
  { label: 'Crucible', value: 'crucible', description: 'Standard PvP playlist', playerCount: 3 },
  { label: 'Iron Banner', value: 'iron_banner', description: 'Limited-time PvP event', playerCount: 3 },
  { label: 'Trials of Osiris', value: 'trials', description: 'Competitive weekend PvP event', playerCount: 3 },
  { label: 'Competitive', value: 'competitive', description: 'Ranked PvP playlist', playerCount: 3 }
];

// Other activities
const OTHER_ACTIVITIES = [
  { label: 'Other', value: 'other', description: 'Custom activity', playerCount: 6 }
];

// LFG tags that can be applied to any activity
const LFG_TAGS = [
  { label: 'Sherpa Run', value: 'sherpa', description: 'Teaching/learning run for inexperienced players' },
  { label: 'Low Man', value: 'lowman', description: 'Attempting with fewer than recommended players' },
  { label: 'Flawless', value: 'flawless', description: 'Attempting without dying' },
  { label: 'Contest Mode', value: 'contest', description: 'Self-imposed power limit for additional challenge' },
  { label: 'Time Trial', value: 'speedrun', description: 'Attempting to complete quickly' },
  { label: 'Triumph Hunt', value: 'triumph', description: 'Focusing on specific triumph completions' },
  { label: 'KWTD', value: 'kwtd', description: 'Know What To Do - experience required' },
  { label: 'Fresh Run', value: 'fresh', description: 'Starting from the beginning' },
  { label: 'Checkpoint', value: 'checkpoint', description: 'Starting from a saved checkpoint' }
];

/**
 * Get default player count for an activity
 * @param {string} activityValue - Activity identifier
 * @returns {number} The default player count
 */
function getDefaultPlayerCount(activityValue) {
  // Check in each activity category
  for (const category of [RAIDS, PVE_ACTIVITIES, PVP_ACTIVITIES, OTHER_ACTIVITIES]) {
    const activity = category.find(a => a.value === activityValue);
    if (activity) return activity.playerCount;
  }
  
  return 6; // Default fallback
}

/**
 * Get activity name by its value
 * @param {string} activityValue - Activity identifier
 * @returns {string} The activity name
 */
function getActivityName(activityValue) {
  // Check in each activity category
  for (const category of [RAIDS, PVE_ACTIVITIES, PVP_ACTIVITIES, OTHER_ACTIVITIES]) {
    const activity = category.find(a => a.value === activityValue);
    if (activity) return activity.label;
  }
  
  return 'Unknown Activity';
}

/**
 * Check if an activity has difficulty options
 * @param {string} activityValue - Activity identifier
 * @returns {boolean} Whether the activity has difficulty options
 */
function hasDifficultyOptions(activityValue) {
  // Check in each activity category
  for (const category of [RAIDS, PVE_ACTIVITIES]) {
    const activity = category.find(a => a.value === activityValue);
    if (activity) return activity.hasDifficulty;
  }
  
  return false;
}

/**
 * Get difficulty options for an activity
 * @param {string} activityValue - Activity identifier
 * @returns {Array} Array of difficulty options or empty array if none
 */
function getDifficultyOptions(activityValue) {
  // Check in each activity category
  for (const category of [RAIDS, PVE_ACTIVITIES]) {
    const activity = category.find(a => a.value === activityValue);
    if (activity && activity.hasDifficulty) {
      return activity.difficulties || [];
    }
  }
  
  return [];
}

/**
 * Get all activities of a specific type
 * @param {string} type - One of 'raids', 'pve', 'pvp', or 'other'
 * @returns {Array} Array of activities
 */
function getActivitiesByType(type) {
  switch (type) {
    case 'raids': return RAIDS;
    case 'pve': return PVE_ACTIVITIES;
    case 'pvp': return PVP_ACTIVITIES;
    case 'other': return OTHER_ACTIVITIES;
    default: return [];
  }
}

/**
 * Format an activity name with its difficulty
 * @param {string} activityName - Base activity name
 * @param {string} difficultyValue - Difficulty value
 * @returns {string} Formatted name
 */
function formatActivityWithDifficulty(activityName, difficultyValue) {
  if (!difficultyValue) return activityName;
  
  // Capitalize first letter of difficulty
  const formattedDifficulty = difficultyValue.charAt(0).toUpperCase() + difficultyValue.slice(1);
  return `${activityName} (${formattedDifficulty})`;
}

module.exports = {
  RAIDS,
  PVE_ACTIVITIES,
  PVP_ACTIVITIES,
  OTHER_ACTIVITIES,
  LFG_TAGS,
  getDefaultPlayerCount,
  getActivityName,
  hasDifficultyOptions,
  getDifficultyOptions,
  getActivitiesByType,
  formatActivityWithDifficulty
};