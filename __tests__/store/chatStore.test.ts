import { useChatStore } from '../../store/chatStore';
import { trpc } from '@/lib/trpc'; // To be mocked
import { ChatMessage } from '@/components/ChatMessageItem'; // Import type

// Mock tRPC client
jest.mock('@/lib/trpc', () => ({
  trpc: {
    chat: {
      getMessages: {
        query: jest.fn(),
      },
      sendMessage: {
        mutate: jest.fn(),
      },
      addReaction: {
        mutate: jest.fn(),
      },
      removeReaction: {
        mutate: jest.fn(),
      },
      getPlayersForMention: {
        query: jest.fn(),
      },
    },
  },
}));

// Mock react-native LayoutAnimation
jest.mock('react-native/Libraries/LayoutAnimation/LayoutAnimation', () => ({
  ...jest.requireActual('react-native/Libraries/LayoutAnimation/LayoutAnimation'),
  configureNext: jest.fn(),
  Presets: {
    easeInEaseOut: 'easeInEaseOut', // Mock preset
  },
}));
jest.mock('react-native/Libraries/ReactNative/UIManager', () => ({
    ...jest.requireActual('react-native/Libraries/ReactNative/UIManager'),
    setLayoutAnimationEnabledExperimental: jest.fn(),
}));


const initialStoreState = useChatStore.getState();

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useChatStore.setState(initialStoreState);
    // Reset all mock implementations
    jest.clearAllMocks();
  });

  test('should have correct initial state', () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.hasMoreMessages).toBe(true);
    expect(state.connectionStatus).toBe('connecting'); // Or whatever default you set
    expect(state.mentionSuggestions).toEqual([]);
    expect(state.activeReactionMessageId).toBeNull();
    expect(state.error).toBeNull();
  });

  describe('fetchInitialMessages', () => {
    it('should fetch initial messages and update state', async () => {
      const mockMessages: ChatMessage[] = [
        { id: '1', message_content: 'Msg 1', created_at: new Date().toISOString(), message_type: 'user_message', user_id: 'u1' },
        { id: '2', message_content: 'Msg 2', created_at: new Date().toISOString(), message_type: 'user_message', user_id: 'u2' },
      ];
      (trpc.chat.getMessages.query as jest.Mock).mockResolvedValueOnce({
        messages: mockMessages,
        nextCursor: 'cursor123',
      });

      await useChatStore.getState().fetchInitialMessages();

      const state = useChatStore.getState();
      expect(state.isLoading).toBe(false);
      // Messages are sorted by created_at descending in the store action
      expect(state.messages).toEqual(mockMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      expect(state.hasMoreMessages).toBe(true);
      expect(trpc.chat.getMessages.query).toHaveBeenCalledWith({ limit: 20 });
    });

    it('should set hasMoreMessages to false if no nextCursor', async () => {
      (trpc.chat.getMessages.query as jest.Mock).mockResolvedValueOnce({
        messages: [],
        nextCursor: null,
      });
      await useChatStore.getState().fetchInitialMessages();
      expect(useChatStore.getState().hasMoreMessages).toBe(false);
    });

    it('should handle errors during fetchInitialMessages', async () => {
      (trpc.chat.getMessages.query as jest.Mock).mockRejectedValueOnce(new Error('Fetch failed'));
      await useChatStore.getState().fetchInitialMessages();
      const state = useChatStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Fetch failed');
    });
  });

  describe('fetchOlderMessages', () => {
    beforeEach(() => {
      // Setup initial messages in store for fetchOlderMessages to use a cursor
      const initialMessages: ChatMessage[] = [
        { id: '1', message_content: 'Initial Msg', created_at: new Date(Date.now() - 10000).toISOString(), message_type: 'user_message', user_id: 'u1' },
      ];
      useChatStore.setState({ messages: initialMessages, hasMoreMessages: true });
    });

    it('should fetch older messages and append them', async () => {
      const olderMessages: ChatMessage[] = [
        { id: 'older1', message_content: 'Older Msg 1', created_at: new Date(Date.now() - 20000).toISOString(), message_type: 'user_message', user_id: 'u2' },
      ];
      (trpc.chat.getMessages.query as jest.Mock).mockResolvedValueOnce({
        messages: olderMessages,
        nextCursor: 'olderCursor',
      });

      await useChatStore.getState().fetchOlderMessages();
      const state = useChatStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.messages.length).toBe(2); // Initial + Older
      expect(state.messages[1]).toEqual(olderMessages[0]); // Appended correctly
      expect(state.hasMoreMessages).toBe(true);
      expect(trpc.chat.getMessages.query).toHaveBeenCalledWith(expect.objectContaining({
        cursor: expect.any(String), // The created_at of the oldest message
        limit: 20,
      }));
    });

    it('should not fetch if already loading', async () => {
        useChatStore.setState({ isLoading: true });
        await useChatStore.getState().fetchOlderMessages();
        expect(trpc.chat.getMessages.query).not.toHaveBeenCalled();
    });

    it('should not fetch if no more messages', async () => {
        useChatStore.setState({ hasMoreMessages: false });
        await useChatStore.getState().fetchOlderMessages();
        expect(trpc.chat.getMessages.query).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should call trpc.chat.sendMessage.mutate', async () => {
      const mockSentMessage: ChatMessage = { id: 'sent1', message_content: 'New Message', created_at: new Date().toISOString(), message_type: 'user_message', user_id: 'u1' };
      (trpc.chat.sendMessage.mutate as jest.Mock).mockResolvedValueOnce(mockSentMessage);

      await useChatStore.getState().sendMessage('New Message', 'u1', { id: 'u1', nickname: 'User1', avatar_url: null });

      expect(trpc.chat.sendMessage.mutate).toHaveBeenCalledWith({ message_content: 'New Message' });
      // Note: This test doesn't assert optimistic update or Realtime echo handling,
      // as the current store implementation relies on Realtime to add the message.
      // If optimistic update was fully implemented (add then replace/remove on error), that would be tested here.
    });

    it('should handle errors during sendMessage', async () => {
      (trpc.chat.sendMessage.mutate as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));
      await useChatStore.getState().sendMessage('Test', 'u1', { id: 'u1', nickname: 'User1', avatar_url: null });
      expect(useChatStore.getState().error).toBe('Send failed');
    });
  });

  describe('addReaction / removeReaction', () => {
    const messageId = 'msg1';
    const emoji = '👍';
    const initialMessage: ChatMessage = {
      id: messageId, user_id: 'u1', message_content: 'Hello', created_at: new Date().toISOString(), message_type: 'user_message', reactions: {}
    };

    beforeEach(() => {
      useChatStore.setState({ messages: [initialMessage] });
    });

    it('addReaction should update message reactions', async () => {
      const updatedMessage: ChatMessage = { ...initialMessage, reactions: { [emoji]: ['u1'] } };
      (trpc.chat.addReaction.mutate as jest.Mock).mockResolvedValueOnce(updatedMessage);

      await useChatStore.getState().addReaction(messageId, emoji);

      expect(trpc.chat.addReaction.mutate).toHaveBeenCalledWith({ message_id: messageId, emoji });
      const msg = useChatStore.getState().messages.find(m => m.id === messageId);
      expect(msg?.reactions).toEqual({ [emoji]: ['u1'] });
    });

    it('removeReaction should update message reactions', async () => {
      useChatStore.setState({ messages: [{ ...initialMessage, reactions: { [emoji]: ['u1'] } }] });
      const updatedMessage: ChatMessage = { ...initialMessage, reactions: {} };
      (trpc.chat.removeReaction.mutate as jest.Mock).mockResolvedValueOnce(updatedMessage);

      await useChatStore.getState().removeReaction(messageId, emoji);

      expect(trpc.chat.removeReaction.mutate).toHaveBeenCalledWith({ message_id: messageId, emoji });
      const msg = useChatStore.getState().messages.find(m => m.id === messageId);
      expect(msg?.reactions).toEqual({});
    });
  });

  describe('fetchMentionSuggestions', () => {
    it('should update mentionSuggestions', async () => {
      const mockPlayers = [{ id: 'p1', nickname: 'PlayerOne', avatar_url: null }];
      (trpc.chat.getPlayersForMention.query as jest.Mock).mockResolvedValueOnce(mockPlayers);

      await useChatStore.getState().fetchMentionSuggestions('Player');

      expect(trpc.chat.getPlayersForMention.query).toHaveBeenCalledWith({ query: 'Player' });
      expect(useChatStore.getState().mentionSuggestions).toEqual(mockPlayers);
    });

    it('should clear suggestions for empty query', async () => {
        await useChatStore.getState().fetchMentionSuggestions('');
        expect(trpc.chat.getPlayersForMention.query).not.toHaveBeenCalled();
        expect(useChatStore.getState().mentionSuggestions).toEqual([]);
    });
  });

  describe('Realtime actions', () => {
    it('addMessage should add a new message and configure LayoutAnimation', () => {
      const newMessage: ChatMessage = { id: 'rt1', message_content: 'Realtime Msg', created_at: new Date().toISOString(), message_type: 'user_message', user_id: 'u3' };
      useChatStore.getState().addMessage(newMessage);

      expect(useChatStore.getState().messages[0]).toEqual(newMessage);
      // Check if LayoutAnimation was configured (if not web)
      if (Platform.OS !== 'web') {
        expect(LayoutAnimation.configureNext).toHaveBeenCalled();
      }
    });

    it('addMessage should update an existing message if ID matches (e.g., echo)', () => {
      const existingMessage: ChatMessage = { id: 'rt1', message_content: 'Old content', created_at: new Date().toISOString(), message_type: 'user_message', user_id: 'u3' };
      useChatStore.setState({messages: [existingMessage]});

      const updatedEchoMessage: ChatMessage = { ...existingMessage, message_content: 'Updated Content from echo' };
      useChatStore.getState().addMessage(updatedEchoMessage); // isNew defaults to true

      expect(useChatStore.getState().messages.length).toBe(1);
      expect(useChatStore.getState().messages[0].message_content).toBe('Updated Content from echo');
    });


    it('updateMessage should update reactions on a message', () => {
      const originalMessage: ChatMessage = { id: 'msgToUpdate', message_content: 'Test', created_at: new Date().toISOString(), message_type: 'user_message', user_id: 'u1', reactions: {} };
      useChatStore.setState({ messages: [originalMessage] });

      const updatedReactions = { '👍': ['u1', 'u2'] };
      useChatStore.getState().updateMessage({ id: 'msgToUpdate', reactions: updatedReactions });

      const msg = useChatStore.getState().messages.find(m => m.id === 'msgToUpdate');
      expect(msg?.reactions).toEqual(updatedReactions);
    });
  });

  test('setActiveReactionMessageId should update activeReactionMessageId', () => {
    useChatStore.getState().setActiveReactionMessageId('msg123');
    expect(useChatStore.getState().activeReactionMessageId).toBe('msg123');
    useChatStore.getState().setActiveReactionMessageId(null);
    expect(useChatStore.getState().activeReactionMessageId).toBeNull();
  });

  test('clearError should set error to null', () => {
    useChatStore.setState({ error: 'Some error' });
    useChatStore.getState().clearError();
    expect(useChatStore.getState().error).toBeNull();
  });

  test('resetMessages should clear messages and reset flags', () => {
    useChatStore.setState({
        messages: [{ id: '1', message_content: 'Hi', created_at: 'time', message_type: 'user_message', user_id: 'u1'}],
        hasMoreMessages: false,
        isLoading: true,
        error: 'Some error'
    });
    useChatStore.getState().resetMessages();
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.hasMoreMessages).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

});
