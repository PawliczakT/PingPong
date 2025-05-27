import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase, signInWithGoogle, signOut as supabaseSignOut } from '../lib/supabase';
import { trpcClient } from '../lib/trpc'; // Import trpcClient

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: Error | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      // signInWithGoogle in lib/supabase.ts handles the OAuth flow.
      // The onAuthStateChange listener will handle setting user and session.
      const { error } = await signInWithGoogle();
      if (error) {
        console.error('Error during Google login:', error);
        set({ error, isLoading: false });
      }
      // isLoading will be set to false by onAuthStateChange or if an error occurs immediately
    } catch (e) {
      console.error('Exception during Google login:', e);
      set({ error: e instanceof Error ? e : new Error('Login failed'), isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabaseSignOut();
      if (error) {
        console.error('Error during logout:', error);
        set({ error, isLoading: false });
      } else {
        // onAuthStateChange will handle setting user and session to null
        // and isLoading to false
      }
    } catch (e) {
      console.error('Exception during logout:', e);
      set({ error: e instanceof Error ? e : new Error('Logout failed'), isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Initial session check and subscription
const initializeAuth = async () => {
  useAuthStore.setState({ isLoading: true });
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting initial session:', error);
      useAuthStore.setState({ error, isLoading: false, isInitialized: true });
    } else if (session) {
      useAuthStore.setState({ session, user: session.user, isLoading: false, isInitialized: true });
      // Call ensurePlayerProfile on initial session
      trpcClient.player.ensureProfile.mutate()
        .then(() => console.log('Player profile ensured for initial session.'))
        .catch(err => console.error('Failed to ensure player profile for initial session:', err));
    } else {
      useAuthStore.setState({ isLoading: false, isInitialized: true });
    }
  } catch (e) {
    console.error('Exception during initial session check:', e);
    useAuthStore.setState({ error: e instanceof Error ? e : new Error('Initialization failed'), isLoading: false, isInitialized: true });
  }

  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session);
    useAuthStore.setState({ isLoading: true });
    if (event === 'SIGNED_IN') {
      if (session) {
        useAuthStore.setState({ session, user: session.user, error: null, isLoading: false, isInitialized: true });
        // Call ensurePlayerProfile on SIGNED_IN event
        trpcClient.player.ensureProfile.mutate()
          .then(() => console.log('Player profile ensured for SIGNED_IN event.'))
          .catch(err => console.error('Failed to ensure player profile for SIGNED_IN event:', err));
      } else {
        // This case should ideally not happen if SIGNED_IN event occurs with a null session
        console.warn('SIGNED_IN event received but session is null.');
        useAuthStore.setState({ session: null, user: null, error: null, isLoading: false, isInitialized: true });
      }
    } else if (event === 'SIGNED_OUT') {
      useAuthStore.setState({ session: null, user: null, error: null, isLoading: false, isInitialized: true });
    } else if (event === 'USER_UPDATED') {
      if (session) {
        useAuthStore.setState({ session, user: session.user, error: null, isLoading: false, isInitialized: true });
      } else {
         // This might happen if user is updated but session becomes invalid, though less common.
        console.warn('USER_UPDATED event received but session is null.');
        useAuthStore.setState({ session: null, user: null, error: null, isLoading: false, isInitialized: true });
      }
    } else if (event === 'INITIAL_SESSION') {
        if (session) {
            useAuthStore.setState({ session, user: session.user, error: null, isLoading: false, isInitialized: true });
            // Call ensurePlayerProfile on INITIAL_SESSION event
            trpcClient.player.ensureProfile.mutate()
              .then(() => console.log('Player profile ensured for INITIAL_SESSION event.'))
              .catch(err => console.error('Failed to ensure player profile for INITIAL_SESSION event:', err));
        } else {
            useAuthStore.setState({ session: null, user: null, error: null, isLoading: false, isInitialized: true });
        }
    } else {
        // For other events like TOKEN_REFRESHED, PASSWORD_RECOVERY, etc.
        // Update session if available, otherwise ensure initialization is marked.
        if (session) {
            useAuthStore.setState({ session, user: session.user, isLoading: false, isInitialized: true });
        } else {
            useAuthStore.setState({ isLoading: false, isInitialized: true }); // Ensure isInitialized is true
        }
    }
  });
};

// Call initializeAuth when the store is imported/loaded.
// This ensures the subscription and initial check happen once.
initializeAuth();
