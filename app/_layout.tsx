//app/_layout.tsx
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack, useRootNavigationState, useRouter} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {useCallback, useEffect, useState} from "react";
import {Linking, Platform} from "react-native";
import {ErrorBoundary} from "./error-boundary";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {trpc, trpcClient} from "@/backend/api/lib/trpc";
import {supabase} from '@/app/lib/supabase';
import {useAuth} from "@/store/authStore";
import {fetchPlayersFromSupabase, usePlayersRealtime} from "@/store/playerStore";
import {fetchMatchesFromSupabase, useMatchesRealtime} from "@/store/matchStore";
import {useTournamentsRealtime} from '@/hooks/useTournamentsRealtime';
import {fetchAchievementsFromSupabase, useAchievementsRealtime} from "@/store/achievementStore";
import {useNotificationStore} from "@/store/notificationStore";
import {useNotificationsRealtime} from "@hooks/useNotificationsRealtime";
// import {Analytics} from "@vercel/analytics/react"
// import {SpeedInsights} from "@vercel/speed-insights/react"

const queryClient = new QueryClient();
SplashScreen.preventAutoHideAsync().catch((e) => console.warn("SplashScreen error:", e));

export default function RootLayout() {
    const router = useRouter();
    const navigationState = useRootNavigationState();
    const [loaded, fontError] = useFonts({...FontAwesome.font});
    const {user, isInitialized, isLoading} = useAuth();
    const [hasProfile, setHasProfile] = useState<boolean | null>(null);
    const [isCheckingProfile, setIsCheckingProfile] = useState(true);


    const checkProfile = useCallback(async () => {
        if (!user?.id) {
            console.log('🔍 No user ID available for profile check');
            setHasProfile(false);
            setIsCheckingProfile(false);
            return;
        }

        console.log(`🔍 Checking profile for user: ${user.id}`);
        setIsCheckingProfile(true);

        try {
            const {data: existingPlayer, error} = await supabase
                .from('players')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                console.error('🔍 Profile check error:', error.message, error.details);
                throw error;
            }

            const hasProfile = !!existingPlayer;
            console.log(`🔍 Profile check result: ${hasProfile ? 'found' : 'not found'}`);
            setHasProfile(hasProfile);

        } catch (error) {
            console.error('🔍 Error checking profile:', error);
            setHasProfile(false);
        } finally {
            setIsCheckingProfile(false);
        }
    }, [user]);

    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            if (Platform.OS === 'web') return;

            const url = new URL(event.url);
            const path = url.pathname;

            try {
                if (path.includes('/auth/callback')) {
                    const accessToken = url.searchParams.get('access_token') ||
                        new URLSearchParams(url.hash.substring(1)).get('access_token');
                    const refreshToken = url.searchParams.get('refresh_token') ||
                        new URLSearchParams(url.hash.substring(1)).get('refresh_token');

                    if (accessToken && refreshToken) {
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        router.replace('/(tabs)');
                    }
                    return;
                }

                if (path.startsWith('/reset-password')) {
                    const accessToken = url.searchParams.get('access_token');
                    const refreshToken = url.searchParams.get('refresh_token');
                    if (accessToken && refreshToken) {
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        router.replace('/');
                    }
                }
            } catch (error) {
                console.error('Error handling deep link:', error);
                router.replace('/(auth)/login');
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);
        Linking.getInitialURL().then(url => {
            if (url) handleDeepLink({url});
        });

        return () => subscription.remove();
    }, [router]);

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
            const fetchData = async () => {
                try {
                    await fetchPlayersFromSupabase();
                    console.log('✅ Players loaded successfully');
                } catch (error) {
                    console.error("❌ Error fetching players:", error);
                }

                try {
                    console.log('✅ Tournaments will be fetched by TanStack Query on demand.');
                } catch (error) {
                    console.error("❌ Error fetching tournaments:", error);
                }

                try {
                    await fetchAchievementsFromSupabase();
                    console.log('✅ Achievements loaded successfully');
                } catch (error) {
                    console.error("❌ Error fetching achievements:", error);
                }

                try {
                    await useNotificationStore.getState().fetchNotifications();
                    console.log('✅ Notifications loaded successfully');
                } catch (error) {
                    console.error("❌ Error fetching notifications:", error);
                }

                try {
                    await fetchMatchesFromSupabase();
                    console.log('✅ Matches loaded successfully');
                } catch (error) {
                    console.error("❌ Error fetching matches:", error);
                }
            };

            fetchData();
        }
    }, [user]);

    useEffect(() => {
        const isFontsReady = loaded || fontError;
        const canNavigate = navigationState?.key;

        console.log("--- NAVIGATE CHECK ---", {
            isFontsReady,
            canNavigate: !!canNavigate,
            isInitialized,
            isCheckingProfile,
            isLoading,
            user: user ? user.id : null,
            hasProfile,
        });

        if (isFontsReady && canNavigate && isInitialized && !isLoading && !isCheckingProfile) {
            SplashScreen.hideAsync().catch(e => console.warn("SplashScreen.hideAsync error:", e));

            if (user) {
                if (hasProfile) {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/(tabs)');
                    }
                } else {
                    router.replace('/player/setup');
                }
            } else {
                router.replace('/(auth)/login');
            }
        }
    }, [loaded, fontError, isInitialized, isLoading, navigationState?.key, user, hasProfile, isCheckingProfile, router]);

    return (
        <ErrorBoundary>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                    <Stack screenOptions={{headerBackTitle: "Back", headerShadowVisible: false}}>
                        <Stack.Screen name="(auth)" options={{headerShown: false}}/>
                        <Stack.Screen name="(tabs)" options={{headerShown: false}}/>
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
                    {/*<Analytics/>*/}
                    {/*<SpeedInsights/>*/}
                </QueryClientProvider>
            </trpc.Provider>
        </ErrorBoundary>
    );
}
