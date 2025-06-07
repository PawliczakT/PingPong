import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack, useRootNavigationState, useRouter} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {useCallback, useEffect, useState} from "react";
import {Linking, Platform, StyleSheet} from "react-native";
import {ErrorBoundary} from "./error-boundary";
import {useNetworkStore} from "@/store/networkStore";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {trpc, trpcClient} from "@/lib/trpc";
import {supabase} from "@/lib/supabase";
import {useAuthStore} from "@/store/authStore";
import {fetchPlayersFromSupabase, usePlayersRealtime} from "@/store/playerStore";
import {fetchMatchesFromSupabase, useMatchesRealtime} from "@/store/matchStore";
import {useTournamentsRealtime, useTournamentStore} from "@/store/tournamentStore";
import {fetchAchievementsFromSupabase, useAchievementsRealtime} from "@/store/achievementStore";
import {useNotificationsRealtime, useNotificationStore} from "@/store/notificationStore";
import LogRocket from '@logrocket/react-native';
import * as Updates from 'expo-updates';

const queryClient = new QueryClient();
SplashScreen.preventAutoHideAsync().catch((e) => console.warn("SplashScreen error:", e));

let refreshProfileState: (() => void) | null = null;
export const triggerProfileRefresh = () => {
    if (refreshProfileState) refreshProfileState();
};

export default function RootLayout() {
    const router = useRouter();
    const navigationState = useRootNavigationState();
    const [loaded, fontError] = useFonts({...FontAwesome.font});
    const {checkNetworkStatus, syncPendingMatches} = useNetworkStore();
    const {user, isInitialized, isLoading} = useAuthStore();
    const [hasProfile, setHasProfile] = useState<boolean | null>(null);
    const [isCheckingProfile, setIsCheckingProfile] = useState(true);

    const checkProfile = useCallback(async () => {
        if (!user) {
            setHasProfile(false);
            setIsCheckingProfile(false);
            return;
        }
        setIsCheckingProfile(true);
        try {
            const {
                data: existingPlayer,
                error
            } = await supabase.from('players').select('id').eq('user_id', user.id).maybeSingle();
            if (error) throw error;
            setHasProfile(!!existingPlayer);
        } catch (error) {
            console.error('Layout: Error checking profile:', error instanceof Error ? error.message : String(error));
            setHasProfile(false);
        } finally {
            setIsCheckingProfile(false);
        }
    }, [user]);

    useEffect(() => {
        if (isInitialized) {
            checkProfile();
        }
    }, [user, isInitialized, checkProfile]);

    useEffect(() => {
        LogRocket.init('y1vslm/pingpong', {
            updateId: Updates.isEmbeddedLaunch ? null : Updates.updateId,
            expoChannel: Updates.channel,
        });
        if (user) {
            LogRocket.identify(user.id, {
                name: user.email ?? 'Użytkownik bez emaila',
                email: user.email ?? 'brak@email.com'
            });
        }
    }, [user]);

    useEffect(() => {
        const handleWebAuthCallback = () => {
            if (Platform.OS === 'web') {
                const hash = window.location.hash;
                if (hash) {
                    const params = new URLSearchParams(hash.replace('#', ''));
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    if (accessToken && refreshToken) {
                        supabase.auth.setSession({access_token: accessToken, refresh_token: refreshToken}).then(() => {
                            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                        });
                    }
                }
            }
        };

        const handleDeepLink = (event: { url: string }) => {
            const url = new URL(event.url);
            const fragment = url.hash.substring(1);
            if (fragment) {
                const params = new URLSearchParams(fragment);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                if (accessToken && refreshToken) {
                    supabase.auth.setSession({access_token: accessToken, refresh_token: refreshToken});
                }
            }
        };

        handleWebAuthCallback();
        const subscription = Linking.addEventListener('url', handleDeepLink);
        Linking.getInitialURL().then(url => url && handleDeepLink({url}));

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        const initializeNetwork = async () => {
            const isOnline = await checkNetworkStatus();
            if (isOnline) await syncPendingMatches();
        };
        initializeNetwork();
        const interval = setInterval(async () => {
            try {
                const isOnline = await checkNetworkStatus();
                if (isOnline) {
                    await syncPendingMatches();
                }
            } catch (err) {
                console.error("Error during periodic network check/sync:", err);
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [checkNetworkStatus, syncPendingMatches]);

    useEffect(() => {
        refreshProfileState = () => {
            setIsCheckingProfile(true);
            checkProfile();
        };
        return () => {
            refreshProfileState = null;
        };
    }, [checkProfile]);

    useEffect(() => {
        if (isInitialized) {
            checkProfile();
        }
    }, [user, isInitialized, checkProfile]);

    usePlayersRealtime();
    useMatchesRealtime();
    useTournamentsRealtime();
    useAchievementsRealtime();
    useNotificationsRealtime();

    useEffect(() => {
        if (user) {
            Promise.all([
                fetchPlayersFromSupabase(),
                useTournamentStore.getState().fetchTournaments(),
                fetchAchievementsFromSupabase(),
                useNotificationStore.getState().fetchNotifications(),
                fetchMatchesFromSupabase(),
            ]).catch(fetchError => console.error("Layout: Error fetching initial data:", fetchError));
        }
    }, [user]);

    useEffect(() => {
        const isFontsReady = loaded || fontError;
        const canNavigate = navigationState?.key;

        if (isFontsReady && canNavigate && isInitialized && !isLoading && !isCheckingProfile) {
            SplashScreen.hideAsync().catch(e => console.warn("SplashScreen.hideAsync error:", e));
        }

        console.log("--- NAVIGATE CHECK ---", {
            isFontsReady,
            canNavigate: !!canNavigate,
            isInitialized,
            isCheckingProfile,
            isLoading,
            user: user ? user.id : null,
            hasProfile,
        });

        if (!isFontsReady || !canNavigate || !isInitialized || isCheckingProfile || isLoading) {
            return;
        }

        if (user) {
            router.replace(hasProfile ? '/(tabs)' : '/player/setup');
        } else {
            router.replace('/auth/login');
        }
    }, [loaded, fontError, isInitialized, isLoading, navigationState?.key, user, hasProfile, isCheckingProfile, router]);


    return (
        <ErrorBoundary>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                    <Stack screenOptions={{headerBackTitle: "Back", headerShadowVisible: false}}>
                        <Stack.Screen name="(auth)" options={{headerShown: false}}/>
                        <Stack.Screen name="(tabs)" options={{headerShown: false}}/>
                        <Stack.Screen name="player/setup" options={{title: "Setup Profile", headerShown: false}}/>
                        <Stack.Screen name="auth/login" options={{headerShown: false}}/>
                        <Stack.Screen name="modal" options={{presentation: "modal", title: "Modal Screen"}}/>
                        <Stack.Screen name="player/[id]" options={{title: "Player Details"}}/>
                        <Stack.Screen name="player/create" options={{title: "Add Player"}}/>
                        <Stack.Screen name="player/edit/[id]" options={{title: "Edit Player"}}/>
                        <Stack.Screen name="player/edit-profile" options={{title: "Edit My Profile"}}/>
                        <Stack.Screen name="match/[id]" options={{title: "Match Details"}}/>
                        <Stack.Screen name="matches/index" options={{title: "All Matches"}}/>
                        <Stack.Screen name="tournament/[id]" options={{title: "Tournament Details"}}/>
                        <Stack.Screen name="tournament/create" options={{title: "Create Tournament"}}/>
                        <Stack.Screen name="tournament/record-match" options={{title: "Record Tournament Match"}}/>
                        <Stack.Screen name="stats/head-to-head" options={{title: "Head-to-Head"}}/>
                        <Stack.Screen name="notifications/index" options={{title: "Notifications"}}/>
                        <Stack.Screen name="settings/index" options={{title: "Settings"}}/>
                    </Stack>
                </QueryClientProvider>
            </trpc.Provider>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
});
