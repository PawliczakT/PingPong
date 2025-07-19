// __tests__/store/chatStore.test.ts
jest.mock('react-native', () => ({
    LayoutAnimation: {
        configureNext: jest.fn(),
        Presets: {easeInEaseOut: {}}
    },
    UIManager: {setLayoutAnimationEnabledExperimental: jest.fn()},
    Platform: {OS: 'web'},
}));

jest.useFakeTimers();
const mockGetMessages = jest.fn();
const mockSendMessage = jest.fn();
const mockAddReaction = jest.fn();
const mockRemoveReaction = jest.fn();
const mockGetPlayersForMention = jest.fn();

jest.mock('@/backend/api/lib/trpc', () => ({
    trpcClient: {
        chat: {
            getMessages: {
                query: jest.fn((params) => mockGetMessages(params)),
            },
            sendMessage: {
                mutate: jest.fn((params) => mockSendMessage(params)),
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

jest.mock('@/store/authStore', () => ({
    useAuthStore: {
        getState: jest.fn(() => ({
            user: {id: 'test-user-id'}
        }))
    }
}));

import {useChatStore} from '@/store/chatStore';
import type {ChatMessage} from '@/components/ChatMessageItem';

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
        useChatStore.getState().resetMessages();
        jest.clearAllMocks();
        const state = useChatStore.getState();
        expect(state.isInitialized).toBe(false);
        expect(state.isLoadingMessages).toBe(false);
    });

    it('addMessage should add and deduplicate messages', () => {
        const msg = createMessage('1');
        useChatStore.getState().addMessage(msg, false);
        jest.runAllTimers();
        expect(useChatStore.getState().messages).toHaveLength(1);
        useChatStore.getState().addMessage(msg, false);
        jest.runAllTimers();
        expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it('updateMessage should update existing message content', () => {
        const msg = createMessage('1');
        useChatStore.getState().addMessage(msg, false);
        jest.runAllTimers();
        useChatStore.getState().updateMessage({id: '1', message_content: 'Updated'});
        const updated = useChatStore.getState().messages.find(m => m.id === '1');
        expect(updated?.message_content).toBe('Updated');
    });

    it('resetMessages should clear store state', () => {
        const msg = createMessage('1');
        useChatStore.getState().addMessage(msg, false);
        jest.runAllTimers();
        expect(useChatStore.getState().messages.length).toBe(1);
        useChatStore.getState().resetMessages();
        expect(useChatStore.getState().messages.length).toBe(0);
        expect(useChatStore.getState().isInitialized).toBe(false);
    });

    it('setConnectionStatus should update connectionStatus', () => {
        useChatStore.getState().setConnectionStatus('connected');
        expect(useChatStore.getState().connectionStatus).toBe('connected');
    });

    it('fetchInitialMessages should load messages from API', async () => {
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
        useChatStore.setState({isInitialized: true});
        await useChatStore.getState().fetchInitialMessages();
        expect(mockGetMessages).not.toHaveBeenCalled();
    });

    it('should fetch older messages', async () => {
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

    it('should add reaction to message', async () => {
        const reactionData = {message_id: 'msg1', emoji: '👍'};
        mockAddReaction.mockResolvedValueOnce(reactionData);

        await useChatStore.getState().addReaction('msg1', '👍');

        expect(mockAddReaction).toHaveBeenCalledWith({
            message_id: 'msg1',
            emoji: '👍'
        });
    });

    it('should handle add reaction error', async () => {
        const error = new Error('Failed to add reaction');
        mockAddReaction.mockRejectedValueOnce(error);

        await useChatStore.getState().addReaction('msg1', '👍');

        expect(useChatStore.getState().error).toEqual({
            type: 'reaction',
            message: 'Failed to add reaction'
        });
    });

    it('should remove reaction from message', async () => {
        mockRemoveReaction.mockResolvedValueOnce({});

        await useChatStore.getState().removeReaction('msg1', '👍');

        expect(mockRemoveReaction).toHaveBeenCalledWith({
            message_id: 'msg1',
            emoji: '👍'
        });
    });

    it('should handle remove reaction error', async () => {
        const error = new Error('Failed to remove reaction');
        mockRemoveReaction.mockRejectedValueOnce(error);

        await useChatStore.getState().removeReaction('msg1', '👍');

        expect(useChatStore.getState().error).toEqual({
            type: 'reaction',
            message: 'Failed to remove reaction'
        });
    });

    it('should fetch players for mention', async () => {
        const players = [
            {id: 'p1', nickname: 'Player1'},
            {id: 'p2', nickname: 'Player2'}
        ];
        mockGetPlayersForMention.mockResolvedValueOnce(players);
        await useChatStore.getState().fetchMentionSuggestions('Pl');
        jest.advanceTimersByTime(350);
        await Promise.resolve();
        expect(mockGetPlayersForMention).toHaveBeenCalled();
        expect(useChatStore.getState().mentionSuggestions).toEqual(players);
    });
});
