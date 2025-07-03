// hooks/useNotificationsRealtime.ts
import { useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from '@/backend/server/lib/supabase';
import { useNotificationStore } from "@/store/notificationStore";

export const useNotificationsRealtime = () => {
    const { user } = useAuthStore();
    const channelRef = useRef<any>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);

    const setupChannel = useCallback(() => {
        if (!user?.id) {
            console.log('🔴 No user ID for realtime subscription');
            return;
        }

        if (channelRef.current) {
            console.log('🔵 Removing existing channel');
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        console.log('🟢 Setting up realtime subscription for user:', user.id);

        channelRef.current = supabase
            .channel(`notifications-realtime-${user.id}`, {
                config: {
                    broadcast: { ack: true },
                    presence: { key: `notifications-${user.id}` }
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                if (!isMountedRef.current) return;
                console.log('🟢 New notification received:', payload.new);

                useNotificationStore.setState(state => ({
                    notificationHistory: [payload.new, ...state.notificationHistory]
                }));
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                if (!isMountedRef.current) return;

                useNotificationStore.setState(state => ({
                    notificationHistory: state.notificationHistory.map(n =>
                        n.id === payload.new.id ? payload.new : n
                    )
                }));
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                if (!isMountedRef.current) return;

                useNotificationStore.setState(state => ({
                    notificationHistory: state.notificationHistory.filter(n => n.id !== payload.old.id)
                }));
            })
            .subscribe((status, err) => {
                console.log('🔔 Subscription status:', status);

                if (err) {
                    console.error('🔴 Subscription error:', err);
                    scheduleReconnect();
                    return;
                }

                if (status === 'SUBSCRIBED') {
                    console.log('🟢 Successfully subscribed to notifications');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('🔴 Channel error, reconnecting...');
                    scheduleReconnect();
                } else if (status === 'TIMED_OUT') {
                    console.error('🟡 Connection timeout, reconnecting...');
                    scheduleReconnect();
                } else if (status === 'CLOSED') {
                    console.log('🟠 Channel closed');
                }
            });

        const scheduleReconnect = () => {
            if (!isMountedRef.current) return;

            clearTimeout(reconnectTimeoutRef.current!);
            reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    console.log('🔄 Attempting to reconnect...');
                    setupChannel();
                }
            }, 5000);
        };

        return () => {
            clearTimeout(reconnectTimeoutRef.current!);
        };
    }, [user?.id]);

    useEffect(() => {
        isMountedRef.current = true;
        setupChannel();

        return () => {
            isMountedRef.current = false;
            clearTimeout(reconnectTimeoutRef.current!);

            if (channelRef.current) {
                console.log('🧹 Cleaning up channel');
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [setupChannel]);
};
