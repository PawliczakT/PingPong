//store/notificationStore.ts
import {create} from "zustand";
import {useEffect} from "react";
import {Platform} from "react-native";
import * as Notifications from "expo-notifications";
import {supabaseAsAdmin} from '@/backend/server/lib/supabaseAdmin';
import {Achievement, Match, Player, Tournament} from "@/backend/types";
import {usePlayerStore} from "./playerStore";

export interface NotificationRecord {
    id: string;
    player_id: string | null;
    title: string;
    body: string;
    type: 'match' | 'ranking' | 'tournament' | 'achievement';
    timestamp: string;
    read: boolean;
    data?: any;
}

// Definicja stanu i akcji w naszym store
interface NotificationState {
    notificationHistory: NotificationRecord[];
    isLoading: boolean;
    error: string | null;
    fetchNotifications: () => Promise<void>;
    addNotification: (notification: Omit<NotificationRecord, 'id' | 'player_id' | 'timestamp' | 'read'>) => Promise<void>;
    clearHistory: () => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    registerForPushNotifications: () => Promise<string | null>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notificationHistory: [],
    isLoading: false,
    error: null,

    registerForPushNotifications: async () => {
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
                // WAŻNE: Wstaw tutaj swój Project ID z pliku app.json
                projectId: "ed168f63-83ac-4c89-9d45-7db0d85cd6ca",
            });
            const token = tokenData.data;
            set({isLoading: false});
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
                }),
            });
            return token;
        } catch (error) {
            console.error("Error registering for push notifications:", error);
            set({isLoading: false, error: error instanceof Error ? error.message : "Failed to register"});
            return null;
        }
    },

    fetchNotifications: async () => {
        set({isLoading: true, error: null});
        try {
            const {
                data,
                error
            } = await supabaseAsAdmin.from('notifications').select('*').order('timestamp', {ascending: false});
            if (error) throw error;
            set({ notificationHistory: (data as unknown) as NotificationRecord[], isLoading: false });
        } catch (error) {
            set({isLoading: false, error: error instanceof Error ? error.message : "Failed to fetch notifications"});
        }
    },

    addNotification: async (notification) => {
        try {
            const rpc_params = {
                p_player_id: notification.data?.player?.id || null,
                p_title: notification.title,
                p_body: notification.body,
                p_type: notification.type,
                p_data: notification.data || {}
            };
            const {error} = await supabaseAsAdmin.rpc('create_notification', rpc_params);
            if (error) throw error;
        } catch (error) {
            console.error("Failed to add notification via RPC:", error);
        }
    },

    // --- POPRAWIONA WERSJA clearHistory ---
    clearHistory: async () => {
        console.log('--- AKCJA clearHistory W STORE URUCHOMIONA ---');
        set({isLoading: true, error: null});
        try {
            // Krok 1: Natychmiast wyczyść CAŁY lokalny stan dla szybkiej reakcji UI.
            set({notificationHistory: []});

            // Krok 2: W tle wywołaj RPC, które usunie TYLKO personalne rekordy w bazie.
            const {error} = await supabaseAsAdmin.rpc('clear_my_notifications');
            if (error) throw error;
        } catch (error) {
            console.error("Failed to clear notification history:", error);
            await get().fetchNotifications(); // W razie błędu przywróć stan z bazy.
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
        await supabaseAsAdmin.from('notifications').update({read: true}).eq('id', notificationId);
    },
}));

export const useNotificationsRealtime = () => {
    useEffect(() => {
        useNotificationStore.getState().fetchNotifications();
    }, []);

    useEffect(() => {
        const channel = supabaseAsAdmin
            .channel('public:notifications')
            .on('postgres_changes', {event: '*', schema: 'public', table: 'notifications'},
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newNotification = payload.new as NotificationRecord;
                        useNotificationStore.setState(state => ({
                            notificationHistory: [newNotification, ...state.notificationHistory]
                        }));
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedNotification = payload.new as NotificationRecord;
                        useNotificationStore.setState(state => ({
                            notificationHistory: state.notificationHistory.map(n =>
                                n.id === updatedNotification.id ? updatedNotification : n
                            )
                        }));
                    } else if (payload.eventType === 'DELETE') {
                        const oldId = payload.old.id as string;
                        useNotificationStore.setState(state => ({
                            notificationHistory: state.notificationHistory.filter(n => n.id !== oldId)
                        }));
                    }
                }
            ).subscribe();
        return () => {
            supabaseAsAdmin.removeChannel(channel);
        };
    }, []);
};

export const sendMatchResultNotification = async (match: Match, player1: Player, player2: Player) => {
    const winner = match.winner === player1.id ? player1 : player2;
    const loser = match.winner === player1.id ? player2 : player1;
    const notification = {
        title: "Match Result",
        body: `${winner.name} defeated ${loser.name} ${match.player1Score}-${match.player2Score}`,
        type: 'match' as const,
        data: {match},
    };
    await useNotificationStore.getState().addNotification(notification);
    if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({content: notification, trigger: null});
    }
};

export const sendRankingChangeNotification = async (player: Player, oldRating: number, newRating: number) => {
    const difference = newRating - oldRating;
    if (Math.abs(difference) < 1) return;
    const notification = {
        title: "Rating Change",
        body: difference > 0
            ? `Your rating increased by ${difference} points to ${newRating}`
            : `Your rating decreased by ${Math.abs(difference)} points to ${newRating}`,
        type: 'ranking' as const,
        data: {player, oldRating, newRating},
    };
    await useNotificationStore.getState().addNotification(notification);
    if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({content: notification, trigger: null});
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
        data: {tournament, match, player},
    };
    await useNotificationStore.getState().addNotification(notification);
    if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({content: notification, trigger: null});
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
        await Notifications.scheduleNotificationAsync({content: notification, trigger: null});
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
        await Notifications.scheduleNotificationAsync({content: notification, trigger: null});
    }
};
