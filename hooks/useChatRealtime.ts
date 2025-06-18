//hooks/useChatRealtime.ts
import {useCallback, useEffect, useRef} from 'react';
import {supabaseAsAdmin} from '@/backend/server/lib/supabaseAdmin';
import {useChatStore} from '@/store/chatStore';
import {useAuthStore} from '@/store/authStore';
import type {ChatMessage} from '@/components/ChatMessageItem';
import {AppState} from 'react-native';
import type {RealtimeChannel} from '@supabase/supabase-js';

const CHAT_CHANNEL_NAME = 'community-chat';

const useChatRealtime = () => {
    const user = useAuthStore(state => state.user);
    const {addMessage, updateMessage, setConnectionStatus, fetchInitialMessages} = useChatStore();

    const channelRef = useRef<RealtimeChannel | null>(null);
    const isInitializedRef = useRef(false);

    const setupSubscription = useCallback(async () => {
        // Zmieniono warunek, aby nie polegać na user.id, jeśli chcemy, aby niezalogowani też widzieli czat.
        // Jeśli tylko zalogowani mogą widzieć, dodaj warunek: if (!user?.id || channelRef.current) return;
        if (channelRef.current) return;

        console.log(`🔗 Setting up chat subscription to channel: ${CHAT_CHANNEL_NAME}...`);
        setConnectionStatus('connecting');

        try {
            // Zmieniono nazwę kanału na stałą dla wszystkich użytkowników
            const channel = supabaseAsAdmin.channel(CHAT_CHANNEL_NAME);

            channel
                .on('postgres_changes',
                    {event: 'INSERT', schema: 'public', table: 'chat_messages'},
                    (payload) => addMessage(payload.new as ChatMessage)
                )
                .on('postgres_changes',
                    {event: 'UPDATE', schema: 'public', table: 'chat_messages'},
                    (payload) => updateMessage(payload.new as Partial<ChatMessage> & { id: string })
                )
                .subscribe((status, err) => {
                    console.log(`🔗 Subscription status: ${status}`, err || '');

                    if (status === 'SUBSCRIBED') {
                        setConnectionStatus('connected');
                        if (!isInitializedRef.current) {
                            fetchInitialMessages();
                            isInitializedRef.current = true;
                        }
                    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                        setConnectionStatus('error');
                    } else if (status === 'CLOSED') {
                        setConnectionStatus('disconnected');
                    }
                });

            channelRef.current = channel;
        } catch (error) {
            console.error('❌ Subscription setup failed:', error);
            setConnectionStatus('error');
        }
    }, [addMessage, updateMessage, setConnectionStatus, fetchInitialMessages]);

    const cleanup = useCallback(async () => {
        if (channelRef.current) {
            console.log('🧹 Cleaning up chat subscription...');
            try {
                await channelRef.current.unsubscribe();
            } catch (error) {
                console.error('Error during unsubscribe:', error);
            }
            channelRef.current = null;
        }
        setConnectionStatus('disconnected');
    }, [setConnectionStatus]);

    useEffect(() => {
        setupSubscription();

        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'active') {
                setupSubscription();
            } else if (nextAppState.match(/inactive|background/)) {
                cleanup();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
            cleanup();
        };
    }, [setupSubscription, cleanup]);

    return {
        reconnect: setupSubscription,
        connectionStatus: useChatStore(state => state.connectionStatus),
        isConnected: useChatStore(state => state.connectionStatus === 'connected'),
    };
};

export default useChatRealtime;
