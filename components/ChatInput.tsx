import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Send } from 'lucide-react-native'; // Using Lucide for the send icon

interface ChatInputProps {
  value: string; // Controlled component: value is passed from parent
  onChangeText: (text: string) => void; // Controlled component: text changes are sent to parent
  onSendMessage: (messageContent: string) => void;
  onMentionQueryChange: (query: string | null) => void;
  isLoading?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
  onSendMessage,
  onMentionQueryChange,
  isLoading = false
}) => {
  const { colors } = useTheme();
  // const [message, setMessage] = useState(''); // State is now managed by parent
  const mentionQueryRef = useRef<string | null>(null);

  const handleTextChange = (text: string) => {
    // setMessage(text); // Parent handles state update via onChangeText
    onChangeText(text);

    // Basic mention detection logic
    const lastWord = text.split(/\s+/).pop() || "";
    if (lastWord.startsWith('@')) {
      const query = lastWord.substring(1);
      if (query.length > 0) { // Only trigger if there's actually a query after @
        if (mentionQueryRef.current !== query) {
          onMentionQueryChange(query);
          mentionQueryRef.current = query;
        }
      } else { // If it's just "@" or "@ "
        onMentionQueryChange(null); // Clear suggestions or don't search
        mentionQueryRef.current = null;
      }
    } else {
      if (mentionQueryRef.current !== null) { // If we were previously tracking a mention
        onMentionQueryChange(null); // Clear suggestions
        mentionQueryRef.current = null;
      }
    }
  };

  const handleSend = () => {
    const trimmedMessage = value.trim(); // Use value from props
    if (trimmedMessage) {
      onSendMessage(trimmedMessage);
      onChangeText(''); // Clear input via parent's handler
    }
  };

  return (
    <View style={[styles.container, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
      {/* Placeholder for mention suggestion box that could appear above the input */}
      {/* <View style={styles.mentionSuggestionsContainer} /> */}

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            color: colors.text,
            borderColor: colors.border
          }
        ]}
        placeholder="Type a message..."
        placeholderTextColor={colors.textMuted}
        value={value} // Use value from props
        onChangeText={handleTextChange}
        multiline
        editable={!isLoading}
        onSubmitEditing={Platform.OS === 'web' ? handleSend : undefined} // Send on Enter for web
        returnKeyType={Platform.OS === 'ios' ? 'send' : 'default'}
        enablesReturnKeyAutomatically // Disables send button if text input is empty (iOS)
        accessibilityLabel="Chat message input"
      />
      <TouchableOpacity
        style={[styles.sendButton, { backgroundColor: colors.primary }]}
        onPress={handleSend}
        disabled={isLoading || value.trim().length === 0} // Use value from props
        activeOpacity={0.7}
        accessibilityLabel="Send message"
        accessibilityRole="button"
      >
        <Send size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120, // Allow for multiple lines but not excessive height
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    // Platform specific padding for vertical alignment if needed
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
  },
  sendButton: {
    padding: 10,
    borderRadius: 20, // Make it circular or rounded square
    justifyContent: 'center',
    alignItems: 'center',
  },
  // mentionSuggestionsContainer: {
  //   // Styles for a future mention suggestion box
  //   position: 'absolute',
  //   bottom: '100%', // Appears above the input field
  //   left: 0,
  //   right: 0,
  //   backgroundColor: colors.card, // Example styling
  //   borderTopWidth: 1,
  //   borderLeftWidth: 1,
  //   borderRightWidth: 1,
  //   borderColor: colors.border,
  //   borderRadius: 8,
  //   padding: 4,
  //   maxHeight: 150, // Limit height of suggestions box
  // }
});

export default ChatInput;
