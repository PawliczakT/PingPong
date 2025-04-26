import { create } from "zustand";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useSettingsStore } from "./settingsStore";
import { usePlayerStore } from "./playerStore";
import { Achievement, Match, Player, Tournament } from "@/types";
import { supabase } from "@/lib/supabase";

interface NotificationState {
  expoPushToken: string | null;
  notificationHistory: NotificationRecord[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
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
          set({ isLoading: true, error: null });
          
          // Check if we're on a physical device (not simulator/emulator)
          // const deviceType = await Device.getDeviceTypeAsync();
          // if (deviceType !== Device.DeviceType.PHONE) {
          //   set({ isLoading: false });
          //   return null;
          // }
          
          // Request permission
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          
          if (finalStatus !== 'granted') {
            set({ 
              isLoading: false, 
              error: "Permission not granted for notifications" 
            });
            return null;
          }
          
          // Get push token
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: "pingpong-statkeeper", // Replace with your actual project ID
          });
          
          const token = tokenData.data;
          set({ expoPushToken: token, isLoading: false });
          
          // Configure notification handler
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
                data: { match },
              },
              trigger: null, // Send immediately
            });
          }
          
          // Add to notification history
          get().addNotificationRecord({
            id: `match-${match.id}`,
            title,
            body,
            type: 'match',
            timestamp: new Date().toISOString(),
            read: false,
            data: { match },
          });
        } catch (error) {
          console.error("Failed to send match result notification:", error);
        }
      },
      
      sendRankingChangeNotification: async (player, oldRating, newRating) => {
        const settings = useSettingsStore.getState().notificationSettings;
        if (!settings.rankingChanges) return;
        
        const difference = newRating - oldRating;
        if (Math.abs(difference) < 10) return; // Only notify for significant changes
        
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
                data: { player, oldRating, newRating },
              },
              trigger: null, // Send immediately
            });
          }
          
          // Add to notification history
          get().addNotificationRecord({
            id: `ranking-${player.id}-${Date.now()}`,
            title,
            body,
            type: 'ranking',
            timestamp: new Date().toISOString(),
            read: false,
            data: { player, oldRating, newRating },
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
                data: { tournament, match, player },
              },
              trigger: null, // Send immediately
            });
          }
          
          // Add to notification history
          get().addNotificationRecord({
            id: `tournament-match-${match.id}`,
            title,
            body,
            type: 'tournament',
            timestamp: new Date().toISOString(),
            read: false,
            data: { tournament, match, player },
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
                data: { tournament },
              },
              trigger: null, // Send immediately
            });
          }
          
          // Add to notification history
          get().addNotificationRecord({
            id: `new-tournament-${tournament.id}`,
            title,
            body,
            type: 'tournament',
            timestamp: new Date().toISOString(),
            read: false,
            data: { tournament },
          });
        } catch (error) {
          console.error("Failed to send new tournament notification:", error);
        }
      },
      
      sendAchievementNotification: async (player, achievement) => {
        const settings = useSettingsStore.getState().notificationSettings;
        if (!settings.achievements) return;
        
        const title = "Achievement Unlocked";
        const body = `You've earned the "${achievement.name}" achievement!`;
        
        try {
          if (Platform.OS !== 'web') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: { player, achievement },
              },
              trigger: null, // Send immediately
            });
          }
          
          // Add to notification history
          get().addNotificationRecord({
            id: `achievement-${achievement.type}-${player.id}`,
            title,
            body,
            type: 'achievement',
            timestamp: new Date().toISOString(),
            read: false,
            data: { player, achievement },
          });
        } catch (error) {
          console.error("Failed to send achievement notification:", error);
        }
      },
      
    clearNotificationHistory: async () => {
      set({ isLoading: true, error: null });
      try {
        // Remove all notifications from Supabase
        const { error } = await supabase.from('notifications').delete().neq('id', '');
        if (error) throw error;
        set({ notificationHistory: [], isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to clear notification history" });
      }
    },

    addNotificationRecord: async (notification) => {
      set({ isLoading: true, error: null });
      try {
        const { error } = await supabase.from('notifications').insert({
          id: notification.id,
          player_id: notification.data?.player?.id || null,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          data: notification.data ? JSON.stringify(notification.data) : null,
          read: notification.read,
          timestamp: notification.timestamp,
        });
        if (error) throw error;
        set((state) => ({
          notificationHistory: [notification, ...state.notificationHistory],
          isLoading: false,
        }));
      } catch (error) {
        set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to add notification" });
      }
    },
    // Fetch all notifications from Supabase on store initialization
  }),
);

// Fetch notifications from Supabase when the app starts
export const fetchNotificationsFromSupabase = async () => {
  useNotificationStore.setState({ isLoading: true, error: null });
  try {
    const { data, error } = await supabase.from('notifications').select('*').order('timestamp', { ascending: false });
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
    useNotificationStore.setState({ notificationHistory, isLoading: false });
  } catch (error) {
    useNotificationStore.setState({ isLoading: false, error: error instanceof Error ? error.message : "Failed to fetch notifications" });
  }
};

// Setup realtime subscription for notifications table
import { useEffect } from "react";

export const useNotificationsRealtime = () => {
  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchNotificationsFromSupabase();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};

// Usage example (call in App.tsx or useEffect in root):
// import { useNotificationStore, fetchNotificationsFromSupabase, useNotificationsRealtime } from '@/store/notificationStore';
// useNotificationsRealtime();