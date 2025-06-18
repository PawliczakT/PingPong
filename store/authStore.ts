import {create} from 'zustand';
import {Session, User} from '@supabase/supabase-js';
import {signInWithGoogle, signOut as supabaseSignOut, supabase} from '@/backend/server/lib/supabase';
import React from "react";

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
            await signInWithGoogle();
        } catch (e) {
            console.error('Exception during Google login:', e);
            set({error: e instanceof Error ? e : new Error('Login failed'), isLoading: false});
        }
    },

    logout: async () => {
        set({isLoading: true, error: null});
        try {
            await supabaseSignOut();
        } catch (e) {
            console.error('Exception during logout:', e);
            set({error: e instanceof Error ? e : new Error('Logout failed'), isLoading: false});
        }
    },

    clearError: () => {
        set({error: null});
    },
}));

// Export the hook with proper typing
export const useAuth = () => {
    const state = useAuthStore();

    // Initialize auth state when the hook is first used
    React.useEffect(() => {
        const cleanup = state.initialize();
        return () => cleanup?.();
    }, []);

    return state;
};

// Initialize auth state when the store is created
useAuthStore.getState().initialize();
