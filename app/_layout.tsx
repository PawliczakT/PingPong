import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack, useRootNavigationState, useRouter} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {useCallback, useEffect, useState} from "react";
import {Linking, Platform} from "react-native";
import {ErrorBoundary} from "./error-boundary";
import {useNetworkStore} from "@/store/networkStore";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {trpc, trpcClient} from "@/backend/lib/trpc";
import {supabaseAsAdmin} from '@/backend/server/lib/supabaseAdmin';
import {useAuth} from "@/store/authStore";
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
    const {user, isInitialized, isLoading} = useAuth();
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
            } = await supabaseAsAdmin.from('players').select('id').eq('user_id', user.id).maybeSingle();
            if (error) throw error;
            setHasProfile(!!existingPlayer);
        } catch (error) {
            console.error('Layout: Error checking profile:', error instanceof Error ? error.message : String(error));
            setHasProfile(false);
        } finally {
            setIsCheckingProfile(false);
        }
    }, [user]);

    // Set up the refresh profile function that can be called from outside
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
                        supabaseAsAdmin.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        }).then(() => {
                            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                        });
                    }
                }
            }
        };

        handleWebAuthCallback();
    }, []);

    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            const url = new URL(event.url);
            const path = url.pathname;

            try {
                if (path.startsWith('/reset-password')) {
                    // Handle password reset
                    const accessToken = url.searchParams.get('access_token');
                    const refreshToken = url.searchParams.get('refresh_token');
                    if (accessToken && refreshToken) {
                        await supabaseAsAdmin.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        // Use a valid route that exists in your app
                        router.replace('/');
                    }
                } else if (path.startsWith('/auth/')) {
                    // Handle auth deep links - ensure the path is valid
                    const authPath = path.replace(/^\/auth\//, '/(auth)/');
                    router.replace(authPath as any); // Type assertion as a last resort
                }
            } catch (error) {
                console.error('Error handling deep link:', error);
                // Redirect to a safe route on error
                router.replace('/');
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check initial URL in case the app was opened with a deep link
        Linking.getInitialURL().then(url => {
            if (url) {
                handleDeepLink({url});
            }
        });

        return () => {
            subscription.remove();
        };
    }, [router]);

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

    // Set up network status check interval
    useEffect(() => {
        checkNetworkStatus();
        const networkInterval = setInterval(checkNetworkStatus, 30000);
        return () => clearInterval(networkInterval);
    }, [checkNetworkStatus]);

    // Set up the refresh profile function that can be called from outside
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

    // Handle navigation based on auth state and profile status
    useEffect(() => {
        const isFontsReady = loaded || fontError;
        const canNavigate = navigationState?.key;

        // Log navigation state for debugging
        console.log("--- NAVIGATE CHECK ---", {
            isFontsReady,
            canNavigate: !!canNavigate,
            isInitialized,
            isCheckingProfile,
            isLoading,
            user: user ? user.id : null,
            hasProfile,
        });

        // Hide splash screen when everything is ready
        if (isFontsReady && canNavigate && isInitialized && !isLoading && !isCheckingProfile) {
            SplashScreen.hideAsync().catch(e => console.warn("SplashScreen.hideAsync error:", e));

            // Handle navigation based on auth state
            if (user) {
                // User is logged in
                if (hasProfile) {
                    // User has a profile, go to main app
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/(tabs)');
                    }
                } else {
                    // User needs to complete profile
                    router.replace('/player/setup');
                }
            } else {
                // User is not logged in, go to auth flow
                router.replace('/(auth)/login');
            }
        }
    }, [loaded, fontError, isInitialized, isLoading, navigationState?.key, user, hasProfile, isCheckingProfile, router]);


    return (
        <ErrorBoundary>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                    <Stack screenOptions={{headerBackTitle: "Back", headerShadowVisible: false}}>
                        {/* Auth group - handles all authentication related screens */}
                        <Stack.Screen name="(auth)" options={{headerShown: false}}/>

                        {/* Main app tabs */}
                        <Stack.Screen name="(tabs)" options={{headerShown: false}}/>

                        {/* Profile setup */}
                        <Stack.Screen
                            name="player/setup"
                            options={{
                                title: "Setup Profile",
                                headerShown: false,
                                gestureEnabled: false,
                            }}
                        />
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
