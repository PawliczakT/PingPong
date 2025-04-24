import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Slot, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import { ErrorBoundary } from "./error-boundary";
import { useNetworkStore } from "@/store/networkStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Create a client for React Query
const queryClient = new QueryClient();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });
  
  const { checkNetworkStatus, syncPendingMatches } = useNetworkStore();
  const { initialize: initializeAuth } = useAuthStore();

  useEffect(() => {
    if (error) {
      console.error(error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);
  
  useEffect(() => {
    // Initialize auth
    initializeAuth();
    
    // Check network status and sync pending matches on app start
    const initializeNetwork = async () => {
      const isOnline = await checkNetworkStatus();
      if (isOnline) {
        await syncPendingMatches();
      }
    };
    
    initializeNetwork();
    
    // Set up interval to check network and sync
    const interval = setInterval(async () => {
      const isOnline = await checkNetworkStatus();
      if (isOnline) {
        await syncPendingMatches();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  if (!loaded) {
    return <Slot />; // Return empty Slot instead of null to ensure layout is mounted
  }

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthGuard>
            <RootLayoutNav />
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
      }}
    >
      <Stack.Screen 
        name="(tabs)" 
        options={{ headerShown: false }} 
      />
      
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      
      <Stack.Screen 
        name="player/[id]" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="player/create" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="player/edit/[id]" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="match/[id]" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="tournament/[id]" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="tournament/create" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="tournament/record-match" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="matches" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="stats/head-to-head" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="notifications" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen 
        name="settings" 
        options={{ headerShown: true }}
      />
      
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
    </Stack>
  );
}