//store/notificationStore.ts
import {create} from "zustand";
import {Platform} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from "expo-notifications";
import {supabase} from '@/app/lib/supabase';
import {Achievement, Match, Player, Tournament} from "@/backend/types";
import {usePlayerStore} from "./playerStore";
import {useAuthStore} from "./authStore";

export interface NotificationRecord {
    id: string;
    player_id: string | null;
    title: string;
    body: string;
    type: 'match' | 'ranking' | 'tournament' | 'achievement';
    timestamp: string;
    read: boolean;
    data?: any;
    user_id?: string;
}

interface NotificationState {
    notificationHistory: NotificationRecord[];
    isLoading: boolean;
    error: string | null;
    lastClearedTimestamp: string | null;
    fetchNotifications: (userId?: string) => Promise<void>;
    addNotification: (notification: Omit<NotificationRecord, 'id' | 'player_id' | 'timestamp' | 'read'>) => Promise<void>;
    clearHistory: (userId?: string) => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: (userId?: string) => Promise<void>;
    registerForPushNotifications: () => Promise<string | null>;
    loadClearedTimestamp: () => Promise<void>;
    saveClearedTimestamp: (timestamp: string) => Promise<void>;
}

const CLEARED_TIMESTAMP_KEY = 'notifications_cleared_timestamp';

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notificationHistory: [],
    isLoading: false,
    error: null,
    lastClearedTimestamp: null,

    loadClearedTimestamp: async () => {
        try {
            const timestamp = await AsyncStorage.getItem(CLEARED_TIMESTAMP_KEY);
            set({lastClearedTimestamp: timestamp});
        } catch (error) {
            console.error('Failed to load cleared timestamp:', error);
        }
    },

    saveClearedTimestamp: async (timestamp: string) => {
        try {
            await AsyncStorage.setItem(CLEARED_TIMESTAMP_KEY, timestamp);
            set({lastClearedTimestamp: timestamp});
        } catch (error) {
            console.error('Failed to save cleared timestamp:', error);
        }
    },

    registerForPushNotifications: async () => {
        if (Platform.OS === 'web') {
            console.log('🔔 Push notifications not supported on web');
            return null;
        }

        set({isLoading: true, error: null});
        try {
            const {status: existingStatus} = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const {status} = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                set({isLoading: false, error: "Permission not granted for notifications"});
                return null;
            }

            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: "ed168f63-83ac-4c89-9d45-7db0d85cd6ca",
            });

            const token = tokenData.data;
            set({isLoading: false});

            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: true,
                }),
            });

            return token;
        } catch (error) {
            console.error("Error registering for push notifications:", error);
            set({isLoading: false, error: error instanceof Error ? error.message : "Failed to register"});
            return null;
        }
    },

    fetchNotifications: async (userId) => {
        set({isLoading: true, error: null});

        try {
            const currentUserId = userId || useAuthStore.getState().user?.id;
            if (!currentUserId) {
                console.log('🔔 No user ID - skipping notification fetch');
                set({isLoading: false, notificationHistory: []});
                return;
            }

            console.log(`🔔 Fetching notifications for user: ${currentUserId}`);

            await get().loadClearedTimestamp();
            const clearedTimestamp = get().lastClearedTimestamp;
            console.log('🔔 Cleared timestamp:', clearedTimestamp);

            let query = supabase
                .from('notifications')
                .select('*')
                .eq('user_id', currentUserId)
                .order('timestamp', {ascending: false});

            const {data, error} = await query;

            if (error) {
                console.error('🔔 Fetch error:', error);
                throw error;
            }

            let notifications = (data || []) as NotificationRecord[];
            console.log(`🔔 Before filtering: ${notifications.length} notifications`);

            if (clearedTimestamp) {
                console.log('🔔 Filtering by cleared timestamp:', clearedTimestamp);
                const filteredCount = notifications.length;
                notifications = notifications.filter(n => n.timestamp > clearedTimestamp);
                console.log(`🔔 After timestamp filter: ${notifications.length} notifications (filtered out ${filteredCount - notifications.length})`);
            }

            console.log(`🔔 Final notifications count: ${notifications.length}`);

            set({
                notificationHistory: notifications,
                isLoading: false
            });

        } catch (error) {
            console.error('🔔 fetchNotifications failed:', error);
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : "Failed to fetch notifications"
            });
        }
    },

    addNotification: async (notification) => {
        try {
            const currentUserId = useAuthStore.getState().user?.id;

            const rpc_params = {
                p_title: notification.title,
                p_body: notification.body,
                p_type: notification.type,
                p_player_id: notification.data?.player?.id || null,
                p_user_id: currentUserId || null,
                p_data: notification.data || {}
            };

            const {data, error} = await supabase.rpc('create_notification', rpc_params);

            if (error) {
                console.error('🔔 RPC error:', error);
                throw error;
            }

            console.log('🔔 Notification created with ID:', data);

        } catch (error) {
            console.error("🔔 Failed to add notification:", error);
        }
    },

    clearHistory: async (userId?: string | null) => {
        console.log('🔔 Starting clearHistory...');
        set({isLoading: true, error: null});

        try {
            let currentUserId: string | null = null;

            if (typeof userId === 'string' && userId.trim()) {
                currentUserId = userId;
            } else {
                currentUserId = useAuthStore.getState().user?.id || null;
            }

            console.log('🔔 clearHistory for user ID:', currentUserId, typeof currentUserId);

            if (!currentUserId) {
                console.error('🔔 No valid user ID for clearing notifications');
                set({isLoading: false});
                return;
            }

            const clearTimestamp = new Date().toISOString();
            console.log('🔔 Clear timestamp:', clearTimestamp);
            set({notificationHistory: []});
            const key = `notifications_cleared_timestamp_${currentUserId}`;
            await AsyncStorage.setItem(key, clearTimestamp);
            set({lastClearedTimestamp: clearTimestamp});
            console.log('🔔 Timestamp saved to user-specific storage');
            console.log('🔔 Deleting from database with user_id:', currentUserId);
            const {error} = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', currentUserId);

            if (error) {
                console.error('🔔 Database delete error:', error);
            } else {
                console.log('🔔 Successfully deleted notifications from database');
            }

            console.log(`🔔 Cleared notifications for user ${currentUserId}`);

        } catch (error) {
            console.error("🔔 Failed to clear notification history:", error);
            set({error: error instanceof Error ? error.message : "Failed to clear notifications"});
        } finally {
            set({isLoading: false});
        }
    },

    markAsRead: async (notificationId: string) => {
        set(state => ({
            notificationHistory: state.notificationHistory.map(n =>
                n.id === notificationId ? {...n, read: true} : n
            ),
        }));

        try {
            const {error} = await supabase
                .from('notifications')
                .update({read: true})
                .eq('id', notificationId);

            if (error) {
                console.error('Failed to mark notification as read:', error);
                set(state => ({
                    notificationHistory: state.notificationHistory.map(n =>
                        n.id === notificationId ? {...n, read: false} : n
                    ),
                }));
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    },

    markAllAsRead: async (userId?: string | null) => {
        let currentUserId: string | null = null;

        if (typeof userId === 'string' && userId.trim()) {
            currentUserId = userId;
        } else {
            currentUserId = useAuthStore.getState().user?.id || null;
        }

        if (!currentUserId) {
            console.error('🔔 No user ID for markAllAsRead');
            return;
        }

        set(state => ({
            notificationHistory: state.notificationHistory.map(n => ({...n, read: true}))
        }));

        try {
            const {error} = await supabase
                .from('notifications')
                .update({read: true})
                .eq('user_id', currentUserId);

            if (error) {
                console.error('Failed to mark all notifications as read:', error);
            }

            console.log(`🔔 Marked all notifications as read for user ${currentUserId}`);

        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    },
}));

export const sendMatchResultNotification = async (match: Match, player1: Player, player2: Player) => {
    const winner = match.winner === player1.id ? player1 : player2;
    const loser = match.winner === player1.id ? player2 : player1;

    const notification = {
        title: "Match Result",
        body: `${winner.name} defeated ${loser.name} ${match.player1Score}-${match.player2Score}`,
        type: 'match' as const,
        data: {match, winner, loser},
    };

    await useNotificationStore.getState().addNotification(notification);

    if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
            content: notification,
            trigger: null
        });
    }
};

export const sendRankingChangeNotification = async (player: Player, oldRating: number, newRating: number) => {
    const difference = newRating - oldRating;
    if (Math.abs(difference) < 1) return;

    const notification = {
        title: "Rating Change",
        body: difference > 0
            ? `Your rating increased by ${Math.abs(difference)} points to ${newRating}`
            : `Your rating decreased by ${Math.abs(difference)} points to ${newRating}`,
        type: 'ranking' as const,
        data: {player, oldRating, newRating, difference},
    };

    await useNotificationStore.getState().addNotification(notification);

    if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
            content: notification,
            trigger: null
        });
    }
};

export const sendTournamentMatchNotification = async (tournament: Tournament, match: Match, player: Player) => {
    const playerStore = usePlayerStore.getState();
    const opponent = match.player1Id === player.id
        ? playerStore.getPlayerById(match.player2Id)
        : playerStore.getPlayerById(match.player1Id);

    if (!opponent) return;

    const notification = {
        title: "Tournament Match",
        body: `Your next match in ${tournament.name} is against ${opponent.name}`,
        type: 'tournament' as const,
        data: {tournament, match, player, opponent},
    };

    await useNotificationStore.getState().addNotification(notification);

    if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
            content: notification,
            trigger: null
        });
    }
};

export const sendNewTournamentNotification = async (tournament: Tournament) => {
    const notification = {
        title: "New Tournament",
        body: `A new tournament "${tournament.name}" has been created`,
        type: 'tournament' as const,
        data: {tournament},
    };

    await useNotificationStore.getState().addNotification(notification);

    if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
            content: notification,
            trigger: null
        });
    }
};

export const sendAchievementNotification = async (player: Player, achievement: Achievement) => {
    const notification = {
        title: `Achievement Unlocked: ${achievement.name}`,
        body: `You've earned the "${achievement.name}"! ${achievement.description || ''}`,
        type: 'achievement' as const,
        data: {player, achievement},
    };

    await useNotificationStore.getState().addNotification(notification);

    if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
            content: notification,
            trigger: null
        });
    }
};
