import React, {ReactNode, useEffect} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {useAuthStore} from '@/store/authStore';
import {useRouter, useSegments} from 'expo-router';

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

    const segments = useSegments() as string[];
    const router = useRouter();

    // Check if we're at the root path
    const isRootPath = segments.length === 0 || (segments.length === 1 && segments[0] === '');

    // Memoize the segments join to prevent unnecessary re-renders
    const currentPath = React.useMemo(() => segments.join('/'), []);

    useEffect(() => {
        console.log('[AuthGuard] user:', !!user, 'isInitialized:', isInitialized, 'isLoading:', isLoading);

        if (!isInitialized || isLoading) {
            // Still loading, wait for initialization or loading to complete
            return;
        }

        if (!user) {
            // User is not logged in
            if (!isCurrentRoutePublic(segments)) {
                console.log(`AuthGuard: User not logged in, current path "${currentPath}" is not public. Redirecting to /auth/login.`);
                router.replace('/auth/login');
            } else {
                console.log(`AuthGuard: User not logged in, current path "${currentPath}" is public.`);
            }
        } else {
            // User is logged in
            const isInAuthGroup = segments[0] === 'auth';

            if (isInAuthGroup) {
                console.log(`AuthGuard: User logged in, current path "${currentPath}" is in auth group. Redirecting to profile.`);

                // Check if we're coming from a deep link or first login
                const isInitialLogin = currentPath === 'auth/login';

                if (isInitialLogin) {
                    // On initial login, navigate to edit profile to set up the player
                    router.replace('/(tabs)/profile');
                } else {
                    // If coming from elsewhere in the auth group, go to tabs
                    router.replace('/(tabs)');
                }
            } else if (isRootPath) {
                // If at root path, redirect to main content
                console.log(`AuthGuard: User logged in at root path. Redirecting to main content.`);
                router.replace('/(tabs)');
            } else {
                console.log(`AuthGuard: User logged in, current path "${currentPath}" is allowed.`);
            }
        }
    }, [user, isInitialized, isLoading, segments, currentPath, router]);

    if (!isInitialized || isLoading) {
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
