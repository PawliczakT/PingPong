//store/chatStore.ts
import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {LayoutAnimation, Platform, UIManager} from 'react-native';
import {trpcClient} from '@/backend/api/lib/trpc';
import type {ChatMessage} from '@/components/ChatMessageItem';
import {useAuthStore} from './authStore';

interface MentionPlayer {
    id: string;
    nickname: string;
    avatar_url: string | null;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

interface ChatState {
    messages: ChatMessage[];
    isLoadingMessages: boolean;
    isSendingMessage: boolean;
    isLoadingOlder: boolean;
    hasMoreMessages: boolean;
    connectionStatus: ConnectionStatus;
    mentionSuggestions: MentionPlayer[];
    currentMentionQuery: number | null;
    activeReactionMessageId: string | null;
    error: {
        type: 'connection' | 'send' | 'fetch' | 'reaction';
        message: string;
    } | null;
    lastFetchTime: number;
    isInitialized: boolean;
}

interface ChatActions {
    fetchInitialMessages: () => Promise<void>;
    fetchOlderMessages: () => Promise<void>;
    sendMessage: (content: string, currentUserId: string, profile: ChatMessage['profile']) => Promise<void>;
    addReaction: (messageId: string, emoji: string) => Promise<void>;
    removeReaction: (messageId: string, emoji: string) => Promise<void>;
    fetchMentionSuggestions: (query: string) => Promise<void>;
    setConnectionStatus: (status: ConnectionStatus) => void;
    addMessage: (message: ChatMessage, isNew?: boolean) => void;
    updateMessage: (updatedMessage: Partial<ChatMessage> & { id: string }) => void;
    setActiveReactionMessageId: (messageId: string | null) => void;
    clearError: () => void;
    resetMessages: () => void;
    optimizeMessages: () => void;
    preloadOlderMessages: () => Promise<void>;
}

class MessageCache {
    private cache = new Map<string, ChatMessage>();
    private readonly maxSize: number;
    private accessOrder: string[] = [];

    constructor(maxSize = 300) {
        this.maxSize = maxSize;
    }

    set(id: string, message: ChatMessage): void {
        const existingIndex = this.accessOrder.indexOf(id);
        if (existingIndex !== -1) {
            this.accessOrder.splice(existingIndex, 1);
        }
        this.accessOrder.unshift(id);
        this.cache.set(id, message);
        while (this.cache.size > this.maxSize) {
            const oldestId = this.accessOrder.pop();
            if (oldestId) {
                this.cache.delete(oldestId);
            }
        }
    }

    get(id: string): ChatMessage | undefined {
        const message = this.cache.get(id);
        if (message) {
            const index = this.accessOrder.indexOf(id);
            if (index > 0) {
                this.accessOrder.splice(index, 1);
                this.accessOrder.unshift(id);
            }
        }
        return message;
    }

    has(id: string): boolean {
        return this.cache.has(id);
    }

    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
    }

    size(): number {
        return this.cache.size;
    }

    getAll(): ChatMessage[] {
        return this.accessOrder.map(id => this.cache.get(id)).filter(Boolean) as ChatMessage[];
    }
}

const messageCache = new MessageCache(300);

const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

const throttle = <T extends (...args: any[]) => any>(func: T, limit: number): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

class MessageBatcher {
    private pendingMessages: ChatMessage[] = [];
    private batchTimeout: NodeJS.Timeout | null = null;
    private readonly batchSize = 10;
    private readonly batchDelay = 100;

    constructor(private onBatch: (messages: ChatMessage[]) => void) {
        console.log('🔄 MessageBatcher initialized');
    }

    add(message: ChatMessage): void {
        console.log('➕ Adding message to batch:', {
            id: message.id,
            type: message.message_type,
            currentBatchSize: this.pendingMessages.length + 1
        });

        this.pendingMessages.push(message);
        if (this.pendingMessages.length >= this.batchSize) {
            console.log(`🔄 Batch size reached (${this.batchSize}), flushing...`);
            this.flush();
        } else if (!this.batchTimeout) {
            console.log(`⏳ Scheduling batch flush in ${this.batchDelay}ms`);
            this.batchTimeout = setTimeout(() => {
                console.log('⏰ Batch timeout reached, flushing...');
                this.flush();
            }, this.batchDelay);
        }
    }

    private flush(): void {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        if (this.pendingMessages.length > 0) {
            console.log(`🚀 Flushing batch of ${this.pendingMessages.length} messages`);
            this.onBatch([...this.pendingMessages]);
            this.pendingMessages = [];
        } else {
            console.log('ℹ️ Nothing to flush - batch is empty');
        }
    }
}

const handleError = (error: any, type: ChatState['error']['type']): ChatState['error'] => {
    console.error(`❌ ${type} error:`, error);
    return {
        type,
        message: error?.message || `Failed: ${type}`
    };
};

export const useChatStore = create<ChatState & ChatActions>()(
    subscribeWithSelector((set, get) => {
        const messageBatcher = new MessageBatcher((messages: ChatMessage[]) => {
            set(state => {
                const newMessages = messages.filter(msg => !state.messages.some(existing => existing.id === msg.id));
                if (newMessages.length === 0) return state;
                newMessages.forEach(msg => messageCache.set(msg.id, msg));
                const combinedMessages = [...newMessages, ...state.messages]
                    .reduce((acc, msg) => {
                        if (!acc.some(existing => existing.id === msg.id)) acc.push(msg);
                        return acc;
                    }, [] as ChatMessage[])
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 100);
                return {...state, messages: combinedMessages};
            });
        });

        const debouncedFetchMentions = debounce(async (query: string, queryId: number) => {
            if (get().currentMentionQuery !== queryId) return;
            try {
                const players = await trpcClient.chat.getPlayersForMention.query({query});
                if (get().currentMentionQuery === queryId) {
                    set({mentionSuggestions: players as MentionPlayer[]});
                }
            } catch (error: any) {
                console.error('Failed to fetch mention suggestions:', error);
                if (get().currentMentionQuery === queryId) {
                    set({mentionSuggestions: [], currentMentionQuery: null});
                }
            }
        }, 300);

        const throttledLayoutAnimation = throttle(() => {
            if (Platform.OS !== 'web') {
                if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
                    UIManager.setLayoutAnimationEnabledExperimental(true);
                }
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }
        }, 100);

        return {
            messages: [],
            isLoadingMessages: false,
            isSendingMessage: false,
            isLoadingOlder: false,
            hasMoreMessages: true,
            connectionStatus: 'connecting',
            mentionSuggestions: [],
            currentMentionQuery: null,
            activeReactionMessageId: null,
            error: null,
            lastFetchTime: 0,
            isInitialized: false,

            fetchInitialMessages: async () => {
                const state = get();
                if (state.isLoadingMessages || state.isInitialized) return;

                set({isLoadingMessages: true, error: null});

                try {
                    console.log('📚 Fetching initial messages...');
                    const result = await trpcClient.chat.getMessages.query({limit: 20}) as {
                        messages: ChatMessage[],
                        nextCursor?: string
                    };

                    if (!result) throw new Error('No response from server');

                    const sortedMessages = [...(result.messages || [])].sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );

                    sortedMessages.forEach(msg => messageCache.set(msg.id, msg));

                    set({
                        messages: sortedMessages,
                        hasMoreMessages: !!result.nextCursor,
                        isLoadingMessages: false,
                        isInitialized: true,
                        lastFetchTime: Date.now()
                    });

                    console.log('✅ Successfully fetched', sortedMessages.length, 'messages');
                } catch (error: any) {
                    set({
                        isLoadingMessages: false,
                        error: handleError(error, 'fetch'),
                        isInitialized: true
                    });
                }
            },

            fetchOlderMessages: async () => {
                const state = get();
                if (state.isLoadingOlder || !state.hasMoreMessages) return;

                set({isLoadingOlder: true, error: null});

                try {
                    const oldestMessage = state.messages[state.messages.length - 1];
                    if (!oldestMessage) {
                        set({isLoadingOlder: false});
                        return;
                    }

                    console.log('📚 Fetching older messages...');
                    const result = await trpcClient.chat.getMessages.query({
                        cursor: oldestMessage.created_at,
                        limit: 20
                    }) as { messages: ChatMessage[], nextCursor?: string };

                    if (!result) throw new Error('No response from server');

                    const newMessages = result.messages.filter(msg => !messageCache.has(msg.id));
                    newMessages.forEach(msg => messageCache.set(msg.id, msg));

                    set(currentState => ({
                        messages: [...currentState.messages, ...newMessages.sort((a, b) =>
                            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        )],
                        hasMoreMessages: !!result.nextCursor,
                        isLoadingOlder: false,
                        lastFetchTime: Date.now(),
                    }));

                    console.log('✅ Fetched', newMessages.length, 'older messages');
                } catch (error: any) {
                    set({
                        isLoadingOlder: false,
                        error: handleError(error, 'fetch')
                    });
                }
            },

            sendMessage: async (content: string, currentUserId: string, profile: ChatMessage['profile']) => {
                set({isSendingMessage: true, error: null});

                try {
                    console.log('🚀 Sending message:', {content, currentUserId});

                    const tempMessage: ChatMessage = {
                        id: `temp-${Date.now()}`,
                        user_id: currentUserId,
                        message_content: content,
                        created_at: new Date().toISOString(),
                        message_type: 'user_message',
                        profile,
                        metadata: null,
                        reactions: null,
                    };

                    set(state => ({
                        messages: [tempMessage, ...state.messages.filter(m => !m.id.startsWith('temp-'))]
                    }));

                    const sentMessage = await trpcClient.chat.sendMessage.mutate({
                        message_content: content
                    }) as ChatMessage;

                    set(state => ({
                        messages: state.messages.map(msg =>
                            msg.id === tempMessage.id ? sentMessage : msg
                        ),
                        isSendingMessage: false
                    }));

                    messageCache.set(sentMessage.id, sentMessage);
                    console.log('✅ Message sent successfully:', sentMessage.id);

                } catch (error: any) {
                    console.error('❌ Failed to send message:', error);
                    set(state => ({
                        messages: state.messages.filter(m => !m.id.startsWith('temp-')),
                        error: handleError(error, 'send'),
                        isSendingMessage: false
                    }));
                    throw error;
                }
            },

            addReaction: async (messageId: string, emoji: string) => {
                const {user} = useAuthStore.getState();
                const currentUserId = user?.id;
                if (!currentUserId) return;

                try {
                    set(state => ({
                        messages: state.messages.map(msg => {
                            if (msg.id === messageId) {
                                const reactions = {...(msg.reactions || {})};
                                const users = reactions[emoji] || [];
                                if (!users.includes(currentUserId)) {
                                    reactions[emoji] = [...users, currentUserId];
                                }
                                return {...msg, reactions};
                            }
                            return msg;
                        })
                    }));

                    const updatedMessage = await trpcClient.chat.addReaction.mutate({
                        message_id: messageId,
                        emoji: emoji
                    }) as ChatMessage;

                    get().updateMessage(updatedMessage);
                    messageCache.set(updatedMessage.id, updatedMessage);

                } catch (error: any) {
                    set(state => ({
                        messages: state.messages.map(msg => {
                            if (msg.id === messageId) {
                                const reactions = {...(msg.reactions || {})};
                                const users = reactions[emoji] || [];
                                const filtered = users.filter(id => id !== currentUserId);
                                if (filtered.length === 0) {
                                    delete reactions[emoji];
                                } else {
                                    reactions[emoji] = filtered;
                                }
                                return {...msg, reactions};
                            }
                            return msg;
                        }),
                        error: handleError(error, 'reaction')
                    }));
                }
            },

            removeReaction: async (messageId: string, emoji: string) => {
                const {user} = useAuthStore.getState();
                const currentUserId = user?.id;
                if (!currentUserId) return;

                try {
                    set(state => ({
                        messages: state.messages.map(msg => {
                            if (msg.id === messageId) {
                                const reactions = {...(msg.reactions || {})};
                                const users = reactions[emoji] || [];
                                const filtered = users.filter(id => id !== currentUserId);
                                if (filtered.length === 0) {
                                    delete reactions[emoji];
                                } else {
                                    reactions[emoji] = filtered;
                                }
                                return {...msg, reactions};
                            }
                            return msg;
                        })
                    }));

                    const updatedMessage = await trpcClient.chat.removeReaction.mutate({
                        message_id: messageId,
                        emoji: emoji
                    }) as ChatMessage;

                    get().updateMessage(updatedMessage);
                    messageCache.set(updatedMessage.id, updatedMessage);

                } catch (error: any) {
                    set(state => ({
                        messages: state.messages.map(msg => {
                            if (msg.id === messageId) {
                                const reactions = {...(msg.reactions || {})};
                                const users = reactions[emoji] || [];
                                if (!users.includes(currentUserId)) {
                                    reactions[emoji] = [...users, currentUserId];
                                }
                                return {...msg, reactions};
                            }
                            return msg;
                        }),
                        error: handleError(error, 'reaction')
                    }));
                }
            },

            fetchMentionSuggestions: async (query: string) => {
                const currentQuery = query.trim().toLowerCase();
                if (!currentQuery || currentQuery.length < 1) {
                    set({mentionSuggestions: [], currentMentionQuery: null});
                    return;
                }
                const queryId = Date.now();
                set({currentMentionQuery: queryId});
                debouncedFetchMentions(currentQuery, queryId);
            },

            setConnectionStatus: (status: ConnectionStatus) => set({connectionStatus: status}),

            addMessage: (message: ChatMessage, isNew = true) => {
                console.log('📩 Adding message to chat store:', {
                    id: message.id,
                    type: message.message_type,
                    content: message.message_content?.substring(0, 50) + (message.message_content && message.message_content.length > 50 ? '...' : ''),
                    metadata: message.metadata
                });

                if (messageCache.has(message.id)) {
                    const cachedMessage = messageCache.get(message.id);
                    if (cachedMessage && JSON.stringify(cachedMessage) === JSON.stringify(message)) {
                        console.log('📭 Message already in cache, skipping');
                        return;
                    }
                }
                if (isNew) throttledLayoutAnimation();
                messageBatcher.add(message);
                console.log('✅ Message added to batch');
            },

            updateMessage: (updatedMessage: Partial<ChatMessage> & { id: string }) => {
                set(state => {
                    const updatedMessages = state.messages.map(msg => {
                        if (msg.id === updatedMessage.id) {
                            const newMsg = {...msg, ...updatedMessage};
                            messageCache.set(newMsg.id, newMsg);
                            return newMsg;
                        }
                        return msg;
                    });
                    return {messages: updatedMessages};
                });
            },

            setActiveReactionMessageId: (messageId: string | null) => set({activeReactionMessageId: messageId}),

            clearError: () => set({error: null}),

            resetMessages: () => {
                messageCache.clear();
                set({
                    messages: [],
                    hasMoreMessages: true,
                    isLoadingMessages: false,
                    isSendingMessage: false,
                    isLoadingOlder: false,
                    error: null,
                    mentionSuggestions: [],
                    currentMentionQuery: null,
                    activeReactionMessageId: null,
                    isInitialized: false,
                    lastFetchTime: 0,
                });
            },

            optimizeMessages: () => {
                set(state => {
                    const optimizedMessages = state.messages.slice(0, 100);
                    messageCache.clear();
                    optimizedMessages.forEach(msg => messageCache.set(msg.id, msg));
                    return {messages: optimizedMessages};
                });
            },

            preloadOlderMessages: async () => {
                const state = get();
                if (state.isLoadingOlder || !state.hasMoreMessages) return;

                try {
                    const oldestMessage = state.messages[state.messages.length - 1];
                    if (!oldestMessage) return;

                    const result = await trpcClient.chat.getMessages.query({
                        cursor: oldestMessage.created_at,
                        limit: 10
                    }) as { messages: ChatMessage[], nextCursor?: string };

                    if (result?.messages) {
                        result.messages.forEach(msg => messageCache.set(msg.id, msg));
                    }
                } catch (error) {
                    console.warn('Preload failed:', error);
                }
            },
        };
    })
);

if (__DEV__) {
    setInterval(() => {
        console.log(`💾 Message cache: ${messageCache.size()} messages cached`);
    }, 30000);

    useChatStore.subscribe(
        (state) => state.messages.length,
        (messageCount) => {
            console.log(`📊 Messages in store: ${messageCount}`);
        }
    );
}

export const getCacheStats = () => ({
    size: messageCache.size(),
    messages: messageCache.getAll().length,
});

console.log('✅ Optimized chat store created with caching and performance enhancements');
