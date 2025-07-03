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

// Store selectors
    const messages = useChatStore(state => state.messages);
    const isLoading = useChatStore(state => state.isLoading);
    const hasMoreMessages = useChatStore(state => state.hasMoreMessages);
    const activeReactionMessageId = useChatStore(state => state.activeReactionMessageId);
    const mentionSuggestions = useChatStore(state => state.mentionSuggestions);
    const error = useChatStore(state => state.error);

// Store actions
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

// Track message count changes for "new messages" button
    useEffect(() => {
        if (messages.length > previousMessageCount.current && isUserScrolledUp.current) {
            setShowNewMessagesButton(true);
        }
        previousMessageCount.current = messages.length;
    }, [messages.length]);

// Callbacks
    const handleSendMessage = useCallback(async (content: string) => {
        if (!currentUserId || !currentUserProfile) {
            console.error("User not authenticated, cannot send message.");
            Alert.alert('Authentication Error', 'Please log in to send messages.');
            return;
        }

        try {
            await sendMessage(content, currentUserId, currentUserProfile);
            setInputText('');
            useChatStore.setState({mentionSuggestions: []});
        } catch (error: any) {
            console.error('Failed to send message:', error);
            Alert.alert('Send Error', `Failed to send message: ${error?.message || 'Unknown error'}`);
        }
    }, [sendMessage, currentUserId]);

    const handleInputTextChange = useCallback((text: string) => {
        setInputText(text);
    }, []);

    const handleMentionQueryChange = useCallback((query: string | null) => {
        if (query) {
            fetchMentionSuggestions(query);
        } else {
            useChatStore.setState({mentionSuggestions: []});
        }
    }, [fetchMentionSuggestions]);

    const handleSelectSuggestion = useCallback((nickname: string) => {
        setInputText(prevText => {
            const parts = prevText.split(/\s+/);
            parts.pop();
            return `${parts.join(' ')} @${nickname} `.trimStart();
        });
        useChatStore.setState({mentionSuggestions: []});
    }, []);

    const handleLoadOlderMessages = useCallback(() => {
        if (!isLoading && hasMoreMessages) {
            fetchOlderMessages();
        }
    }, [isLoading, hasMoreMessages, fetchOlderMessages]);

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
            Alert.alert('Reaction Error', 'Failed to update reaction');
        }
    }, [activeReactionMessageId, currentUserId, messages, addReaction, removeReaction, setActiveReactionMessageId]);

    const handleScrollToBottom = useCallback(() => {
        flatListRef.current?.scrollToOffset({offset: 0, animated: true});
        setShowNewMessagesButton(false);
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
        } catch (error) {
            console.error('Retry failed:', error);
            Alert.alert('Retry Error', 'Failed to reconnect. Please try again.');
        }
    }, [clearError, resetMessages, reconnect]);

// Development only - backend test
    const testBackend = useCallback(async () => {
        if (!__DEV__) return;

        try {
            console.log('🧪 Testing backend...');
            const result = await trpcClient.chat.test.query();
            console.log('🧪 Backend test result:', result);

            Alert.alert(
                'Backend Test',
                // @ts-ignore
                result.success ? '✅ Backend is working!' : `❌ Error: ${result.error}`,
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

// Render functions
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
        if (isLoading && messages.length === 0) {
            return <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator}/>;
        }
        if (hasMoreMessages && messages.length > 0 && isLoading) {
            return <ActivityIndicator size="small" color={colors.primary} style={styles.loadingOlderIndicator}/>;
        }
        return null;
    }, [isLoading, messages.length, hasMoreMessages, colors.primary]);

    const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

// Error state
    if (error && messages.length === 0) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent, {backgroundColor: colors.background}]}>
                <Stack.Screen options={{title: 'Chat - Error'}}/>
                <Text style={[styles.errorText, {color: colors.text}]}>
                    {error}
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
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    initialNumToRender={15}
                />

                {/* New Messages Button */}
                {showNewMessagesButton && (
                    <RNTouchableOpacity
                        style={[styles.newMessagesButton, {backgroundColor: colors.primary}]}
                        onPress={handleScrollToBottom}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.newMessagesButtonText}>New Messages</Text>
                    </RNTouchableOpacity>
                )}

                {/* Mention Suggestions */}
                {mentionSuggestions.length > 0 && !showNewMessagesButton && (
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
                    isLoading={connectionStatus !== 'connected'}
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
    keyboardAvoidingView: {
        flex: 1,
    },
    messageList: {
        flex: 1,
    },
    messageListContent: {
        paddingVertical: 8,
    },
    loadingIndicator: {
        marginTop: 20,
    },
    loadingOlderIndicator: {
        paddingVertical: 10,
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
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
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
