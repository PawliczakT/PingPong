import {create} from 'zustand';
import {Session, User} from '@supabase/supabase-js';
import {signInWithGoogle, signOut as supabaseSignOut, supabase} from '../lib/supabase';

// Direct player profile service without using tRPC
const ensurePlayerProfile = async (userId: string) => {
    try {
        // 1. Query for existing player
        const {data: existingPlayer, error: fetchError} = await supabase
            .from('players')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError) {
            console.error('Error fetching player profile:', fetchError);
            return {success: false, error: fetchError};
        }

        if (existingPlayer) {
            console.log('Player profile already exists');
            return {success: true, player: existingPlayer};
        }

        // 2. If no player exists, create one
        // Get user metadata for name and avatar
        const {data: userData} = await supabase.auth.getUser(userId);
        const user = userData?.user;

        if (!user) {
            console.error('User data not found for profile creation');
            return {success: false, error: new Error('User not found')};
        }

        const userName = user.user_metadata?.full_name || user.user_metadata?.name || 'Anonymous Player';
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

        const newPlayerData = {
            user_id: userId,
            name: userName,
            avatar_url: avatarUrl,
            elo_rating: 1000,
            wins: 0,
            losses: 0,
            active: true,
        };

        const {data: newPlayer, error: insertError} = await supabase
            .from('players')
            .insert(newPlayerData)
            .select()
            .single();

        if (insertError) {
            console.error('Error creating player profile:', insertError);
            return {success: false, error: insertError};
        }

        console.log('Successfully created new player profile');
        return {success: true, player: newPlayer};
    } catch (error) {
        console.error('Exception during player profile creation:', error);
        return {success: false, error};
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

            // Ensure player profile on initial session without using tRPC hooks
            const userId = session.user.id;
            ensurePlayerProfile(userId)
                .then(result => {
                    if (result.success) {
                        console.log('Player profile ensured for initial session.');
                    } else {
                        console.error('Failed to ensure player profile for initial session:', result.error);
                    }
                });
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
initializeAuth();
