import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@react-navigation/native';
// Assuming useAuth hook to get current user ID for checking if user reacted
// import { useAuth } from '@/store/authStore';
// Assuming tRPC hook for adding/removing reactions
// import { trpc } from '@/lib/trpc';

export interface ReactionsData {
  [emoji: string]: string[]; // emoji: list of user_ids who reacted with it
}

interface MessageReactionsProps {
  reactions: ReactionsData | null | undefined;
  messageId: string;
  onToggleReaction?: (emoji: string) => void; // Callback for when a reaction is pressed
}

const MessageReactions: React.FC<MessageReactionsProps> = ({ reactions, messageId, onToggleReaction }) => {
  const { colors } = useTheme();
  // const { user } = useAuth(); // Get current user to highlight their reactions

  if (!reactions || Object.keys(reactions).length === 0) {
    return null;
  }

  // Sort reactions by count or a predefined order if necessary
  const sortedEmojis = Object.keys(reactions).sort(
    (a, b) => (reactions[b]?.length || 0) - (reactions[a]?.length || 0)
  );

  return (
    <View style={styles.container}>
      {sortedEmojis.map((emoji) => {
        const count = reactions[emoji]?.length || 0;
        if (count === 0) return null;

        // const userReacted = user && reactions[emoji]?.includes(user.id); // Check if current user reacted

        return (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionChip,
              { backgroundColor: colors.border }, // userReacted ? colors.primary : colors.border - for highlighting
              // { borderColor: userReacted ? colors.primary : colors.border }
            ]}
            onPress={() => onToggleReaction && onToggleReaction(emoji)}
            // onLongPress={() => { /* TODO: Show who reacted */ }}
            activeOpacity={0.7}
            accessibilityLabel={`Reaction ${emoji}, count ${count}. Press to toggle.`}
            accessibilityRole="button"
          >
            <Text style={styles.emojiText}>{emoji}</Text>
            <Text style={[styles.countText, { color: colors.text }]}>{count}</Text>
          </TouchableOpacity>
        );
      })}
      {/* Placeholder for an "Add reaction" button if desired */}
      {/* <TouchableOpacity
            style={[styles.addReactionButton, { borderColor: colors.border }]}
            accessibilityLabel="Add reaction"
            accessibilityRole="button"
      >
        <Text style={{color: colors.textMuted}}>➕</Text>
      </TouchableOpacity> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    alignItems: 'center',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
  },
  emojiText: {
    fontSize: 14,
    marginRight: 4,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // addReactionButton: {
  //   paddingHorizontal: 8,
  //   paddingVertical: 4,
  //   borderRadius: 12,
  //   borderWidth: 1,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
});

export default MessageReactions;
