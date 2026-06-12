/**
 * Handler for add player modal submissions
 */
const listingService = require('../../services/listing-service');
const messageService = require('../../services/message-service');
const channelService = require('../../services/channel-service');
const Logger = require('../../utils/logger');

/**
 * Handle add player modal submission
 * @param {ModalSubmitInteraction} interaction - Modal interaction
 * @param {string} listingId - Listing ID
 */
async function handleModalSubmit(interaction, listingId) {
    try {
        // Get the listing
        const listing = listingService.getListing(listingId);

        if (!listing) {
            await interaction.editReply({
                content: 'This listing no longer exists or has expired.'
            });
            return;
        }

        // Determine if this is an admin action (modal opened via admin host controls)
        const isAdmin = interaction.customId.includes('admin_');

        // Only check host permission if not admin
        if (!isAdmin && interaction.user.id !== listing.hostId) {
            await interaction.editReply({
                content: 'Only the host can add players to this listing.'
            });
            return;
        }

        // Get player input from the form
        const playerInput = interaction.fields.getTextInputValue('player_id');

        // Try to find the user
        let targetUser, targetMember;

        try {
            // Try by mention or ID
            const mentionMatch = playerInput.match(/<@!?(\d+)>/);
            const idMatch = playerInput.match(/^\d+$/);

            if (mentionMatch) {
                // User was mentioned
                const userId = mentionMatch[1];
                targetUser = await interaction.client.users.fetch(userId).catch(() => null);
                if (targetUser) {
                    targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
                }
            } else if (idMatch) {
                // User ID was provided
                targetUser = await interaction.client.users.fetch(playerInput).catch(() => null);
                if (targetUser) {
                    targetMember = await interaction.guild.members.fetch(playerInput).catch(() => null);
                }
            } else {
                // Try by username
                const members = await interaction.guild.members.search({
                    query: playerInput,
                    limit: 1
                });
                if (members.size > 0) {
                    targetMember = members.first();
                    targetUser = targetMember.user;
                }
            }

            // If user not found
            if (!targetUser) {
                await interaction.editReply({
                    content: `Could not find a user with the ID/username "${playerInput}".`
                });
                return;
            }

            // Check if the user is already in the fireteam
            if (listing.hasParticipant(targetUser.id)) {
                await interaction.editReply({
                    content: `${targetUser} is already part of the fireteam.`
                });
                return;
            }

            // Check if the fireteam is full (but allow adding anyway with warning)
            if (listing.isFull()) {
                await interaction.editReply({
                    content: `Warning: The fireteam for ${listing.activityName} is already full (${listing.participants.length}/${listing.fireteamSize}). Adding this player will exceed the limit.`
                });

                // Wait for 2 seconds so the warning is visible
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Update message to show we're proceeding
                await interaction.editReply({
                    content: `Proceeding to add ${targetUser} to the fireteam...`
                });
            }

            // Check if the user is a substitute
            if (listing.hasSubstitute(targetUser.id)) {
                // Promote substitute to participant
                listing.promoteSubstitute(targetUser.id, true); // Use host override

                // Update channel permissions
                await channelService.promoteSubstituteInChannels(
                    interaction.guild, {
                        categoryId: listing.categoryId,
                        textChannelId: listing.textChannelId,
                        voiceChannelId: listing.voiceChannelId
                    },
                    targetUser.id
                );

                // Send message in the text channel
                const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
                if (textChannel) {
                    await textChannel.send(`${targetUser} has been promoted from substitute to full fireteam member by ${interaction.user}!`);
                }

                // Update all messages
                await messageService.updateAllListingMessages(listing, interaction.guild);

                await interaction.editReply({
                    content: `${targetUser} has been promoted from substitute to the fireteam for ${listing.activityName}!`
                });
                return;
            }

            // Add user to participants
            listing.addParticipant(targetUser.id, true); // Use host override

            // Add role if it exists
            if (listing.roleId && targetMember) {
                const role = interaction.guild.roles.cache.get(listing.roleId);
                if (role) {
                    await targetMember.roles.add(role).catch(err => {
                        Logger.error(`Could not add role to user:`, err);
                    });
                }
            }

            // Add channel permissions
            await channelService.addUserToChannels(
                interaction.guild, {
                    categoryId: listing.categoryId,
                    textChannelId: listing.textChannelId,
                    voiceChannelId: listing.voiceChannelId
                },
                targetUser.id,
                false, // Not a substitute
                targetUser.id === listing.hostId // Is host check
            );

            // Send message in the text channel
            const textChannel = interaction.guild.channels.cache.get(listing.textChannelId);
            if (textChannel) {
                await textChannel.send(`${targetUser} has been added to the fireteam by ${interaction.user}!`);
            }

            // Update all messages
            await messageService.updateAllListingMessages(listing, interaction.guild);

            await interaction.editReply({
                content: `Successfully added ${targetUser} to the fireteam for ${listing.activityName}!`
            });

        } catch (error) {
            Logger.error(`Error finding or adding user:`, error);
            await interaction.editReply({
                content: `Error: ${error.message}`
            });
        }

    } catch (error) {
        Logger.error('Error in add player modal:', error);
        await interaction.editReply({
            content: 'There was an error adding the player. Please try using the /addplayer command instead.'
        });
    }
}

/**
 * Update the welcome message in the LFG channel
 * @param {Listing} listing - The listing
 * @param {Guild} guild - Discord guild
 * @returns {Promise<boolean>} Success status
 */
async function updateWelcomeMessage(listing, guild) {
    return await messageService.updateWelcomeMessage(listing, guild);
}

module.exports = {
    handleModalSubmit,
    updateWelcomeMessage // Export for backward compatibility
};