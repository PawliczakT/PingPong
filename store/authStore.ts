//store/authStore.ts
import {create} from 'zustand';
import {Session, User} from '@supabase/supabase-js';
import {signInWithGoogle, signOut as supabaseSignOut, supabase} from '../lib/supabase';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isInitialized: boolean;
    error: Error | null;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
    initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    isLoading: true,
    isInitialized: false,
    error: null,

    initialize: () => {
        const {data: {subscription}} = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log(`Auth event: ${event}`);
                set({
                    user: session?.user ?? null,
                    session,
                    isLoading: false,
                    isInitialized: true
                });
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    },

    loginWithGoogle: async () => {
        set({isLoading: true, error: null});
        try {
            const {error} = await signInWithGoogle();
            if (error) throw error;
        } catch (e) {
            console.error('Exception during Google login:', e);
            set({error: e instanceof Error ? e : new Error('Login failed'), isLoading: false});
        }
    },

    logout: async () => {
        set({isLoading: true, error: null});
        try {
            const {error} = await supabaseSignOut();
            if (error) throw error;
            set({user: null, session: null, isLoading: false});
        } catch (e) {
            console.error('Exception during logout:', e);
            set({error: e instanceof Error ? e : new Error('Logout failed'), isLoading: false});
        }
    },

    clearError: () => {
        set({error: null});
    },
}));

useAuthStore.getState().initialize();

export const useAuth = () => useAuthStore();
