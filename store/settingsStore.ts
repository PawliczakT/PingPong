import {create} from "zustand";
import {createJSONStorage, persist} from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface NotificationSettings {
    matchResults: boolean;
    rankingChanges: boolean;
    tournamentMatches: boolean;
    newTournaments: boolean;
    achievements: boolean;
}

interface SettingsState {
    notificationSettings: NotificationSettings;
    notificationsEnabled: boolean;
    isFirstLaunch: boolean;
    theme: 'light' | 'dark' | 'system';
    darkMode: boolean;
    offlineMode: boolean;
    updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
    updateNotificationSetting: (key: keyof NotificationSettings, value: boolean) => void;
    setFirstLaunch: (value: boolean) => void;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    toggleDarkMode: () => void;
    toggleOfflineMode: () => void;
    toggleNotificationsEnabled: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            notificationSettings: {
                matchResults: true,
                rankingChanges: true,
                tournamentMatches: true,
                newTournaments: true,
                achievements: true,
            },
            notificationsEnabled: true,
            isFirstLaunch: true,
            theme: 'system',
            darkMode: false,
            offlineMode: true,

            updateNotificationSettings: (settings) => {
                set((state) => ({
                    notificationSettings: {
                        ...state.notificationSettings,
                        ...settings,
                    },
                }));
            },

            updateNotificationSetting: (key, value) => {
                set((state) => ({
                    notificationSettings: {
                        ...state.notificationSettings,
                        [key]: value,
                    },
                }));
            },

            setFirstLaunch: (value) => {
                set({isFirstLaunch: value});
            },

            setTheme: (theme) => {
                set({theme});
            },

            toggleDarkMode: () => {
                set((state) => ({darkMode: !state.darkMode}));
            },

            toggleOfflineMode: () => {
                set((state) => ({offlineMode: !state.offlineMode}));
            },

            toggleNotificationsEnabled: () => {
                set((state) => ({notificationsEnabled: !state.notificationsEnabled}));
            },
        }),
        {
            name: "pingpong-settings",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
