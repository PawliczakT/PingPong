//app/(tabs)/chat.tsx
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity as RNTouchableOpacity,
    TouchableOpacity,
    View
} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {Stack} from 'expo-router';
import ChatMessageItem, {ChatMessage} from '@/components/ChatMessageItem';
import ChatInput from '@/components/ChatInput';
import Button from '@/components/Button';
import ReactionPicker from '@/components/ReactionPicker';
import MentionSuggestionsOverlay from '@/components/MentionSuggestionsOverlay';
import {useChatStore} from '@/store/chatStore';
import {useChatRealtime} from '@/hooks/useChatRealtime';
import {useAuth} from '@/store/authStore';
import {trpcClient} from "@/backend/api/lib/trpc";

const ChatScreen = () => {
    const {colors} = useTheme();
    const flatListRef = useRef<FlatList<ChatMessage>>(null);
    const isUserScrolledUp = useRef(false);
    const previousMessageCount = useRef(0);
    const [inputText, setInputText] = useState('');
    const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);
    const [showTestButton, setShowTestButton] = useState(__DEV__);

    // Auth
    const {user} = useAuth();
    const currentUserId = user?.id;
    const currentUserProfile = user ? {
        id: user.id,
        nickname: user.user_metadata?.nickname || user.user_metadata?.full_name || 'You',
        avatar_url: user.user_metadata?.avatar_url || null
    } : null;

    // ✅ Store selectors - updated to use new state structure
    const messages = useChatStore(state => state.messages);
    const isLoadingMessages = useChatStore(state => state.isLoadingMessages);
    const isSendingMessage = useChatStore(state => state.isSendingMessage);
    const isLoadingOlder = useChatStore(state => state.isLoadingOlder);
    const hasMoreMessages = useChatStore(state => state.hasMoreMessages);
    const activeReactionMessageId = useChatStore(state => state.activeReactionMessageId);
    const mentionSuggestions = useChatStore(state => state.mentionSuggestions);
    const error = useChatStore(state => state.error);
    const isInitialized = useChatStore(state => state.isInitialized);

    // Store actions
    const fetchInitialMessages = useChatStore(state => state.fetchInitialMessages);
    const fetchOlderMessages = useChatStore(state => state.fetchOlderMessages);
    const sendMessage = useChatStore(state => state.sendMessage);
    const addReaction = useChatStore(state => state.addReaction);
    const removeReaction = useChatStore(state => state.removeReaction);
    const fetchMentionSuggestions = useChatStore(state => state.fetchMentionSuggestions);
    const setActiveReactionMessageId = useChatStore(state => state.setActiveReactionMessageId);
    const clearError = useChatStore(state => state.clearError);
    const resetMessages = useChatStore(state => state.resetMessages);

    // Setup Realtime connection
    const {connectionStatus, reconnect} = useChatRealtime();

    // ✅ Initialize chat on component mount
    useEffect(() => {
        if (!isInitialized && currentUserId) {
            fetchInitialMessages();
        }
    }, [isInitialized, currentUserId, fetchInitialMessages]);

    // Track message count changes for "new messages" button
    useEffect(() => {
        if (messages.length > previousMessageCount.current && isUserScrolledUp.current) {
            setShowNewMessagesButton(true);
        }
        previousMessageCount.current = messages.length;
    }, [messages.length]);

    // ✅ Auto-scroll to bottom when sending message
    useEffect(() => {
        if (isSendingMessage && !isUserScrolledUp.current) {
            // Small delay to ensure message is in the list
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({offset: 0, animated: true});
            }, 100);
        }
    }, [isSendingMessage]);

    // Callbacks
    const handleSendMessage = useCallback(async (content: string) => {
        if (!currentUserId || !currentUserProfile) {
            console.error("User not authenticated, cannot send message.");
            Alert.alert('Authentication Error', 'Please log in to send messages.');
            return;
        }

        if (content.trim().length === 0) {
            return;
        }

        try {
            await sendMessage(content.trim(), currentUserId, currentUserProfile);
            setInputText('');
            // Clear mention suggestions
            useChatStore.setState({mentionSuggestions: [], currentMentionQuery: null});
        } catch (error: any) {
            console.error('Failed to send message:', error);
            Alert.alert('Send Error', `Failed to send message: ${error?.message || 'Unknown error'}`);
        }
    }, [sendMessage, currentUserId, currentUserProfile]);

    const handleInputTextChange = useCallback((text: string) => {
        setInputText(text);
    }, []);

    const handleMentionQueryChange = useCallback((query: string) => {
        if (query && query.length > 0) {
            fetchMentionSuggestions(query);
        } else {
            useChatStore.setState({mentionSuggestions: [], currentMentionQuery: null});
        }
    }, [fetchMentionSuggestions]);

    const handleSelectSuggestion = useCallback((nickname: string) => {
        setInputText(prevText => {
            const parts = prevText.split(/\s+/);
            parts.pop(); // Remove the partial mention
            return `${parts.join(' ')} @${nickname} `.trimStart();
        });
        useChatStore.setState({mentionSuggestions: [], currentMentionQuery: null});
    }, []);

    const handleLoadOlderMessages = useCallback(() => {
        if (!isLoadingOlder && hasMoreMessages && messages.length > 0) {
            fetchOlderMessages();
        }
    }, [isLoadingOlder, hasMoreMessages, fetchOlderMessages, messages.length]);

    const handleToggleReactionPicker = useCallback((messageId: string) => {
        setActiveReactionMessageId(
            activeReactionMessageId === messageId ? null : messageId
        );
    }, [activeReactionMessageId, setActiveReactionMessageId]);

    const handleSelectEmoji = useCallback(async (emoji: string) => {
        if (!activeReactionMessageId || !currentUserId) return;

        try {
            const message = messages.find(m => m.id === activeReactionMessageId);
            const userReacted = message?.reactions?.[emoji]?.includes(currentUserId);

            if (userReacted) {
                await removeReaction(activeReactionMessageId, emoji);
            } else {
                await addReaction(activeReactionMessageId, emoji);
            }
            setActiveReactionMessageId(null);
        } catch (error) {
            console.error('Failed to toggle reaction:', error);
            Alert.alert('Reaction Error', 'Failed to update reaction. Please try again.');
        }
    }, [activeReactionMessageId, currentUserId, messages, addReaction, removeReaction, setActiveReactionMessageId]);

    const handleScrollToBottom = useCallback(() => {
        flatListRef.current?.scrollToOffset({offset: 0, animated: true});
        setShowNewMessagesButton(false);
        isUserScrolledUp.current = false;
    }, []);

    const handleScroll = useCallback((event: any) => {
        const yOffset = event.nativeEvent.contentOffset.y;
        isUserScrolledUp.current = yOffset > 300;

        if (!isUserScrolledUp.current && showNewMessagesButton) {
            setShowNewMessagesButton(false);
        }
    }, [showNewMessagesButton]);

    const handleRetry = useCallback(async () => {
        try {
            clearError();
            resetMessages();
            await reconnect();
            // Re-fetch initial messages after reconnect
            setTimeout(() => {
                fetchInitialMessages();
            }, 1000);
        } catch (error) {
            console.error('Retry failed:', error);
            Alert.alert('Retry Error', 'Failed to reconnect. Please try again.');
        }
    }, [clearError, resetMessages, reconnect, fetchInitialMessages]);

    // Development only - backend test
    const testBackend = useCallback(async () => {
        if (!__DEV__) return;

        try {
            console.log('🧪 Testing backend...');
            const result = await trpcClient.chat.test.query();
            console.log('🧪 Backend test result:', result);

            Alert.alert(
                'Backend Test',
                result?.success ? '✅ Backend is working!' : `❌ Error: ${result?.message || 'Unknown error'}`,
                [
                    {text: 'OK'},
                    {text: 'Hide Test Button', onPress: () => setShowTestButton(false)}
                ]
            );
        } catch (error: any) {
            console.error('🧪 Backend test failed:', error);
            Alert.alert('Backend Test Failed', `❌ ${error.message}`);
        }
    }, []);

    // ✅ Optimized render functions
    const renderItem = useCallback(({item}: { item: ChatMessage }) => (
        <TouchableOpacity
            onLongPress={() => item.message_type === 'user_message' && handleToggleReactionPicker(item.id)}
            delayLongPress={300}
            activeOpacity={0.95}
        >
            <ChatMessageItem
                message={item}
                currentUserId={currentUserId}
            />
        </TouchableOpacity>
    ), [handleToggleReactionPicker, currentUserId]);

    const renderHeader = useCallback(() => {
        // Loading initial messages
        if (isLoadingMessages && messages.length === 0) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary}/>
                    <Text style={[styles.loadingText, {color: colors.text}]}>
                        Loading messages...
                    </Text>
                </View>
            );
        }

        // Loading older messages
        if (isLoadingOlder && messages.length > 0) {
            return (
                <View style={styles.loadingOlderContainer}>
                    <ActivityIndicator size="small" color={colors.primary}/>
                    <Text style={[styles.loadingOlderText, {color: colors.text}]}>
                        Loading older messages...
                    </Text>
                </View>
            );
        }

        return null;
    }, [isLoadingMessages, isLoadingOlder, messages.length, colors.primary, colors.text]);

    const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

    // ✅ Error state with proper error object handling
    if (error && messages.length === 0) {
        const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error occurred';

        return (
            <SafeAreaView style={[styles.container, styles.centerContent, {backgroundColor: colors.background}]}>
                <Stack.Screen options={{title: 'Chat - Error'}}/>
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorTitle, {color: colors.text}]}>
                        Connection Error
                    </Text>
                    <Text style={[styles.errorText, {color: colors.text}]}>
                        {errorMessage}
                    </Text>
                    <Button
                        title="Retry Connection"
                        onPress={handleRetry}
                        variant="primary"
                        size="medium"
                    />
                    {showTestButton && (
                        <Button
                            title="🧪 Test Backend"
                            onPress={testBackend}
                            variant="secondary"
                            size="small"
                            style={styles.testButton}
                        />
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // ✅ Loading state for initial load
    if (!isInitialized && isLoadingMessages) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent, {backgroundColor: colors.background}]}>
                <Stack.Screen options={{title: 'Community Chat'}}/>
                <ActivityIndicator size="large" color={colors.primary}/>
                <Text style={[styles.loadingText, {color: colors.text}]}>
                    Connecting to chat...
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
            <Stack.Screen options={{
                title: 'Community Chat',
                headerRight: () => showTestButton ? (
                    <TouchableOpacity onPress={testBackend} style={styles.testHeaderButton}>
                        <Text style={styles.testHeaderButtonText}>🧪</Text>
                    </TouchableOpacity>
                ) : null
            }}/>

            <View style={[styles.header, {borderBottomColor: colors.border}]}>
                <Text style={[styles.headerTitle, {color: colors.text}]}>
                    Community Chat
                </Text>
                <View style={styles.statusContainer}>
                    <View style={[
                        styles.statusDot,
                        {backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : '#FF5722'}
                    ]}/>
                    <Text style={[styles.connectionStatus, {color: colors.text}]}>
                        {connectionStatus}
                    </Text>
                    {error && (
                        <TouchableOpacity onPress={clearError} style={styles.clearErrorButton}>
                            <Text style={[styles.clearErrorText, {color: colors.primary}]}>
                                ✕
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
                keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    style={styles.messageList}
                    inverted
                    contentContainerStyle={styles.messageListContent}
                    onEndReached={handleLoadOlderMessages}
                    onEndReachedThreshold={0.8}
                    ListHeaderComponent={renderHeader}
                    keyboardShouldPersistTaps="handled"
                    onScroll={handleScroll}
                    scrollEventThrottle={100}
                    removeClippedSubviews={Platform.OS === 'android'}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    initialNumToRender={15}
                    getItemLayout={undefined} // Better for dynamic content
                />

                {/* New Messages Button */}
                {showNewMessagesButton && (
                    <RNTouchableOpacity
                        style={[styles.newMessagesButton, {backgroundColor: colors.primary}]}
                        onPress={handleScrollToBottom}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.newMessagesButtonText}>
                            New Messages ↓
                        </Text>
                    </RNTouchableOpacity>
                )}

                {/* Mention Suggestions */}
                {mentionSuggestions.length > 0 && (
                    <MentionSuggestionsOverlay
                        suggestions={mentionSuggestions}
                        onSelectSuggestion={handleSelectSuggestion}
                        isVisible={mentionSuggestions.length > 0}
                    />
                )}

                {/* ✅ Updated ChatInput with proper props */}
                <ChatInput
                    value={inputText}
                    onChangeText={handleInputTextChange}
                    onSendMessage={handleSendMessage}
                    onMentionQueryChange={handleMentionQueryChange}
                    isLoading={isLoadingMessages}
                    isSending={isSendingMessage}
                    isDisconnected={connectionStatus !== 'connected'}
                />
            </KeyboardAvoidingView>

            {/* Reaction Picker */}
            {activeReactionMessageId && (
                <ReactionPicker
                    isVisible={!!activeReactionMessageId}
                    onSelectEmoji={handleSelectEmoji}
                    onDismiss={() => setActiveReactionMessageId(null)}
                    position={{
                        bottom: Platform.OS === 'ios'
                            ? (showNewMessagesButton ? 130 : 90)
                            : (showNewMessagesButton ? 110 : 70),
                        alignSelf: 'center'
                    }}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
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
        marginBottom: 4,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    connectionStatus: {
        fontSize: 12,
        textTransform: 'capitalize',
    },
    clearErrorButton: {
        marginLeft: 8,
        padding: 4,
    },
    clearErrorText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    messageList: {
        flex: 1,
    },
    messageListContent: {
        paddingVertical: 8,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
    },
    loadingOlderContainer: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    loadingOlderText: {
        marginTop: 5,
        fontSize: 12,
        opacity: 0.7,
    },
    newMessagesButton: {
        position: 'absolute',
        bottom: 70,
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    newMessagesButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    errorContainer: {
        alignItems: 'center',
        padding: 20,
        maxWidth: '90%',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    testButton: {
        marginTop: 10,
    },
    testHeaderButton: {
        padding: 8,
        marginRight: 8,
    },
    testHeaderButtonText: {
        fontSize: 16,
    },
});

export default ChatScreen;
