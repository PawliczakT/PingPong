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
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    session: null,
    isLoading: false,
    isInitialized: false,
    error: null,

    loginWithGoogle: async () => {
        set({isLoading: true, error: null});
        try {
            const {error, data} = await signInWithGoogle();
            if (error) {
                console.error('Error during Google login:', error);
                set({error, isLoading: false});
                return;
            }
            console.log('[Auth] Successfully authenticated with Google');
        } catch (e) {
            console.error('Exception during Google login:', e);
            set({error: e instanceof Error ? e : new Error('Login failed'), isLoading: false});
        }
    },

    logout: async () => {
        set({isLoading: true, error: null});
        try {
            const {error} = await supabaseSignOut();
            if (error) {
                console.error('Error during logout:', error);
                set({error, isLoading: false});
            } else {
                console.log('[Logout] User logged out successfully');
            }
        } catch (e) {
            console.error('Exception during logout:', e);
            set({error: e instanceof Error ? e : new Error('Logout failed'), isLoading: false});
        }
    },

    clearError: () => {
        set({error: null});
    },
}));

// UPROSZCZONA inicjalizacja BEZ tworzenia profili
const initializeAuth = async () => {
    useAuthStore.setState({isLoading: true});
    try {
        const {data: {session}, error} = await supabase.auth.getSession();
        if (error) {
            console.error('Error getting initial session:', error);
            useAuthStore.setState({error, isLoading: false, isInitialized: true});
        } else if (session) {
            useAuthStore.setState({session, user: session.user, isLoading: false, isInitialized: true});
            console.log('Session initialized');
        } else {
            useAuthStore.setState({isLoading: false, isInitialized: true});
        }
    } catch (e) {
        console.error('Exception during initial session check:', e);
        useAuthStore.setState({
            error: e instanceof Error ? e : new Error('Initialization failed'),
            isLoading: false,
            isInitialized: true
        });
    }

    // UPROSZCZONY listener BEZ automatycznego tworzenia profili
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event);

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session) {
                useAuthStore.setState({
                    session,
                    user: session.user,
                    error: null,
                    isLoading: false,
                    isInitialized: true
                });
            } else {
                useAuthStore.setState({
                    session: null,
                    user: null,
                    error: null,
                    isLoading: false,
                    isInitialized: true
                });
            }
        } else if (event === 'SIGNED_OUT') {
            useAuthStore.setState({
                session: null,
                user: null,
                error: null,
                isLoading: false,
                isInitialized: true
            });
        } else if (event === 'USER_UPDATED') {
            if (session) {
                useAuthStore.setState({
                    session,
                    user: session.user,
                    error: null,
                    isLoading: false,
                    isInitialized: true
                });
            }
        } else {
            if (session) {
                useAuthStore.setState({session, user: session.user, isLoading: false, isInitialized: true});
            } else {
                useAuthStore.setState({isLoading: false, isInitialized: true});
            }
        }
    });
};

initializeAuth().catch(error =>
    error && console.error('Error initializing auth:', error)
);
