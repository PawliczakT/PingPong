import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {useEffect} from "react";
import {ActivityIndicator, Linking, Platform, StyleSheet, View} from "react-native";
import {ErrorBoundary} from "./error-boundary";
import {useNetworkStore} from "@/store/networkStore";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {trpc, trpcClient} from "@/lib/trpc";
import {supabase} from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import {fetchPlayersFromSupabase, usePlayersRealtime} from "@/store/playerStore";
import {fetchMatchesFromSupabase, useMatchesRealtime} from "@/store/matchStore";
import {useTournamentsRealtime, useTournamentStore} from "@/store/tournamentStore";
import {fetchAchievementsFromSupabase, useAchievementsRealtime} from "@/store/achievementStore";
import {fetchNotificationsFromSupabase, useNotificationsRealtime} from "@/store/notificationStore";
import LogRocket from '@logrocket/react-native';
import * as Updates from 'expo-updates';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch((e) => {
    console.warn("Error preventing auto-hide of splash screen:", e);
});

export default function RootLayout() {
    useEffect(() => {
        const handleAuthCallback = async () => {
            // Handle web redirect with hash
            if (typeof window !== 'undefined') {
                const hash = window.location.hash;
                if (hash) {
                    const params = new URLSearchParams(hash.replace('#', ''));
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken && refreshToken) {
                        try {
                            const {error} = await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            });

                            if (error) {
                                console.error('[Auth] Error setting session:', error);
                            } else {
                                console.log('[Auth] Session set successfully from web redirect');
                                // Clear the URL hash after successful auth
                                window.history.replaceState({}, document.title, window.location.pathname);
                            }
                        } catch (e) {
                            console.error('[Auth] Exception setting session:', e);
                        }
                    }
                }
            }
        };

        handleAuthCallback();

        // Handle deep linking for mobile
        const handleDeepLink = (event: { url: string }) => {
            console.log('[Auth] Deep link received:', event.url);
            console.log(`[Auth] Platform type: ${Platform.OS}`);

            // Handle any URL that contains our app scheme
            if (event.url.startsWith('pingpongstatkeeper://')) {
                console.log('[Auth] Processing pingpongstatkeeper:// URL');
                const url = new URL(event.url);
                const fragment = url.hash.substring(1); // Remove the # character

                console.log('[Auth] URL fragment:', fragment);

                if (fragment) {
                    const params = new URLSearchParams(fragment);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    console.log('[Auth] Found tokens in URL:', !!accessToken, !!refreshToken);

                    if (accessToken && refreshToken) {
                        supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        }).then(({error}) => {
                            if (error) {
                                console.error('[Auth] Error setting session from deep link:', error);
                            } else {
                                console.log('[Auth] Session set successfully from deep link');
                            }
                        });
                    }
                }
            }
        };

        // Add deep link listener
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check initial URL in case the app was opened from a deep link
        Linking.getInitialURL().then((url) => {
            if (url) {
                console.log('[Auth] Initial URL:', url);
                handleDeepLink({url});
            }
        }).catch(console.error);

        return () => {
            // @ts-ignore - removeEventListener is not in the type definition
            if (subscription?.remove) {
                // @ts-ignore
                subscription.remove();
            } else {
                // Fallback for older versions of React Native
                Linking.removeAllListeners('url');
            }
        };
    }, []);

    useEffect(() => {
        LogRocket.init('y1vslm/pingpong', {
            updateId: Updates.isEmbeddedLaunch ? null : Updates.updateId,
            expoChannel: Updates.channel,
        });

        LogRocket.identify('generic-user-id', {
            name: 'Generic User',
            email: 'generic.user@example.com',
        });
        console.log('LogRocket identified generic user');
    }, []);

    const [loaded, error] = useFonts({
        ...FontAwesome.font,
    });

    const {checkNetworkStatus, syncPendingMatches} = useNetworkStore();

    useEffect(() => {
        if (error) {
            console.error("Font loading error:", error);
        }
    }, [error]);

    useEffect(() => {
        const hideSplash = async () => {
            if (loaded) {
                try {
                    await SplashScreen.hideAsync();
                    console.log("Splash screen hidden.");
                } catch (e) {
                    console.warn("SplashScreen.hideAsync error:", e);
                }
            }
        };
        hideSplash().catch((e) => {
            console.warn("Error hiding splash screen:", e);
        });
    }, [loaded]);

    useEffect(() => {
        const initializeNetwork = async () => {
            console.log("Initializing network check...");
            try {
                const isOnline = await checkNetworkStatus();
                if (isOnline) {
                    console.log("App start: Online, syncing pending matches...");
                    await syncPendingMatches();
                    console.log("App start: Sync complete.");
                } else {
                    console.log("App start: Offline.");
                }
            } catch (err) {
                console.error("Error during initial network check/sync:", err);
            }
        };

        initializeNetwork().catch((e) => {
            console.warn("Error during network initialization:", e);
        });

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

    usePlayersRealtime();
    useMatchesRealtime();
    useTournamentsRealtime();
    useAchievementsRealtime();
    useNotificationsRealtime();

    useEffect(() => {
        const fetchInitialData = async () => {
            console.log("Fetching initial data (Players, Tournaments, Achievements, Notifications, Matches)...");
            try {
                await Promise.all([
                    fetchPlayersFromSupabase(),
                    useTournamentStore.getState().fetchTournaments(),
                    fetchAchievementsFromSupabase(),
                    fetchNotificationsFromSupabase(),
                    fetchMatchesFromSupabase(),
                ]);
                console.log("Initial data fetching complete.");
            } catch (fetchError) {
                console.error("Error fetching initial data:", fetchError);
            }
        };

        fetchInitialData().catch((e) => {
            console.warn("Error during initial data fetching:", e);
        });
    }, []);

    if (!loaded) {
        return <ActivityIndicator size="large" style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}/>;
    }

    return (
        <ErrorBoundary>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                    <AuthGuard>
                        <RootLayoutNav/>
                    </AuthGuard>
                </QueryClientProvider>
            </trpc.Provider>
        </ErrorBoundary>
    );
}

function RootLayoutNav() {
    return (
        <View style={styles.container}>
            <Stack
                screenOptions={{
                    headerBackTitle: "Back",
                    headerShadowVisible: false,
                    contentStyle: {paddingBottom: 0},
                }}
            >
                <Stack.Screen name="(tabs)" options={{headerShown: false}}/>
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
                <Stack.Screen name="auth/login" options={{headerShown: false}}/>
            </Stack>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
});
