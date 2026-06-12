/**
 * Utility for building standardized UI components
 */
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

/**
 * Create host control buttons
 * @param {string} listingId - Listing ID
 * @returns {Array<ActionRowBuilder>} Rows of buttons
 */
function createHostControls(listingId) {
    // First row of buttons
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`extend_${listingId}`)
            .setLabel('Extend Time')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⏰'),

            new ButtonBuilder()
            .setCustomId(`add_${listingId}`)
            .setLabel('Add Player')
            .setStyle(ButtonStyle.Success)
            .setEmoji('👤'),

            new ButtonBuilder()
            .setCustomId(`remove_${listingId}`)
            .setLabel('Remove Player')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🥾')
        );

    // Second row of buttons - Add new spot management buttons
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`addspot_${listingId}`)
            .setLabel('Add Spot')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),

            new ButtonBuilder()
            .setCustomId(`removespot_${listingId}`)
            .setLabel('Remove Spot')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➖'),

            new ButtonBuilder()
            .setCustomId(`transfer_${listingId}`)
            .setLabel('Transfer Host')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👑')
        );

    // Third row - Move cancel button to its own row
    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`cancel_${listingId}`)
            .setLabel('Cancel LFG')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔚')
        );

    return [row1, row2, row3];
}

/**
 * Create participant control buttons
 * @param {string} listingId - Listing ID
 * @returns {ActionRowBuilder} Row of buttons
 */
function createParticipantControls(listingId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`join_${listingId}`)
            .setLabel('Join Fireteam')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎮'),

            new ButtonBuilder()
            .setCustomId(`sub_${listingId}`)
            .setLabel('Join as Substitute')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄'),

            new ButtonBuilder()
            .setCustomId(`leave_${listingId}`)
            .setLabel('Leave')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👋'),

            new ButtonBuilder()
            .setCustomId(`info_${listingId}`)
            .setLabel('Info')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('ℹ️')
        );
}

/**
 * Create buttons for substitute notifications
 * @param {string} listingId - Listing ID
 * @returns {ActionRowBuilder} Row of buttons
 */
function createSubstituteNotificationButtons(listingId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId(`accept_${listingId}`)
            .setLabel('Accept Spot')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),

            new ButtonBuilder()
            .setCustomId(`decline_${listingId}`)
            .setLabel('Decline Spot')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        );
}

/**
 * Create add player modal
 * @param {string} listingId - Listing ID
 * @param {string} activityName - Activity name
 * @returns {ModalBuilder} Modal
 */
function createAddPlayerModal(listingId, activityName) {
    const modal = new ModalBuilder()
        .setCustomId(`add_player_${listingId}`)
        .setTitle(`Add Player to ${activityName}`);

    const playerInput = new TextInputBuilder()
        .setCustomId('player_id')
        .setLabel('Player ID or Username')
        .setPlaceholder('Enter Discord ID, mention (@user), or username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(playerInput)
    );

    return modal;
}

/**
 * Create remove player modal
 * @param {string} listingId - Listing ID
 * @param {string} activityName - Activity name
 * @returns {ModalBuilder} Modal
 */
function createRemovePlayerModal(listingId, activityName) {
    const modal = new ModalBuilder()
        .setCustomId(`remove_player_${listingId}`)
        .setTitle(`Remove Player from ${activityName}`);

    const playerInput = new TextInputBuilder()
        .setCustomId('player_id')
        .setLabel('Player ID or Username')
        .setPlaceholder('Enter Discord ID, mention (@user), or username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(playerInput)
    );

    return modal;
}

/**
 * Create transfer host modal
 * @param {string} listingId - Listing ID
 * @param {string} activityName - Activity name
 * @returns {ModalBuilder} Modal
 */
function createTransferHostModal(listingId, activityName) {
    const modal = new ModalBuilder()
        .setCustomId(`transfer_host_${listingId}`)
        .setTitle(`Transfer Host for ${activityName}`);

    const newHostInput = new TextInputBuilder()
        .setCustomId('new_host_id')
        .setLabel('New Host ID or Username')
        .setPlaceholder('Enter Discord ID, mention (@user), or username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(newHostInput)
    );

    return modal;
}

/**
 * Create extend time modal
 * @param {string} listingId - Listing ID
 * @param {string} activityName - Activity name
 * @returns {ModalBuilder} Modal
 */
function createExtendTimeModal(listingId, activityName) {
    const modal = new ModalBuilder()
        .setCustomId(`extend_time_${listingId}`)
        .setTitle(`Extend Time for ${activityName}`);

    const hoursInput = new TextInputBuilder()
        .setCustomId('hours')
        .setLabel('Hours to extend (1-24)')
        .setPlaceholder('Enter a number between 1 and 24')
        .setValue('1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const indefiniteInput = new TextInputBuilder()
        .setCustomId('indefinite')
        .setLabel('Make indefinite? (yes/no)')
        .setPlaceholder('Type "yes" to make this LFG indefinite')
        .setValue('no')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(hoursInput),
        new ActionRowBuilder().addComponents(indefiniteInput)
    );

    return modal;
}

/**
 * Create add spot modal
 * @param {string} listingId - Listing ID
 * @param {string} activityName - Activity name
 * @returns {ModalBuilder} Modal
 */
function createAddSpotModal(listingId, activityName) {
    // Truncate activity name to ensure title stays within Discord's 45-character limit
    const truncatedName = activityName.length > 20 ? activityName.substring(0, 17) + '...' : activityName;
    const title = `Add Spots to ${truncatedName}`;

    const modal = new ModalBuilder()
        .setCustomId(`addspot_modal_${listingId}`)
        .setTitle(title);

    const spotsInput = new TextInputBuilder()
        .setCustomId('spots')
        .setLabel('Number of spots to add (1-6)')
        .setPlaceholder('Enter a number between 1 and 6')
        .setValue('1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(spotsInput)
    );

    return modal;
}

/**
 * Create remove spot modal
 * @param {string} listingId - Listing ID
 * @param {string} activityName - Activity name
 * @returns {ModalBuilder} Modal
 */
function createRemoveSpotModal(listingId, activityName) {
    // Truncate activity name to ensure title stays within Discord's 45-character limit
    const truncatedName = activityName.length > 20 ? activityName.substring(0, 17) + '...' : activityName;
    const title = `Remove Spots from ${truncatedName}`;

    const modal = new ModalBuilder()
        .setCustomId(`removespot_modal_${listingId}`)
        .setTitle(title);

    const spotsInput = new TextInputBuilder()
        .setCustomId('spots')
        .setLabel('Number of spots to remove (1-6)')
        .setPlaceholder('Enter a number between 1 and 6')
        .setValue('1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(spotsInput)
    );

    return modal;
}

module.exports = {
    createHostControls,
    createParticipantControls,
    createSubstituteNotificationButtons,
    createAddPlayerModal,
    createRemovePlayerModal,
    createTransferHostModal,
    createExtendTimeModal,
    createAddSpotModal,
    createRemoveSpotModal
};