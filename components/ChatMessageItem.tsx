import React, { memo } from 'react'; // Import memo
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { MessageCircle, Award, Trophy, Zap, UserPlus, AlertTriangle, CheckCircle } from 'lucide-react-native'; // Example icons

import PlayerAvatar from './PlayerAvatar'; // Use actual PlayerAvatar component
import { formatChatMessageTime } from '@/utils/formatters'; // Use actual formatter
import MessageReactions, { ReactionsData } from './MessageReactions'; // Import MessageReactions and its type

// Define the expected structure for a chat message
// This should align with the ChatMessage type from backend/trpc/routes/chat.ts
// For now, we'll define a simplified version.
export interface ChatMessage {
  id: string;
  user_id: string | null;
  // For frontend convenience, we might join profile data before passing to this component
  profile?: {
    id: string;
    avatar_url: string | null;
    nickname: string | null;
  } | null;
  message_content: string | null;
  created_at: string;
  message_type: 'user_message' | 'system_notification';
  metadata?: {
    notification_type?: string;
    [key: string]: any; // Other metadata fields
  } | null;
  reactions?: ReactionsData | null; // Use ReactionsData type
}

interface ChatMessageItemProps {
  message: ChatMessage;
  currentUserId?: string | null; // To determine if message is from current user
  // Add onToggleReaction prop if ChatMessageItem itself handles calling the mutation
  // onToggleReaction: (messageId: string, emoji: string) => void;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, currentUserId /*, onToggleReaction */ }) => {
  const { colors } = useTheme();
  const router = useRouter();

  const isUserMessage = message.message_type === 'user_message';
  const isMyMessage = isUserMessage && message.user_id === currentUserId;

  const handleNicknamePress = () => {
    if (message.profile?.id && isUserMessage) {
      router.push(`/player/${message.profile.id}`);
    }
  };

  const renderSystemNotificationContent = () => {
    if (!message.metadata || !message.metadata.notification_type) {
      return <Text style={{ color: colors.text }}>{message.message_content || 'System notification'}</Text>;
    }

    const { metadata } = message;
    let icon = <AlertTriangle size={16} color={colors.notification} />;
    let content: React.ReactNode = message.message_content;

    switch (metadata.notification_type) {
      case 'match_won':
        icon = <Trophy size={16} color={colors.primary} />;
        content = (
          <Text>
            <Text style={styles.bold}>🏆 {metadata.winnerNickname}</Text> właśnie wygrał(a) mecz z <Text style={styles.bold}>{metadata.opponentNickname}</Text>!
          </Text>
        );
        break;
      case 'tournament_won':
        icon = <Award size={16} color={colors.primary} />;
        content = (
          <Text>
            <Text style={styles.bold}>👑 {metadata.winnerNickname}</Text> zwyciężył(a) w turnieju <Text style={styles.bold}>{metadata.tournamentName}</Text>!
          </Text>
        );
        break;
      case 'achievement_unlocked':
        icon = <CheckCircle size={16} color={colors.primary} />; // Or a specific achievement icon
        content = (
          <Text>
            <Text style={styles.bold}>🏅 {metadata.achieverNickname}</Text> zdobył(a) osiągnięcie: <Text style={styles.bold}>{metadata.achievementName}</Text>.
          </Text>
        );
        break;
      case 'rank_up':
        icon = <Zap size={16} color={colors.primary} />;
        content = (
          <Text>
            <Text style={styles.bold}>🚀 {metadata.playerNickname}</Text> awansował(a) do rangi <Text style={styles.bold}>{metadata.rankName}</Text>!
          </Text>
        );
        break;
      case 'new_player':
        icon = <UserPlus size={16} color={colors.primary} />;
        content = (
          <Text>
            👋 Witamy w grze, <Text style={styles.bold}>{metadata.newPlayerNickname}</Text>!
          </Text>
        );
        break;
      default:
        content = <Text>{message.message_content || `Powiadomienie systemowe: ${metadata.notification_type}`}</Text>;
    }

    return (
      <View style={styles.systemMessageContent}>
        {icon}
        <Text style={[styles.systemMessageText, { color: colors.text, marginLeft: 8 }]}>{content}</Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        isUserMessage ? (isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer)
                       : styles.systemMessageContainer,
        { borderBottomColor: colors.border }
      ]}
    >
      {isUserMessage && message.profile && (
        <TouchableOpacity onPress={handleNicknamePress} style={styles.avatarContainer}>
          <PlayerAvatar source={{ uri: message.profile.avatar_url }} size={32} />
        </TouchableOpacity>
      )}

      <View style={styles.messageContentContainer}>
        {isUserMessage && message.profile && (
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleNicknamePress} accessibilityLabel={`View profile of ${message.profile.nickname || 'User'}`} accessibilityRole="button">
              <Text style={[styles.nickname, { color: colors.primary }]}>{message.profile.nickname || 'Użytkownik'}</Text>
            </TouchableOpacity>
            <Text style={[styles.timestamp, { color: colors.textMuted || '#999' }]}>
              {/* Use colors.textMuted if available, otherwise a fallback */}
              {formatChatMessageTime(message.created_at)}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            isUserMessage ? (isMyMessage ? { backgroundColor: colors.primary } : { backgroundColor: colors.card })
                           : { backgroundColor: colors.background }
          ]}
          accessibilityLabel={isUserMessage ? `Message from ${message.profile?.nickname || 'User'}: ${message.message_content}` : `System notification: ${message.metadata?.notification_type}`}
        >
          {isUserMessage ? (
            <Text style={[styles.messageText, isMyMessage ? { color: '#FFFFFF' } : { color: colors.text }]}>
              {message.message_content}
            </Text>
          ) : (
            renderSystemNotificationContent()
          )}
        </View>
        {message.reactions && isUserMessage && (
          <MessageReactions
            reactions={message.reactions}
            messageId={message.id}
            onToggleReaction={(emoji) => {
              console.log(`Toggled reaction: ${emoji} for message ${message.id}`);
            }}
          />
        )}
      </View>
      {/* TODO: Add ReactionPicker on long-press/hover. This will likely involve state management here or in parent. */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  myMessageContainer: {
    // Specific styles for messages from the current user (e.g., align right)
    // For now, just a conceptual difference in bubble color
  },
  otherMessageContainer: {
    // Styles for messages from other users
  },
  systemMessageContainer: {
    // Styles for system messages (e.g., centered, different background)
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  avatarContainer: {
    marginRight: 10,
    justifyContent: 'flex-start', // Align avatar to the top of the message bubble
  },
  messageContentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nickname: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  timestamp: {
    fontSize: 12,
  },
  messageBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    maxWidth: '90%', // Ensure messages don't take full width
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  systemMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  systemMessageText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  bold: {
    fontWeight: 'bold',
  },
  // Add styles for reactions display and picker later
});

export default memo(ChatMessageItem); // Wrap with memo
