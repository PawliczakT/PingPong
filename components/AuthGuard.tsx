import React, {ReactNode, useEffect} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {useAuthStore} from '@/store/authStore';
import {useRouter, useSegments} from 'expo-router';
import {supabase} from "@/lib/supabase";

interface AuthGuardProps {
    children: ReactNode;
}

// Define public routes that don't require authentication
const publicPathsConfig = {
    groups: ['auth'],
    routes: ['stats', 'achievements'],
};

function isCurrentRoutePublic(segments: string[]): boolean {
    const isRootPath = segments.length === 0 || (segments.length === 1 && segments[0] === '');
    if (isRootPath) {
        return false; // Root requires authentication
    }

    // Check if the first segment is a public group
    if (publicPathsConfig.groups.includes(segments[0])) {
        return true;
    }

    // Check for top-level public routes
    if (publicPathsConfig.routes.includes(segments[0])) {
        return true;
    }

    // Check for public routes nested under a group (e.g., (tabs)/stats)
    return segments.length > 1 && publicPathsConfig.routes.includes(segments[1]);
}

export default function AuthGuard({children}: AuthGuardProps) {
    // Use individual selectors to prevent unnecessary re-renders
    const user = useAuthStore(state => state.user);
    const isInitialized = useAuthStore(state => state.isInitialized);
    const isLoading = useAuthStore(state => state.isLoading);
    const [isCheckingProfile, setIsCheckingProfile] = React.useState(true);
    const [needsProfileSetup, setNeedsProfileSetup] = React.useState(false);

    const segments = useSegments() as string[];
    const router = useRouter();

    // Check if we're at the root path
    const isRootPath = segments.length === 0 || (segments.length === 1 && segments[0] === '');

    // Memoize the segments join to prevent unnecessary re-renders
    const currentPath = React.useMemo(() => segments.join('/'), []);

    // Check if current route is profile-related
    const isProfileRoute = segments.includes('profile') || segments.includes('edit-profile');

    // Function to check if user has a profile
    const checkProfile = React.useCallback(async () => {
        if (!user) return { hasProfile: false, error: null };

        try {
            const { data: existingPlayer, error } = await supabase
                .from('players')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle(); // Use maybeSingle instead of single to handle no rows

            return {
                hasProfile: !!existingPlayer && !error,
                error: error
            };
        } catch (error) {
            console.error('Error checking profile:', error);
            return { hasProfile: false, error };
        }
    }, [user]);


    useEffect(() => {
        console.log('[AuthGuard] user:', !!user, 'isInitialized:', isInitialized, 'isLoading:', isLoading);

        if (!isInitialized || isLoading) {
            // Still loading, wait for initialization or loading to complete
            return;
        }


        const handleAuthFlow = async () => {
            if (!user) {
                // User is not logged in
                if (!isCurrentRoutePublic(segments)) {
                    console.log(`AuthGuard: User not logged in, current path "${currentPath}" is not public. Redirecting to /auth/login.`);
                    router.replace('/auth/login');
                } else {
                    console.log(`AuthGuard: User not logged in, current path "${currentPath}" is public.`);
                }
                setIsCheckingProfile(false);
            } else {
                // User is logged in, check if they have a profile
                const { hasProfile, error } = await checkProfile();
                setIsCheckingProfile(false);

                if (error) {
                    console.error('Error checking user profile:', error);
                    return;
                }

                if (!hasProfile) {
                    console.log('User needs to set up profile');
                    setNeedsProfileSetup(true);
                    if (!isProfileRoute) {
                        console.log('Redirecting to profile setup screen');
                        router.replace('/(tabs)/profile');
                    }
                    return;
                }


                // User has a profile, handle normal auth flow
                const isInAuthGroup = segments[0] === 'auth';

                if (isInAuthGroup) {
                    console.log(`AuthGuard: User logged in, current path "${currentPath}" is in auth group. Redirecting to tabs.`);
                    router.replace('/(tabs)');
                } else if (isRootPath) {
                    // If at root path, redirect to main content
                    console.log(`AuthGuard: User logged in at root path. Redirecting to main content.`);
                    router.replace('/(tabs)');
                } else {
                    console.log(`AuthGuard: User logged in, current path "${currentPath}" is allowed.`);
                }
            }
        };

        handleAuthFlow();
    }, [user, isInitialized, isLoading, segments, currentPath, router, checkProfile, isProfileRoute, isRootPath]);

    if (!isInitialized || isLoading || isCheckingProfile) {
        return (
            <View style={styles.loadingContainer} testID="loading-indicator">
                <ActivityIndicator size="large" color="#007AFF"/>
            </View>
        );
    }

    // If user needs to set up profile but is not on a profile route
    if (needsProfileSetup && !isProfileRoute) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF"/>
            </View>
        );
    }

    // The useEffect above handles all the redirection logic
    // If we reach here, it means the user can view the current route
    return <>{children}</>;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
});
