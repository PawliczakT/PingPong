import { supabaseAsAdmin } from '../../lib/supabase-as-admin'; // Corrected path
import { z } from 'zod';

// Define types for metadata for better type safety, aligning with frontend expectations
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
    case 'match_won':
      return `🏆 ${metadata.winnerNickname} właśnie wygrał(a) mecz z ${metadata.opponentNickname}!`;
    case 'tournament_won':
      return `👑 ${metadata.winnerNickname} zwyciężył(a) w turnieju ${metadata.tournamentName}!`;
    case 'achievement_unlocked':
      return `🏅 ${metadata.achieverNickname} zdobył(a) osiągnięcie: ${metadata.achievementName}.`;
    case 'rank_up':
      return `🚀 ${metadata.playerNickname} awansował(a) do rangi ${metadata.rankName}!`;
    case 'new_player':
      return `👋 Witamy w grze, ${metadata.newPlayerNickname}!`;
    default:
      return 'Nowe powiadomienie systemowe.';
  }
}

/**
 * Sends a system notification by directly inserting into the chat_messages table.
 * This function should be called from backend services/event handlers.
 * It uses the supabaseAsAdmin client to bypass RLS if needed (for system messages where user_id is NULL).
 */
export async function dispatchSystemNotification(
  type: SystemNotificationType,
  metadata: SystemNotificationMetadata,
  message?: string
): Promise<void> {
  try {
    const validatedMetadata = metadata; // Assuming metadata is already validated or comes from a trusted source.
                                      // Add validation if metadata comes from less trusted parts of the backend.

    const messageToSend = message || generateMessage(type, validatedMetadata);

    const input = SendNotificationInputSchema.parse({
      notification_type: type,
      message_content: messageToSend,
      metadata: validatedMetadata,
    });

    const { error } = await supabaseAsAdmin
      .from('chat_messages')
      .insert({
        user_id: null, // System messages are not tied to a specific user
        message_content: input.message_content,
        message_type: 'system_notification',
        metadata: { ...input.metadata, notification_type: type }, // Ensure notification_type is in metadata
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
/*
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
*/

console.log('Created backend/services/notificationService.ts');
