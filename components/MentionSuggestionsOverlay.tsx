import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import PlayerAvatar from './PlayerAvatar'; // Assuming PlayerAvatar can be reused

// Define Player type for mention suggestions - should align with what getPlayersForMention returns
interface MentionPlayer {
  id: string;
  nickname: string;
  avatar_url: string | null;
  // Add any other fields that might be useful, e.g., name
}

interface MentionSuggestionsOverlayProps {
  suggestions: MentionPlayer[];
  onSelectSuggestion: (nickname: string) => void; // Callback to insert nickname into input
  isVisible: boolean;
}

const MentionSuggestionsOverlay: React.FC<MentionSuggestionsOverlayProps> = ({
  suggestions,
  onSelectSuggestion,
  isVisible,
}) => {
  const { colors } = useTheme();

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  const renderItem = ({ item }: { item: MentionPlayer }) => (
    <TouchableOpacity
      style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
      onPress={() => onSelectSuggestion(item.nickname)}
      accessibilityLabel={`Select mention ${item.nickname}`}
      accessibilityRole="button"
    >
      <PlayerAvatar source={{ uri: item.avatar_url }} size={24} />
      <Text style={[styles.nicknameText, { color: colors.text }]}>{item.nickname}</Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          // Position this absolutely above the ChatInput
          // This might need dynamic calculation based on ChatInput's position if not fixed
        }
      ]}
    >
      <FlatList
        data={suggestions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled" // Important for touch handling within the overlay
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // These values need to be adjusted based on where ChatInput is and its height.
    // This assumes ChatInput is at the very bottom of its container.
    bottom: '100%', // Positioned above the parent of where it's rendered (e.g. above ChatInput)
    left: 10, // Align with ChatInput's horizontal padding/margin
    right: 10,
    maxHeight: 150, // Limit the height of the suggestion box
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderBottomWidth: 0, // Avoid double border with input if input has top border
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: -2 }, // Shadow appears above
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden', // Ensures children (FlatList) are clipped to rounded corners
  },
  list: {
    flexGrow: 0, // Important for FlatList within a view with maxHeight
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  nicknameText: {
    marginLeft: 8,
    fontSize: 15,
  },
});

export default MentionSuggestionsOverlay;
