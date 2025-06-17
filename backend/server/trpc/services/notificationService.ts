//backend/server/trpc/services/notificationService.ts
import {supabaseAsAdmin} from '../../lib/supabase';
import {z} from 'zod'
import {Json} from '../../../types/supabase';

interface BaseMetadata {
    notification_type: SystemNotificationType;
}

export interface MatchWonMetadata extends BaseMetadata {
    notification_type: 'match_won';
    winnerNickname: string;
    opponentNickname: string;
    matchId: string;
}

export interface TournamentWonMetadata extends BaseMetadata {
    notification_type: 'tournament_won';
    winnerNickname: string;
    tournamentName: string;
    tournamentId: string;
}

export interface AchievementUnlockedMetadata extends BaseMetadata {
    notification_type: 'achievement_unlocked';
    achieverNickname: string;
    achievementName: string;
    achievementId: string;
}

export interface RankUpMetadata extends BaseMetadata {
    notification_type: 'rank_up';
    playerNickname: string;
    rankName: string;
}

export interface NewPlayerWelcomeMetadata extends BaseMetadata {
    notification_type: 'new_player';
    newPlayerNickname: string;
    playerId: string;
}

export type SystemNotificationMetadata =
    | MatchWonMetadata
    | TournamentWonMetadata
    | AchievementUnlockedMetadata
    | RankUpMetadata
    | NewPlayerWelcomeMetadata;

export type SystemNotificationType = SystemNotificationMetadata['notification_type'];

// Schema for the input to our internal function, aligning with sendSystemNotification tRPC input
const SendNotificationInputSchema = z.object({
    notification_type: z.string(),
    message_content: z.string().optional(), // Message can be generated here or passed directly
    metadata: z.record(z.any()),
});

/**
 * Generates a human-readable message from metadata.
 * This logic can be expanded and moved to the frontend as well if messages need i18n or more complex rendering.
 */
function generateMessage(type: SystemNotificationType, metadata: SystemNotificationMetadata): string {
    switch (type) {
        case 'match_won': {
            const matchMetadata = metadata as MatchWonMetadata;
            return `🏆 ${matchMetadata.winnerNickname} właśnie wygrał(a) mecz z ${matchMetadata.opponentNickname}!`;
        }
        case 'tournament_won': {
            const tournamentMetadata = metadata as TournamentWonMetadata;
            return `👑 ${tournamentMetadata.winnerNickname} zwyciężył(a) w turnieju ${tournamentMetadata.tournamentName}!`;
        }
        case 'achievement_unlocked': {
            const achievementMetadata = metadata as AchievementUnlockedMetadata;
            return `🏅 ${achievementMetadata.achieverNickname} zdobył(a) osiągnięcie: ${achievementMetadata.achievementName}.`;
        }
        case 'rank_up': {
            const rankMetadata = metadata as RankUpMetadata;
            return `🚀 ${rankMetadata.playerNickname} awansował(a) do rangi ${rankMetadata.rankName}!`;
        }
        case 'new_player': {
            const newPlayerMetadata = metadata as NewPlayerWelcomeMetadata;
            return `👋 Witamy w grze, ${newPlayerMetadata.newPlayerNickname}!`;
        }
        default:
            return 'Nowe powiadomienie systemowe.';
    }
}

/**
 * Sends a system notification by directly inserting into the chat_messages table.
 * This function should be called from backend services/event handlers.
 * It uses the supabase client to bypass RLS if needed (for system messages where user_id is NULL).
 */
export async function dispatchSystemNotification<T extends SystemNotificationType>(
    type: T,
    metadata: Extract<SystemNotificationMetadata, { notification_type: T }>,
    message?: string
): Promise<void> {
    try {
        // TypeScript now knows that metadata matches the notification type
        const messageToSend = message || generateMessage(type, metadata);

        // Create a copy of metadata to avoid mutating the original object
        const validatedMetadata = {...metadata};

        const input = SendNotificationInputSchema.parse({
            notification_type: type,
            message_content: messageToSend,
            metadata: validatedMetadata,
        });

        const {error} = await supabaseAsAdmin
            .from('chat_messages')
            .insert({
                user_id: null, // System messages are not tied to a specific user
                message_content: input.message_content,
                message_type: 'system_notification',
                // Double cast - first to unknown, then to Json to satisfy TypeScript
                metadata: validatedMetadata as unknown as Json,
            });

        if (error) {
            console.error(`Failed to dispatch system notification [${type}]:`, error);
            // Depending on criticality, you might want to throw, or just log
        } else {
            console.log(`System notification [${type}] dispatched successfully.`);
        }
    } catch (error) {
        console.error('Error in dispatchSystemNotification:', error);
        if (error instanceof z.ZodError) {
            console.error('Validation errors:', error.errors);
        }
        // Handle error, maybe rethrow or log to a monitoring service
    }
}

// Example usage (for testing or other backend modules):
async function exampleUsage() {
    await dispatchSystemNotification('match_won', {
        notification_type: 'match_won',
        winnerNickname: "PlayerA",
        opponentNickname: "PlayerB",
        matchId: "uuid-match-123"
    });

    await dispatchSystemNotification('achievement_unlocked', {
        notification_type: 'achievement_unlocked',
        achieverNickname: "PlayerC",
        achievementName: "Pierwsza Wygrana",
        achievementId: "uuid-achievement-456"
    });
}

console.log('Created backend/services/notificationService.ts');
