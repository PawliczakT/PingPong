import {create} from "zustand";
import * as Notifications from "expo-notifications";
import {Platform} from "react-native";
import {useSettingsStore} from "./settingsStore";
import {usePlayerStore} from "./playerStore";
import {Achievement, Match, Player, Tournament} from "@/types";
import {supabase} from "@/lib/supabase";
import {useEffect} from "react";

interface NotificationState {
    expoPushToken: string | null;
    notificationHistory: NotificationRecord[];
    isLoading: boolean;
    error: string | null;
    registerForPushNotifications: () => Promise<string | null>;
    sendMatchResultNotification: (match: Match, player1: Player, player2: Player) => Promise<void>;
    sendRankingChangeNotification: (player: Player, oldRating: number, newRating: number) => Promise<void>;
    sendTournamentMatchNotification: (tournament: Tournament, match: Match, player: Player) => Promise<void>;
    sendNewTournamentNotification: (tournament: Tournament) => Promise<void>;
    sendAchievementNotification: (player: Player, achievement: Achievement) => Promise<void>;
    clearNotificationHistory: () => void;
    addNotificationRecord: (notification: NotificationRecord) => void;
}

export interface NotificationRecord {
    id: string;
    title: string;
    body: string;
    type: 'match' | 'ranking' | 'tournament' | 'achievement';
    timestamp: string;
    read: boolean;
    data?: any;
}

export const useNotificationStore = create<NotificationState>()(
    (set, get) => ({

        expoPushToken: null,
        notificationHistory: [],
        isLoading: false,
        error: null,

        registerForPushNotifications: async () => {
            try {
                set({isLoading: true, error: null});
                const {status: existingStatus} = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;

                if (existingStatus !== 'granted') {
                    const {status} = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus !== 'granted') {
                    set({
                        isLoading: false,
                        error: "Permission not granted for notifications"
                    });
                    return null;
                }

                const tokenData = await Notifications.getExpoPushTokenAsync({
                    projectId: "pingpong-statkeeper",
                });

                const token = tokenData.data;
                set({expoPushToken: token, isLoading: false});

                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowAlert: true,
                        shouldPlaySound: true,
                        shouldSetBadge: true,
                    }),
                });

                return token;
            } catch (error) {
                set({
                    isLoading: false,
                    error: error instanceof Error ? error.message : "Failed to register for notifications"
                });
                return null;
            }
        },

        sendMatchResultNotification: async (match, player1, player2) => {
            const settings = useSettingsStore.getState().notificationSettings;
            if (!settings.matchResults) return;

            const winner = match.winner === player1.id ? player1 : player2;
            const loser = match.winner === player1.id ? player2 : player1;

            const title = "Match Result";
            const body = `${winner.name} defeated ${loser.name} ${match.player1Score}-${match.player2Score}`;

            try {
                if (Platform.OS !== 'web') {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title,
                            body,
                            data: {match},
                        },
                        trigger: null,
                    });
                }

                get().addNotificationRecord({
                    id: `match-${match.id}`,
                    title,
                    body,
                    type: 'match',
                    timestamp: new Date().toISOString(),
                    read: false,
                    data: {match},
                });
            } catch (error) {
                console.error("Failed to send match result notification:", error);
            }
        },

        sendRankingChangeNotification: async (player, oldRating, newRating) => {
            const settings = useSettingsStore.getState().notificationSettings;
            if (!settings.rankingChanges) return;

            const difference = newRating - oldRating;
            if (Math.abs(difference) < 10) return;

            const title = "Rating Change";
            const body = difference > 0
                ? `Your rating increased by ${difference} points to ${newRating}`
                : `Your rating decreased by ${Math.abs(difference)} points to ${newRating}`;

            try {
                if (Platform.OS !== 'web') {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title,
                            body,
                            data: {player, oldRating, newRating},
                        },
                        trigger: null,
                    });
                }

                get().addNotificationRecord({
                    id: `ranking-${player.id}-${Date.now()}`,
                    title,
                    body,
                    type: 'ranking',
                    timestamp: new Date().toISOString(),
                    read: false,
                    data: {player, oldRating, newRating},
                });
            } catch (error) {
                console.error("Failed to send ranking change notification:", error);
            }
        },

        sendTournamentMatchNotification: async (tournament, match, player) => {
            const settings = useSettingsStore.getState().notificationSettings;
            if (!settings.tournamentMatches) return;

            const playerStore = usePlayerStore.getState();
            const opponent = match.player1Id === player.id
                ? playerStore.getPlayerById(match.player2Id)
                : playerStore.getPlayerById(match.player1Id);

            if (!opponent) return;

            const title = "Tournament Match";
            const body = `Your next match in ${tournament.name} is against ${opponent.name}`;

            try {
                if (Platform.OS !== 'web') {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title,
                            body,
                            data: {tournament, match, player},
                        },
                        trigger: null,
                    });
                }

                get().addNotificationRecord({
                    id: `tournament-match-${match.id}`,
                    title,
                    body,
                    type: 'tournament',
                    timestamp: new Date().toISOString(),
                    read: false,
                    data: {tournament, match, player},
                });
            } catch (error) {
                console.error("Failed to send tournament match notification:", error);
            }
        },

        sendNewTournamentNotification: async (tournament) => {
            const settings = useSettingsStore.getState().notificationSettings;
            if (!settings.newTournaments) return;

            const title = "New Tournament";
            const body = `A new tournament "${tournament.name}" has been created`;

            try {
                if (Platform.OS !== 'web') {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title,
                            body,
                            data: {tournament},
                        },
                        trigger: null,
                    });
                }

                get().addNotificationRecord({
                    id: `new-tournament-${tournament.id}`,
                    title,
                    body,
                    type: 'tournament',
                    timestamp: new Date().toISOString(),
                    read: false,
                    data: {tournament},
                });
            } catch (error) {
                console.error("Failed to send new tournament notification:", error);
            }
        },

        sendAchievementNotification: async (player, achievement) => {
            const settings = useSettingsStore.getState().notificationSettings;
            if (!settings.achievements) return;

            const title = `Achievement Unlocked: ${achievement.name}`;
            const body = `You've earned the "${achievement.name}"! ${achievement.description || ''}`;

            try {
                if (Platform.OS !== 'web') {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title,
                            body,
                            data: {player, achievement},
                        },
                        trigger: null,
                    });
                }

                get().addNotificationRecord({
                    id: `achievement-${achievement.type}-${player.id}`,
                    title,
                    body,
                    type: 'achievement',
                    timestamp: new Date().toISOString(),
                    read: false,
                    data: {player, achievement},
                });
            } catch (error) {
                console.error("Failed to send achievement notification:", error);
            }
        },

        clearNotificationHistory: async () => {
            set({isLoading: true, error: null});
            try {
                const {data: allNotifications} = await supabase.from('notifications').select('id');
                if (allNotifications && allNotifications.length > 0) {
                    const {error} = await supabase
                        .from('notifications')
                        .delete()
                        .in('id', allNotifications.map(n => n.id));
                    if (error) throw error;
                }
                set({notificationHistory: [], isLoading: false});
            } catch (error) {
                set({
                    isLoading: false,
                    error: error instanceof Error ? error.message : "Failed to clear notification history"
                });
            }
        },

        addNotificationRecord: async (notification) => {
            set({isLoading: true, error: null});
            try {
                console.log("Adding notification:", notification);

                interface DbNotification {
                    title: string;
                    body: string;
                    type: 'match' | 'ranking' | 'tournament' | 'achievement';
                    read: boolean;
                    timestamp: string;
                    data: any;
                    player_id?: string;
                }

                const dbNotification: DbNotification = {
                    title: notification.title,
                    body: notification.body,
                    type: notification.type,
                    read: notification.read,
                    timestamp: notification.timestamp,
                    data: notification.data || {},
                };

                if (notification.data?.player?.id) {
                    dbNotification.player_id = notification.data.player.id;
                }

                console.log("Sending to Supabase:", dbNotification);

                const {error, data} = await supabase
                    .from('notifications')
                    .insert(dbNotification)
                    .select()
                    .single();

                if (error) {
                    console.error("Supabase notification error:", error);
                    throw error;
                }

                set((state) => ({
                    notificationHistory: [
                        {
                            ...notification,
                            id: data.id
                        },
                        ...state.notificationHistory
                    ],
                    isLoading: false,
                }));
            } catch (error) {
                console.error("Failed to add notification:", error);
                set({
                    isLoading: false,
                    error: error instanceof Error ? error.message : "Failed to add notification"
                });
            }
        },
    }),
);

export const fetchNotificationsFromSupabase = async () => {
    useNotificationStore.setState({isLoading: true, error: null});
    try {
        const {data, error} = await supabase.from('notifications').select('*').order('timestamp', {ascending: false});
        if (error) throw error;
        const notificationHistory = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            type: item.type,
            timestamp: item.timestamp,
            read: item.read,
            data: item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : undefined,
        }));
        useNotificationStore.setState({notificationHistory, isLoading: false});
    } catch (error) {
        useNotificationStore.setState({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to fetch notifications"
        });
    }
};

export const useNotificationsRealtime = () => {
    useEffect(() => {
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'notifications'},
                () => {
                    fetchNotificationsFromSupabase().catch((e) => {
                        console.warn("Error fetching notifications from Supabase:", e);
                    });
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel).catch((e) => {
                console.error("Error removing notifications channel:", e);
            });
        };
    }, []);
};
