//app/services/notificationService.ts
import {supabase} from '@/backend/server/lib/supabase';
import {z} from 'zod'
import {Json} from '@/backend/types/supabase';

interface BaseMetadata {
    notification_type: SystemNotificationType;
}

export interface MatchWonMetadata extends BaseMetadata {
    notification_type: 'match_won';
    winnerNickname: string;
    loserNickname: string;
    matchId: string;
    score?: string;
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

const SendNotificationInputSchema = z.object({
    notification_type: z.string(),
    message_content: z.string().optional(),
    metadata: z.record(z.any()),
});

function generateMessage(type: SystemNotificationType, metadata: SystemNotificationMetadata): string {
    switch (type) {
        case 'match_won': {
            const matchMetadata = metadata as MatchWonMetadata;
            return `🏆 ${matchMetadata.winnerNickname} just won the match against ${matchMetadata.loserNickname}!`;
        }
        case 'tournament_won': {
            const tournamentMetadata = metadata as TournamentWonMetadata;
            return `👑 ${tournamentMetadata.winnerNickname} just won the tournament ${tournamentMetadata.tournamentName}!`;
        }
        case 'achievement_unlocked': {
            const achievementMetadata = metadata as AchievementUnlockedMetadata;
            return `🏅 ${achievementMetadata.achieverNickname} just unlocked the achievement: ${achievementMetadata.achievementName}.`;
        }
        case 'rank_up': {
            const rankMetadata = metadata as RankUpMetadata;
            return `🚀 ${rankMetadata.playerNickname} just reached the ${rankMetadata.rankName}!`;
        }
        case 'new_player': {
            const newPlayerMetadata = metadata as NewPlayerWelcomeMetadata;
            return `👋 Welcome, ${newPlayerMetadata.newPlayerNickname}!`;
        }
        default:
            return 'Unknown notification type.';
    }
}

export async function dispatchSystemNotification<T extends SystemNotificationType>(
    type: T,
    metadata: Extract<SystemNotificationMetadata, { notification_type: T }>,
    message?: string
): Promise<void> {
    try {
        const messageToSend = message || generateMessage(type, metadata);
        const {notification_type, ...cleanMetadata} = metadata as any;
        const input = SendNotificationInputSchema.parse({
            notification_type: type,
            message_content: messageToSend,
            metadata: cleanMetadata,
        });

        console.log('📤 Dispatching system notification:', {
            type,
            message: messageToSend,
            metadata: cleanMetadata
        });

        const {error} = await supabase
            .from('chat_messages')
            .insert({
                user_id: null,
                message_content: input.message_content,
                message_type: 'system_notification',
                metadata: {
                    ...cleanMetadata,
                    notification_type: type
                } as Json,
            });

        if (error) {
            console.error(`❌ Failed to dispatch system notification [${type}]:`, error);
            throw error;
        } else {
            console.log(`✅ System notification [${type}] dispatched successfully`);
        }
    } catch (error) {
        console.error('Error in dispatchSystemNotification:', error);
        if (error instanceof z.ZodError) {
            console.error('Validation errors:', error.errors);
        }
        throw error;
    }
}

console.log('Created backend/services/notificationService.ts');
