// tests/store/chatStore.test.ts

// Mock react-native UI specific modules before any imports
jest.mock('react-native', () => ({
    LayoutAnimation: {
        configureNext: jest.fn(),
        Presets: {easeInEaseOut: {}}
    },
    UIManager: {setLayoutAnimationEnabledExperimental: jest.fn()},
    Platform: {OS: 'web'},
}));

// Mock trpcClient before chatStore import
const mockGetMessages = jest.fn();
const mockSendMessage = jest.fn();
const mockAddReaction = jest.fn();
const mockRemoveReaction = jest.fn();
const mockGetPlayersForMention = jest.fn();

jest.mock('@/backend/api/lib/trpc', () => ({
    trpcClient: {
        chat: {
            getMessages: {
                query: jest.fn((params) => mockGetMessages(params)),  // Wrapper który wywołuje mock
            },
            sendMessage: {
                mutate: jest.fn((params) => mockSendMessage(params)),  // Wrapper który wywołuje mock
            },
            addReaction: {
                mutate: jest.fn((params) => mockAddReaction(params)),
            },
            removeReaction: {
                mutate: jest.fn((params) => mockRemoveReaction(params)),
            },
            getPlayersForMention: {
                query: jest.fn((params) => mockGetPlayersForMention(params)),
            },
        },
    },
}));

// Mock authStore aby uniknąć problemów z zależnościami
jest.mock('@/store/authStore', () => ({
    useAuthStore: {
        getState: jest.fn(() => ({
            user: {id: 'test-user-id'}
        }))
    }
}));

// Now import modules that depend on the mocks
import {useChatStore} from '@/store/chatStore';
import {ChatMessage} from '@/components/ChatMessageItem';

// Helper to build a ChatMessage
const createMessage = (id: string, content = `Message ${id}`): ChatMessage => ({
    id,
    user_id: 'u1',
    message_content: content,
    created_at: new Date().toISOString(),
    message_type: 'user_message',
    profile: null,
    metadata: null,
    reactions: null,
});

describe('chatStore basic functionality', () => {
    beforeEach(() => {
        // Reset store state kompletnie
        useChatStore.getState().resetMessages();

        // Clear all mocks
        jest.clearAllMocks();

        // Upewnij się, że store jest w czystym stanie
        const state = useChatStore.getState();
        expect(state.isInitialized).toBe(false);
        expect(state.isLoadingMessages).toBe(false);
    });

    it('addMessage should add and deduplicate messages', () => {
        jest.useFakeTimers();
        const msg = createMessage('1');
        useChatStore.getState().addMessage(msg, false); // skip animation
        jest.runAllTimers();

        expect(useChatStore.getState().messages).toHaveLength(1);

        // Add duplicate
        useChatStore.getState().addMessage(msg, false);
        jest.runAllTimers();
        expect(useChatStore.getState().messages).toHaveLength(1);
        jest.useRealTimers();
    });

    it('updateMessage should update existing message content', () => {
        jest.useFakeTimers();
        const msg = createMessage('1');
        useChatStore.getState().addMessage(msg, false);
        jest.runAllTimers();

        useChatStore.getState().updateMessage({id: '1', message_content: 'Updated'});
        const updated = useChatStore.getState().messages.find(m => m.id === '1');
        expect(updated?.message_content).toBe('Updated');
        jest.useRealTimers();
    });

    it('resetMessages should clear store state', () => {
        jest.useFakeTimers();
        const msg = createMessage('1');
        useChatStore.getState().addMessage(msg, false);
        jest.runAllTimers();
        expect(useChatStore.getState().messages.length).toBe(1);

        useChatStore.getState().resetMessages();
        expect(useChatStore.getState().messages.length).toBe(0);
        expect(useChatStore.getState().isInitialized).toBe(false);
        jest.useRealTimers();
    });

    it('setConnectionStatus should update connectionStatus', () => {
        useChatStore.getState().setConnectionStatus('connected');
        expect(useChatStore.getState().connectionStatus).toBe('connected');
    });

    it('fetchInitialMessages should load messages from API', async () => {
        // Nie używaj fake timers dla tego testu - mogą zakłócać async operacje
        const srvMsg = createMessage('srv1', 'Hello from server');
        mockGetMessages.mockResolvedValueOnce({
            messages: [srvMsg],
            nextCursor: undefined
        });

        await useChatStore.getState().fetchInitialMessages();

        expect(mockGetMessages).toHaveBeenCalledWith({limit: 20});
        expect(useChatStore.getState().messages).toHaveLength(1);
        expect(useChatStore.getState().messages[0].id).toBe('srv1');
        expect(useChatStore.getState().isInitialized).toBe(true);
    });

    it('should handle fetchInitialMessages error', async () => {
        const error = new Error('Network error');
        mockGetMessages.mockRejectedValueOnce(error);

        await useChatStore.getState().fetchInitialMessages();

        expect(mockGetMessages).toHaveBeenCalledWith({limit: 20});
        expect(useChatStore.getState().isInitialized).toBe(true);
        expect(useChatStore.getState().error).toEqual({
            type: 'fetch',
            message: 'Network error'
        });
    });

    it('should not fetch messages if already initialized', async () => {
        // Ustaw store jako zainicjalizowany
        useChatStore.setState({isInitialized: true});

        await useChatStore.getState().fetchInitialMessages();

        expect(mockGetMessages).not.toHaveBeenCalled();
    });

    it('should fetch older messages', async () => {
        // Dodaj początkową wiadomość
        const initialMsg = createMessage('initial', 'Initial message');
        useChatStore.setState({
            messages: [initialMsg],
            hasMoreMessages: true,
            isInitialized: true
        });

        const olderMsg = createMessage('older', 'Older message');
        mockGetMessages.mockResolvedValueOnce({
            messages: [olderMsg],
            nextCursor: undefined
        });

        await useChatStore.getState().fetchOlderMessages();

        expect(mockGetMessages).toHaveBeenCalledWith({
            cursor: initialMsg.created_at,
            limit: 20
        });
        expect(useChatStore.getState().messages).toHaveLength(2);
        expect(useChatStore.getState().hasMoreMessages).toBe(false);
    });

    it('should send message successfully', async () => {
        const sentMessage = createMessage('sent1', 'Sent message');
        mockSendMessage.mockResolvedValueOnce(sentMessage);

        await useChatStore.getState().sendMessage(
            'Test content',
            'user1',
            {
                nickname: 'TestUser',
                avatar_url: null,
                id: ''
            }
        );

        expect(mockSendMessage).toHaveBeenCalledWith({
            message_content: 'Test content'
        });
        expect(useChatStore.getState().isSendingMessage).toBe(false);
        expect(useChatStore.getState().messages).toHaveLength(1);
        expect(useChatStore.getState().messages[0].id).toBe('sent1');
    });

    it('should handle send message error', async () => {
        const error = new Error('Send failed');
        mockSendMessage.mockRejectedValueOnce(error);

        await expect(useChatStore.getState().sendMessage(
            'Test content',
            'user1',
            {
                nickname: 'TestUser',
                avatar_url: null,
                id: ''
            }
        )).rejects.toThrow('Send failed');

        expect(useChatStore.getState().isSendingMessage).toBe(false);
        expect(useChatStore.getState().error).toEqual({
            type: 'send',
            message: 'Send failed'
        });
    });

// Dodaj testy dla reakcji
    it('should add reaction to message', async () => {
        const reactionData = {messageId: 'msg1', emoji: '👍'};
        mockAddReaction.mockResolvedValueOnce(reactionData);

        await useChatStore.getState().addReaction('msg1', '👍');

        expect(mockAddReaction).toHaveBeenCalledWith({
            messageId: 'msg1',
            emoji: '👍'
        });
    });

    it('should handle add reaction error', async () => {
        const error = new Error('Failed to add reaction');
        mockAddReaction.mockRejectedValueOnce(error);

        await expect(
            useChatStore.getState().addReaction('msg1', '👍')
        ).rejects.toThrow('Failed to add reaction');
    });

    it('should remove reaction from message', async () => {
        mockRemoveReaction.mockResolvedValueOnce({});

        await useChatStore.getState().removeReaction('msg1', '👍');

        expect(mockRemoveReaction).toHaveBeenCalledWith({
            messageId: 'msg1',
            emoji: '👍'
        });
    });

    it('should handle remove reaction error', async () => {
        const error = new Error('Failed to remove reaction');
        mockRemoveReaction.mockRejectedValueOnce(error);

        await expect(
            useChatStore.getState().removeReaction('msg1', '👍')
        ).rejects.toThrow('Failed to remove reaction');
    });

    it('should fetch players for mention', async () => {
        jest.useFakeTimers();

        const players = [
            {id: 'p1', nickname: 'Player1'},
            {id: 'p2', nickname: 'Player2'}
        ];
        mockGetPlayersForMention.mockResolvedValueOnce(players);

        await useChatStore.getState().fetchMentionSuggestions('Pl');

        // Advance timers to allow debounced fetch to execute (300ms debounce)
        jest.advanceTimersByTime(350);
        // Wait for promises/microtasks to resolve
        await Promise.resolve();

        expect(mockGetPlayersForMention).toHaveBeenCalled();
        expect(useChatStore.getState().mentionSuggestions).toEqual(players);

        jest.useRealTimers();
    });
});
