import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase'; // Your Supabase client
import { useChatStore } from '@/store/chatStore';
import type { ChatMessage } from '@/components/ChatMessageItem'; // Reuse type
import { AppState, Platform } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';

const useChatRealtime = () => {
  const { addMessage, updateMessage, setConnectionStatus, resetMessages, fetchInitialMessages } = useChatStore();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const setupSubscription = () => {
      if (channelRef.current) {
        // console.log('Realtime channel already exists. Unsubscribing before creating new one.');
        // supabase.removeChannel(channelRef.current); // This might be too aggressive
        // channelRef.current = null;
        // For safety, ensure only one active subscription
        return;
      }

      setConnectionStatus('connecting');
      console.log('Setting up Supabase Realtime subscription for chat_messages...');

      const channel = supabase
        .channel('chat_messages_realtime')
        .on<ChatMessage>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          (payload) => {
            console.log('New message received via Realtime:', payload.new);
            // TODO: Fetch profile data if not included in payload.new or handle it in component
            // For now, assuming payload.new is compatible with ChatMessage type or needs transformation.
            // This might require a server-side function/join to include profile data directly.
            // Or, fetch profile details client-side upon receiving message.
            // For simplicity, we pass it as is, component needs to handle missing profile.
            addMessage(payload.new as ChatMessage);
          }
        )
        .on<ChatMessage>(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
          (payload) => {
            console.log('Message updated via Realtime:', payload.new);
            // This will typically be for reactions or edits
            updateMessage(payload.new as Partial<ChatMessage> & { id: string });
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to chat_messages Realtime channel!');
            setConnectionStatus('connected');
            // Fetch initial messages once subscribed to ensure consistency if messages were missed
            // resetMessages(); // Clear any existing messages before fetching
            // fetchInitialMessages(); // This might cause duplicates if messages already loaded
          } else if (status === 'TIMED_OUT') {
            console.warn('Realtime subscription timed out.');
            setConnectionStatus('error');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Realtime channel error:', err);
            setConnectionStatus('error');
          } else if (status === 'CLOSED') {
            console.log('Realtime channel closed.');
            // setConnectionStatus('disconnected'); // Or 'connecting' if attempting to reconnect
          }
        });

      channelRef.current = channel;
    };

    const removeSubscription = () => {
      if (channelRef.current) {
        console.log('Removing Supabase Realtime subscription for chat_messages...');
        supabase.removeChannel(channelRef.current)
          .then(() => console.log('Successfully removed channel.'))
          .catch(err => console.error('Error removing channel:', err));
        channelRef.current = null;
        setConnectionStatus('disconnected');
      }
    };

    // Initial setup
    setupSubscription();

    // Handle app state changes (e.g., app comes to foreground)
    // For native platforms primarily
    const handleAppStateChange = (nextAppState: any) => {
      if (Platform.OS !== 'web') {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          console.log('App has come to the foreground, re-establishing Realtime if needed.');
          // Supabase client JS should handle reconnection automatically for websockets.
          // However, explicitly checking and re-subscribing can be a fallback.
          if (!channelRef.current || channelRef.current.state !== 'joined') {
            removeSubscription(); // Clean up existing if any
            setupSubscription();
          }
        }
        appState.current = nextAppState;
      }
    };

    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      removeSubscription();
      if (Platform.OS !== 'web') {
        appStateListener?.remove();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage, updateMessage, setConnectionStatus, resetMessages, fetchInitialMessages]); // Add dependencies carefully

  // Expose a manual reconnect function if needed
  const reconnect = () => {
    console.log('Manual reconnect triggered.');
    if (channelRef.current) {
       supabase.removeChannel(channelRef.current);
       channelRef.current = null;
    }
    setupSubscription();
  };

  return { reconnect }; // Can return status or control functions
};

export default useChatRealtime;

console.log('Realtime hook created: hooks/useChatRealtime.ts');
