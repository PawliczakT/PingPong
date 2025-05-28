import {create} from 'zustand';
import {Session, User} from '@supabase/supabase-js';
import {signInWithGoogle, signOut as supabaseSignOut, supabase} from '../lib/supabase';

// Direct player profile service without using tRPC
const ensurePlayerProfile = async (userId: string) => {
    try {
        // First check if player exists
        const { data: existingPlayer, error: fetchError } = await supabase
            .from('players')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
            console.error('Error checking player profile:', fetchError);
            return { success: false, error: fetchError };
        }

        if (existingPlayer) {
            console.log('Player profile already exists');
            return { success: true, isNew: false, player: existingPlayer };
        }

        // If we get here, we need to create a new player
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) {
            const error = new Error('User not found');
            console.error('User data not found for profile creation');
            return { success: false, error };
        }

        const newPlayer = {
            user_id: user.id,
            name: user.user_metadata?.full_name || user.user_metadata?.name || 'New Player',
            nickname: undefined,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
            elo_rating: 1200,
            wins: 0,
            losses: 0,
            active: true,
        };

        const { data: createdPlayer, error: createError } = await supabase
            .from('players')
            .insert(newPlayer)
            .select()
            .single();

        if (createError) {
            console.error('Error creating player profile:', createError);
            return { success: false, error: createError };
        }

        console.log('Successfully created new player profile');
        return { success: true, isNew: true, player: createdPlayer };

    } catch (error) {
        console.error('Exception during player profile creation:', error);
        return { success: false, error };
    }
};

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
            // signInWithGoogle in lib/supabase.ts handles the OAuth flow.
            const {error, data} = await signInWithGoogle();
            if (error) {
                console.error('Error during Google login:', error);
                set({error, isLoading: false});
                return;
            }
            console.log('[Login] Authentication flow completed successfully');
            // The onAuthStateChange listener will handle setting user and session
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
                // onAuthStateChange will handle setting user and session to null
                // and isLoading to false
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

// Initial session check and subscription
const initializeAuth = async () => {
    useAuthStore.setState({isLoading: true});
    try {
        const {data: {session}, error} = await supabase.auth.getSession();
        if (error) {
            console.error('Error getting initial session:', error);
            useAuthStore.setState({error, isLoading: false, isInitialized: true});
        } else if (session) {
            useAuthStore.setState({session, user: session.user, isLoading: false, isInitialized: true});

            // Don't create profile automatically, just set the state
            console.log('Session initialized, profile will be created on first navigation');
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

    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event, session);
        useAuthStore.setState({isLoading: true});

        if (event === 'SIGNED_IN') {
            if (session) {
                useAuthStore.setState({
                    session,
                    user: session.user,
                    error: null,
                    isLoading: false,
                    isInitialized: true
                });

                // Ensure player profile on SIGNED_IN without using tRPC hooks
                ensurePlayerProfile(session.user.id)
                    .then(result => {
                        if (result.success) {
                            console.log('Player profile ensured for SIGNED_IN event.');
                        } else {
                            console.error('Failed to ensure player profile for SIGNED_IN event:', result.error);
                        }
                    });
            } else {
                console.warn('SIGNED_IN event received but session is null.');
                useAuthStore.setState({session: null, user: null, error: null, isLoading: false, isInitialized: true});
            }
        } else if (event === 'SIGNED_OUT') {
            useAuthStore.setState({session: null, user: null, error: null, isLoading: false, isInitialized: true});
        } else if (event === 'USER_UPDATED') {
            if (session) {
                useAuthStore.setState({
                    session,
                    user: session.user,
                    error: null,
                    isLoading: false,
                    isInitialized: true
                });
            } else {
                console.warn('USER_UPDATED event received but session is null.');
                useAuthStore.setState({session: null, user: null, error: null, isLoading: false, isInitialized: true});
            }
        } else if (event === 'INITIAL_SESSION') {
            if (session) {
                useAuthStore.setState({
                    session,
                    user: session.user,
                    error: null,
                    isLoading: false,
                    isInitialized: true
                });

                // Ensure player profile on INITIAL_SESSION without using tRPC hooks
                ensurePlayerProfile(session.user.id)
                    .then(result => {
                        if (result.success) {
                            console.log('Player profile ensured for INITIAL_SESSION event.');
                        } else {
                            console.error('Failed to ensure player profile for INITIAL_SESSION event:', result.error);
                        }
                    });
            } else {
                useAuthStore.setState({session: null, user: null, error: null, isLoading: false, isInitialized: true});
            }
        } else {
            // For other events like TOKEN_REFRESHED, PASSWORD_RECOVERY, etc.
            if (session) {
                useAuthStore.setState({session, user: session.user, isLoading: false, isInitialized: true});
            } else {
                useAuthStore.setState({isLoading: false, isInitialized: true});
            }
        }
    });
};

// Call initializeAuth when the store is imported/loaded.
initializeAuth().catch(error =>
    error && console.error('Error initializing auth:', error)
);
