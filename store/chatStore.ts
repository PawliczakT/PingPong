import { create } from 'zustand';
import { LayoutAnimation, Platform, UIManager } from 'react-native'; // Import LayoutAnimation
import { trpc } from '@/lib/trpc'; // Assuming tRPC client is set up
import type { ChatMessage } from '@/components/ChatMessageItem'; // Reuse type from frontend component
import type { ReactionsData } from '@/components/MessageReactions'; // Reuse type

// Define Player type for mention suggestions - adjust if a global type exists
interface MentionPlayer {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  connectionStatus: ConnectionStatus;
  mentionSuggestions: MentionPlayer[];
  activeReactionMessageId: string | null;
  error: string | null;
}

interface ChatActions {
  fetchInitialMessages: () => Promise<void>;
  fetchOlderMessages: () => Promise<void>;
  sendMessage: (content: string, currentUserId: string, profile: ChatMessage['profile']) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  fetchMentionSuggestions: (query: string) => Promise<void>;
  setConnectionStatus: (status: ConnectionStatus) => void;
  addMessage: (message: ChatMessage, isNew?: boolean) => void; // For Realtime updates, indicate if it's a new message for animation
  updateMessage: (updatedMessage: Partial<ChatMessage> & { id: string }) => void; // For Realtime reaction/edit updates
  setActiveReactionMessageId: (messageId: string | null) => void;
  clearError: () => void;
  resetMessages: () => void; // For re-subscribing or reconnecting
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: [],
  isLoading: false,
  hasMoreMessages: true,
  connectionStatus: 'connecting',
  mentionSuggestions: [],
  activeReactionMessageId: null,
  error: null,

  fetchInitialMessages: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const result = await trpc.chat.getMessages.query({ limit: 20 }); // Default limit
      set({
        messages: result.messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), // Ensure sorted newest first for inverted list
        hasMoreMessages: !!result.nextCursor,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Failed to fetch initial messages:', error);
      set({ isLoading: false, error: error.message || 'Failed to fetch messages' });
    }
  },

  fetchOlderMessages: async () => {
    if (get().isLoading || !get().hasMoreMessages) return;
    set({ isLoading: true, error: null });
    try {
      const currentMessages = get().messages;
      const oldestMessage = currentMessages[currentMessages.length - 1];
      if (!oldestMessage) {
        set({ isLoading: false, hasMoreMessages: false });
        return;
      }

      const result = await trpc.chat.getMessages.query({
        cursor: oldestMessage.created_at,
        limit: 20,
      });

      set(state => ({
        messages: [...state.messages, ...result.messages.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())], // Add older messages to the end
        hasMoreMessages: !!result.nextCursor,
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Failed to fetch older messages:', error);
      set({ isLoading: false, error: error.message || 'Failed to fetch older messages' });
    }
  },

  sendMessage: async (content: string, currentUserId: string, profile: ChatMessage['profile']) => {
    // Optimistic update (optional, depends on UX preference vs. waiting for Realtime)
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      user_id: currentUserId,
      profile: profile,
      message_content: content,
      created_at: new Date().toISOString(),
      message_type: 'user_message',
      reactions: {},
      metadata: {},
    };
    // set(state => ({ messages: [optimisticMessage, ...state.messages] })); // Add to top for inverted list

    try {
      // Actual API call
      const sentMessage = await trpc.chat.sendMessage.mutate({ message_content: content });
      // If not using Realtime for own messages, update/replace optimistic message here
      // set(state => ({
      //   messages: state.messages.map(m => m.id === optimisticMessage.id ? sentMessage : m)
      // }));
      // If Realtime handles own messages, the optimistic update might be removed or handled differently
    } catch (error: any) {
      console.error('Failed to send message:', error);
      set({ error: error.message || 'Failed to send message' });
      // Revert optimistic update if needed
      // set(state => ({ messages: state.messages.filter(m => m.id !== optimisticMessage.id) }));
    }
  },

  addReaction: async (messageId: string, emoji: string) => {
    try {
      const updatedMessage = await trpc.chat.addReaction.mutate({ message_id: messageId, emoji: emoji });
      get().updateMessage(updatedMessage);
    } catch (error: any) {
      console.error('Failed to add reaction:', error);
      set({ error: error.message || 'Failed to add reaction' });
    }
  },

  removeReaction: async (messageId: string, emoji: string) => {
    try {
      const updatedMessage = await trpc.chat.removeReaction.mutate({ message_id: messageId, emoji: emoji });
      get().updateMessage(updatedMessage);
    } catch (error: any) {
      console.error('Failed to remove reaction:', error);
      set({ error: error.message || 'Failed to remove reaction' });
    }
  },

  fetchMentionSuggestions: async (query: string) => {
    if (!query || query.length < 1) {
      set({ mentionSuggestions: [] });
      return;
    }
    try {
      const players = await trpc.chat.getPlayersForMention.query({ query });
      set({ mentionSuggestions: players as MentionPlayer[] }); // Cast if types are compatible
    } catch (error: any) {
      console.error('Failed to fetch mention suggestions:', error);
      // Optionally set error state for mentions
    }
  },

  setConnectionStatus: (status: ConnectionStatus) => {
    set({ connectionStatus: status });
  },

  addMessage: (message: ChatMessage, isNew = true) => {
    // Configure LayoutAnimation for new messages
    if (isNew && Platform.OS !== 'web') { // LayoutAnimation primarily for native
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }

    // Ensure no duplicate temporary messages if optimistic updates are used
    // And prevent adding if message already exists (e.g. from optimistic update + realtime echo)
    set(state => {
      const messageExists = state.messages.some(m => m.id === message.id);
      if (messageExists) {
        // If message exists, potentially update it if the incoming one is more "real"
        return {
          messages: state.messages.map(m => m.id === message.id ? message : m)
        };
      }
      // Add new message to the top (for inverted list)
      return {
        messages: [message, ...state.messages.filter(m => !m.id.startsWith('temp-'))],
      };
    });
  },

  updateMessage: (updatedMessage: Partial<ChatMessage> & { id: string }) => {
    set(state => ({
      messages: state.messages.map(msg =>
        msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
      ),
    }));
  },

  setActiveReactionMessageId: (messageId: string | null) => {
    set({ activeReactionMessageId: messageId });
  },

  clearError: () => {
    set({ error: null });
  },

  resetMessages: () => {
    set({ messages: [], hasMoreMessages: true, isLoading: false, error: null });
  }
}));

console.log('Chat store created: store/chatStore.ts');
