import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, signInWithGoogle, signOut } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Type guard to check if data has a session property
const hasSession = (data: any): data is { session: Session; user: User } => {
  return data && data.session && typeof data.session === 'object';
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      isLoading: true, // Start with loading true
      error: null,
      isInitialized: false,
      
      initialize: async () => {
        // If already initialized, don't do it again
        if (get().isInitialized) return;
        
        set({ isLoading: true });
        try {
          console.log("Initializing auth store...");
          // Check if we have an existing session
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Error getting session:", error.message);
            throw error;
          }
          
          if (data?.session) {
            console.log("Found existing session");
            set({ 
              session: data.session,
              user: data.session.user,
            });
          } else {
            console.log("No existing session found");
          }
          
          // Set up auth state change listener
          const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth state changed:", event);
            set({ 
              session,
              user: session?.user || null,
            });
          });
          
          // Mark as initialized
          set({ isInitialized: true });
          
        } catch (error) {
          console.error("Auth initialization error:", error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to initialize auth'
          });
        } finally {
          set({ isLoading: false });
        }
      },
      
      login: async () => {
        set({ isLoading: true, error: null });
        try {
          console.log("Starting Google sign in...");
          const { data, error } = await signInWithGoogle();
          
          if (error) {
            console.error("Google sign in error:", error);
            throw error;
          }
          
          // Check if data contains a session using type guard
          if (data && hasSession(data)) {
            console.log("Google sign in successful with session");
            // The session will be automatically updated by the onAuthStateChange listener
          } else {
            console.log("OAuth flow initiated, waiting for completion");
            // For OAuth with redirect, we might not get a session immediately
            // The session will be handled by the onAuthStateChange listener
          }
          
        } catch (error) {
          console.error("Login error:", error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to sign in with Google';
          set({ error: errorMessage });
          Alert.alert("Login Failed", errorMessage);
        } finally {
          set({ isLoading: false });
        }
      },
      
      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          console.log("Signing out...");
          const { error } = await signOut();
          
          if (error) {
            console.error("Sign out error:", error);
            throw error;
          }
          
          console.log("Sign out successful");
          // The session will be automatically cleared by the onAuthStateChange listener
          
        } catch (error) {
          console.error("Logout error:", error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to sign out'
          });
        } finally {
          set({ isLoading: false });
        }
      },
      
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'pingpong-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        // Only persist these fields
        session: state.session,
        user: state.user,
        isInitialized: state.isInitialized,
      }),
    }
  )
);