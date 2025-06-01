import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack, useRouter} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {useEffect, useState} from "react";
import {ActivityIndicator, Linking, StyleSheet, Text, View} from "react-native";
import {Button} from 'react-native-paper';
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
import {fetchNotificationsFromSupabase, useNotificationsRealtime} from "@/store/notificationStore";
import LogRocket from '@logrocket/react-native';
import * as Updates from 'expo-updates';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch((e) => {
    console.warn("Error preventing auto-hide of splash screen:", e);
});

// Global function to refresh profile state
let refreshProfileState: (() => void) | null = null;

export const triggerProfileRefresh = () => {
    if (refreshProfileState) {
        refreshProfileState();
    }
};

export default function RootLayout() {
    const [loaded, error] = useFonts({
        ...FontAwesome.font,
    });

    const {checkNetworkStatus, syncPendingMatches} = useNetworkStore();

    // Auth state
    const user = useAuthStore(state => state.user);
    const isInitialized = useAuthStore(state => state.isInitialized);
    const isLoading = useAuthStore(state => state.isLoading);
    const [hasProfile, setHasProfile] = useState<boolean | null>(null);
    const [isCheckingProfile, setIsCheckingProfile] = useState(true);

    // Check if user has profile
    const checkProfile = React.useCallback(async () => {
        if (!user) {
            setHasProfile(false);
            setIsCheckingProfile(false);
            return;
        }

        try {
            console.log('Checking profile for user:', user.id);
            const {data: existingPlayer, error} = await supabase
                .from('players')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Error checking profile:', error);
                setHasProfile(false);
                setIsCheckingProfile(false);
                return;
            }

            const profileExists = !!existingPlayer;
            console.log('Profile check result:', profileExists);
            setHasProfile(profileExists);
            setIsCheckingProfile(false);
        } catch (error) {
            console.error('Error checking profile:', error);
            setHasProfile(false);
            setIsCheckingProfile(false);
        }
    }, [user]);

    // Set up refresh function
    React.useEffect(() => {
        refreshProfileState = () => {
            setHasProfile(null);
            setIsCheckingProfile(true);
            checkProfile().then(r => console.error("Error checking profile:", r));
        };

        return () => {
            refreshProfileState = null;
        };
    }, [checkProfile]);

    // Auth callback handling
    useEffect(() => {
        const handleAuthCallback = async () => {
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
                                window.history.replaceState({}, document.title, window.location.pathname);
                            }
                        } catch (e) {
                            console.error('[Auth] Exception setting session:', e);
                        }
                    }
                }
            }
        };

        handleAuthCallback().then(r => console.error("Error handling auth callback:", r));

        const handleDeepLink = (event: { url: string }) => {
            console.log('[Auth] Deep link received:', event.url);

            if (event.url.startsWith('pingpongstatkeeper://')) {
                const url = new URL(event.url);
                const fragment = url.hash.substring(1);

                if (fragment) {
                    const params = new URLSearchParams(fragment);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

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

        const subscription = Linking.addEventListener('url', handleDeepLink);

        Linking.getInitialURL().then((url) => {
            if (url) {
                handleDeepLink({url});
            }
        }).catch(console.error);

        return () => {
            if (subscription?.remove) {
                subscription.remove();
            } else {
                Linking.removeAllListeners('url');
            }
        };
    }, []);

    // LogRocket setup
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

    // Font loading
    useEffect(() => {
        if (error) {
            console.error("Font loading error:", error);
        }
    }, [error]);

    // Splash screen
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
        hideSplash();
    }, [loaded]);

    // Network setup
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

        initializeNetwork().then(r => console.error("Error initializing network:", r));

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

    // Realtime hooks
    usePlayersRealtime();
    useMatchesRealtime();
    useTournamentsRealtime();
    useAchievementsRealtime();
    useNotificationsRealtime();

    // Data fetching
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

        fetchInitialData();
    }, []);

    // Check profile when user changes
    useEffect(() => {
        if (isInitialized && !isLoading) {
            checkProfile().then(r => console.error("Error checking profile:", r));
        }
    }, [user, isInitialized, isLoading, checkProfile]);

    // Show loading while initializing
    if (!loaded || !isInitialized || isLoading || isCheckingProfile) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF"/>
            </View>
        );
    }

    return (
        <ErrorBoundary>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                    {!user ? (
                        <AuthStack/>
                    ) : hasProfile === false ? (
                        <ProfileSetupStack/>
                    ) : (
                        <AppStack/>
                    )}
                </QueryClientProvider>
            </trpc.Provider>
        </ErrorBoundary>
    );
}

// Stack dla niezalogowanych użytkowników
function AuthStack() {
    return (
        <Stack screenOptions={{headerShown: false}}>
            <Stack.Screen name="auth/login"/>
        </Stack>
    );
}

// Stack dla użytkowników bez profilu
function ProfileSetupStack() {
    const router = useRouter();
    const {user} = useAuthStore();
    const [isChecking, setIsChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check if user has a profile
    useEffect(() => {
        let isMounted = true;

        const checkProfile = async () => {
            if (!user) {
                router.replace('/auth/login');
                return;
            }

            try {
                const {data: existingPlayer, error: queryError} = await supabase
                    .from('players')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (queryError) throw queryError;

                if (existingPlayer) {
                    // User already has a profile, redirect to app
                    router.replace('/(tabs)');
                } else if (isMounted) {
                    // No profile found, show setup
                    setIsChecking(false);
                }
            } catch (error) {
                console.error('Error checking profile:', error);
                if (isMounted) {
                    setError('Wystąpił błąd podczas wczytywania profilu. Spróbuj ponownie.');
                    setIsChecking(false);
                }
            }
        };


        checkProfile();

        return () => {
            isMounted = false;
        };
    }, [user, router]);

    if (isChecking) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF"/>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{color: 'red', marginBottom: 20}}>{error}</Text>
                <Button mode="contained" onPress={() => router.replace('/auth/login')} style={{marginTop: 10}}>
                    Wróć do logowania
                </Button>
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerBackTitle: "Back",
                headerShadowVisible: false,
                headerShown: false,
            }}
        >
            <Stack.Screen
                name="player/setup"
                options={{
                    title: "Setup Profile",
                    headerShown: false
                }}
            />
        </Stack>
    );
}

// Stack dla zalogowanych użytkowników z profilem
function AppStack() {
    return (
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
        </Stack>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
});
