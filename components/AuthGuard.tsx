import React, { ReactNode, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading, isInitialized } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  
  // Check if navigation is ready
  useEffect(() => {
    if (rootNavigationState?.key) {
      setIsNavigationReady(true);
    }
  }, [rootNavigationState]);

  useEffect(() => {
    // Only attempt to redirect if:
    // 1. Auth is initialized
    // 2. Auth is not in a loading state
    // 3. User is not authenticated
    // 4. We're not already on the login screen
    // 5. Navigation is ready
    if (isInitialized && !isLoading && isNavigationReady) {
      const inAuthGroup = segments[0] === 'auth';
      
      if (!user && !inAuthGroup) {
        // Redirect to login page
        router.replace('/auth/login');
      }
    }
  }, [user, isLoading, isInitialized, router, segments, isNavigationReady]);

  // Special case for login screen - don't apply AuthGuard
  if (segments[0] === 'auth') {
    return <>{children}</>;
  }

  if (isLoading || !isInitialized || !isNavigationReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!user) {
    // Don't return null, instead show loading or a placeholder
    // This prevents layout shifts during navigation
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0000ff" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});