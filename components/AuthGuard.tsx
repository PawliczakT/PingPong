import React, { ReactNode, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/store/authStore'; // Assuming @ refers to root
import { useSegments, useRouter } from 'expo-router';

interface AuthGuardProps {
  children: ReactNode;
}

// Define public routes based on the requirements
// (auth) group is public.
// 'stats' and 'achievements' can be top-level or under a group like '(tabs)'.
const publicPathsConfig = {
  groups: ['(auth)'],
  routes: ['stats', 'achievements'],
};

function isCurrentRoutePublic(segments: string[]): boolean {
  if (segments.length === 0) {
    return false; // Or true if the root is considered public by default when unauthenticated
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
  if (segments.length > 1 && publicPathsConfig.routes.includes(segments[1])) {
    // Add a check for the parent group if necessary, e.g.
    // if (segments[0] === '(tabs)' && publicPathsConfig.routes.includes(segments[1])) {
    //   return true;
    // }
    // For now, allowing if the second segment is a public route, assuming they are typically within (tabs)
    return true;
  }

  return false;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, isInitialized, isLoading } = useAuthStore(state => ({
    user: state.user,
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
  }));

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized || isLoading) {
      // Still loading, wait for initialization or loading to complete
      return;
    }

    const currentPath = segments.join('/'); // For logging or more complex checks

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
      const isInAuthGroup = segments[0] === '(auth)';
      if (isInAuthGroup) {
        console.log(`AuthGuard: User logged in, current path "${currentPath}" is in auth group. Redirecting to /.`);
        router.replace('/'); // Redirect from auth pages like login/register to home
      } else {
        console.log(`AuthGuard: User logged in, current path "${currentPath}" is not in auth group.`);
      }
    }
  }, [user, isInitialized, isLoading, segments, router]);


  if (!isInitialized || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // If user is not authenticated and on a public route, or authenticated and not on an auth route
  // and no redirection is happening based on useEffect logic yet, render children.
  // The useEffect handles the redirection logic. If we reach here and conditions are met,
  // it implies the user is allowed to see the content.
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
