import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity as RNTouchableOpacity } from 'react-native'; // Renamed TouchableOpacity
import { useTheme } from '@react-navigation/native';
import ChatMessageItem, { ChatMessage } from '@/components/ChatMessageItem';
import ChatInput from '@/components/ChatInput';
import Button from '@/components/Button'; // Import Button
import ReactionPicker from '@/components/ReactionPicker';
import MentionSuggestionsOverlay from '@/components/MentionSuggestionsOverlay'; // Import MentionSuggestionsOverlay
import { useChatStore } from '@/store/chatStore';
import useChatRealtime from '@/hooks/useChatRealtime';
import { useAuth } from '@/store/authStore'; // To get current user
// import { trpc } from '@/lib/trpc'; // For direct calls if needed, but prefer store actions

const ChatScreen = () => {
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const { user } = useAuth();
  const currentUserId = user?.id;
  const currentUserProfile = user ? { id: user.id, nickname: user.user_metadata?.nickname || 'You', avatar_url: user.user_metadata?.avatar_url || null } : null;

  const store = useChatStore(); // Get full store instance for easier access in scroll handlers
  const {
    messages,
    isLoading,
    hasMoreMessages,
    connectionStatus,
    activeReactionMessageId,
    mentionSuggestions,
    error,
    fetchInitialMessages,
    fetchOlderMessages,
    sendMessage,
    addReaction,
    removeReaction,
    fetchMentionSuggestions,
    setActiveReactionMessageId,
    clearError,
  } = store;

  const [inputText, setInputText] = useState('');
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);
  const isUserScrolledUp = useRef(false);
  const previousMessageCount = useRef(messages.length);


  // Setup Realtime connection & listen for new messages to show button
  useChatRealtime();

  useEffect(() => {
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  useEffect(() => {
    // Check if new messages have arrived AND user is scrolled up
    if (messages.length > previousMessageCount.current && isUserScrolledUp.current) {
      setShowNewMessagesButton(true);
    }
    previousMessageCount.current = messages.length;
  }, [messages]);


  const handleSendMessage = useCallback(async (content: string) => {
    if (!currentUserId || !currentUserProfile) {
      console.error("User not authenticated, cannot send message.");
      return;
    }
    await sendMessage(content, currentUserId, currentUserProfile);
    setInputText(''); // Clear input after sending
    useChatStore.setState({ mentionSuggestions: [] }); // Clear mention suggestions
  }, [sendMessage, currentUserId, currentUserProfile]);

  const handleInputTextChange = (text: string) => {
    setInputText(text);
  };

  const handleMentionQueryChange = useCallback((query: string | null) => {
    if (query) {
      fetchMentionSuggestions(query);
    } else {
      useChatStore.setState({ mentionSuggestions: [] }); // Clear suggestions
    }
  }, [fetchMentionSuggestions]);

  const handleSelectSuggestion = (nickname: string) => {
    setInputText(prevText => {
      const parts = prevText.split(/\s+/);
      parts.pop(); // Remove the @query part
      return `${parts.join(' ')} @${nickname} `.trimStart();
    });
    useChatStore.setState({ mentionSuggestions: [] }); // Clear suggestions
  };

  const handleLoadOlderMessages = () => {
    if (!isLoading && hasMoreMessages) {
      fetchOlderMessages();
    }
  };

  const handleToggleReactionPicker = (messageId: string) => {
    if (activeReactionMessageId === messageId) {
      setActiveReactionMessageId(null); // Close if already open for this message
    } else {
      setActiveReactionMessageId(messageId);
    }
  };

  const handleSelectEmoji = async (emoji: string) => {
    if (activeReactionMessageId) {
      // Determine if user has already reacted with this emoji to remove it, otherwise add
      // This logic might be complex here; for now, let's assume we always add.
      // Or, the store/backend handles the add/remove logic based on current state.
      // For simplicity, let's say addReaction in store handles toggle logic or we need separate toggle action

      const message = messages.find(m => m.id === activeReactionMessageId);
      const userReacted = message?.reactions?.[emoji]?.includes(currentUserId || '');

      if (userReacted) {
        await removeReaction(activeReactionMessageId, emoji);
      } else {
        await addReaction(activeReactionMessageId, emoji);
      }
      setActiveReactionMessageId(null); // Close picker after selection
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <TouchableOpacity onLongPress={() => item.message_type === 'user_message' && handleToggleReactionPicker(item.id)} delayLongPress={300}>
      <ChatMessageItem
        message={item}
        currentUserId={currentUserId}
        // Pass down reaction handling props if ChatMessageItem directly calls mutations
        // onToggleReaction={ (messageId, emoji) => { /* call store action */ }}
      />
    </TouchableOpacity>
  );

  const renderHeader = () => {
    if (isLoading && messages.length === 0) { // Initial load
      return <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} />;
    }
    if (hasMoreMessages && messages.length > 0) { // Loading older messages indicator
        return isLoading ? <ActivityIndicator size="small" color={colors.primary} style={styles.loadingOlderIndicator} /> : null;
    }
    return null;
  };

  if (error && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{color: colors.text, marginBottom: 10}}>Error: {error}</Text>
        <Button
          title="Retry"
          onPress={() => { clearError(); fetchInitialMessages(); }}
          variant="primary"
          size="medium"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Community Chat ({connectionStatus})
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} // Adjust based on actual header height
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          inverted
          contentContainerStyle={styles.messageListContent}
          onEndReached={handleLoadOlderMessages}
          onEndReachedThreshold={0.8}
          ListHeaderComponent={renderHeader}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            const yOffset = event.nativeEvent.contentOffset.y;
            // If scrolled more than, e.g., 300px from the bottom (which is yOffset > 300 for inverted list)
            isUserScrolledUp.current = yOffset > 300;
            if (!isUserScrolledUp.current && showNewMessagesButton) {
              setShowNewMessagesButton(false); // Auto-hide if user scrolls back to bottom
            }
          }}
          scrollEventThrottle={100} // How often scroll event fires
        />

        {/* New Messages Button Overlay */}
        {showNewMessagesButton && (
          <RNTouchableOpacity
            style={[styles.newMessagesButton, {backgroundColor: colors.primary}]}
            onPress={() => {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
              setShowNewMessagesButton(false);
            }}
          >
            <Text style={styles.newMessagesButtonText}>New Messages</Text>
          </RNTouchableOpacity>
        )}

        {mentionSuggestions.length > 0 && !showNewMessagesButton && ( // Hide mentions if new message button is shown
          <MentionSuggestionsOverlay
            suggestions={mentionSuggestions}
            onSelectSuggestion={handleSelectSuggestion}
            isVisible={mentionSuggestions.length > 0}
          />
        )}

        <ChatInput
          value={inputText}
          onChangeText={handleInputTextChange}
          onSendMessage={handleSendMessage}
          onMentionQueryChange={handleMentionQueryChange}
          isLoading={isLoading && messages.length === 0}
        />
      </KeyboardAvoidingView>

      {activeReactionMessageId && (
        <ReactionPicker
          isVisible={!!activeReactionMessageId}
          onSelectEmoji={handleSelectEmoji}
          onDismiss={() => setActiveReactionMessageId(null)}
          // Adjusted position to be above ChatInput and potential NewMessagesButton
          position={{ bottom: Platform.OS === 'ios' ? (showNewMessagesButton ? 130 : 90) : (showNewMessagesButton ? 110 : 70) , alignSelf: 'center' }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: 8,
    //flexGrow: 1, // Important for inverted list to start from bottom
  },
  loadingIndicator: {
    marginTop: 20,
  },
  loadingOlderIndicator: {
    paddingVertical: 10,
  },
  newMessagesButton: {
    position: 'absolute',
    bottom: 70, // Adjust based on ChatInput height
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  newMessagesButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  }
});

export default ChatScreen;
