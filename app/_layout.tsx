import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {useEffect} from "react";
import {ActivityIndicator} from "react-native";
import {ErrorBoundary} from "./error-boundary";
import {useNetworkStore} from "@/store/networkStore";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {trpc, trpcClient} from "@/lib/trpc";
import AuthGuard from "@/components/AuthGuard";
import {fetchPlayersFromSupabase, usePlayersRealtime} from "@/store/playerStore";
import {useMatchesRealtime} from "@/store/matchStore";
import {useTournamentsRealtime, useTournamentStore} from "@/store/tournamentStore";
import {fetchAchievementsFromSupabase, useAchievementsRealtime} from "@/store/achievementStore";
import {fetchNotificationsFromSupabase, useNotificationsRealtime} from "@/store/notificationStore";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch((e) => {
    console.warn("Error preventing auto-hide of splash screen:", e);
});

export default function RootLayout() {
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
            console.log("Fetching initial data (Players, Tournaments, Achievements, Notifications)...");
            try {
                await Promise.all([
                    fetchPlayersFromSupabase(),
                    useTournamentStore.getState().fetchTournaments(),
                    fetchAchievementsFromSupabase(),
                    fetchNotificationsFromSupabase(),
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
        <Stack
            screenOptions={{
                headerBackTitle: "Back",
                headerShadowVisible: false,
            }}
        >
            {/* Main tab navigator */}
            <Stack.Screen name="(tabs)" options={{headerShown: false}}/>

            {/* Modal screen */}
            <Stack.Screen name="modal" options={{presentation: "modal", title: "Modal Screen"}}/>

            {/* Player related screens */}
            <Stack.Screen name="player/[id]" options={{title: "Player Details"}}/>
            <Stack.Screen name="player/create" options={{title: "Add Player"}}/>
            <Stack.Screen name="player/edit/[id]" options={{title: "Edit Player"}}/>

            {/* Match related screens */}
            <Stack.Screen name="match/[id]" options={{title: "Match Details"}}/>
            <Stack.Screen name="matches/index" options={{title: "All Matches"}}/>

            {/* Tournament related screens */}
            <Stack.Screen name="tournament/[id]" options={{title: "Tournament Details"}}/>
            <Stack.Screen name="tournament/create" options={{title: "Create Tournament"}}/>
            <Stack.Screen name="tournament/record-match" options={{title: "Record Tournament Match"}}/>

            {/* Other screens */}
            <Stack.Screen name="stats/head-to-head" options={{title: "Head-to-Head"}}/>
            <Stack.Screen name="notifications/index" options={{title: "Notifications"}}/>
            <Stack.Screen name="settings/index" options={{title: "Settings"}}/>

            {/* Auth screen */}
            <Stack.Screen name="auth/login" options={{headerShown: false}}/>
        </Stack>
    );
}
