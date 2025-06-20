//store/authStore.ts
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

let authSubscription: any = null;
let isGloballyInitialized = false;

const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

export const useAuthStore = create<AuthState>((set, get) => {
    let lastEventTime = 0;
    let lastUserId: string | null = null;

    const debouncedSetAuth = debounce((user: User | null, session: Session | null) => {
        const currentState = get();

        if (currentState.user?.id === user?.id &&
            currentState.session?.access_token === session?.access_token) {
            return;
        }

        console.log('🔐 Setting auth state:', {
            userId: user?.id || 'null',
            hasSession: !!session
        });

        set({
            user,
            session,
            isLoading: false,
            isInitialized: true
        });
    }, 100);

    return {
        user: null,
        session: null,
        isLoading: true,
        isInitialized: false,
        error: null,

        initialize: () => {
            if (authSubscription) {
                console.log('🔐 Auth store already initialized, skipping...');
                return () => {
                };
            }

            console.log('🔐 Initializing auth store...');

            const {data: {subscription}} = supabase.auth.onAuthStateChange(
                (event, session) => {
                    const now = Date.now();
                    const userId = session?.user?.id || null;

                    if (now - lastEventTime < 200 &&
                        lastUserId === userId &&
                        event !== 'INITIAL_SESSION') {
                        console.log(`🔐 Skipping duplicate auth event: ${event}`);
                        return;
                    }

                    lastEventTime = now;
                    lastUserId = userId;

                    console.log(`🔐 Auth event: ${event}`, {
                        userId: userId || 'null',
                        hasSession: !!session
                    });

                    switch (event) {
                        case 'INITIAL_SESSION':
                            set({
                                user: session?.user ?? null,
                                session,
                                isLoading: false,
                                isInitialized: true
                            });
                            break;

                        case 'SIGNED_IN':
                            debouncedSetAuth(session?.user ?? null, session);
                            break;

                        case 'SIGNED_OUT':
                            set({
                                user: null,
                                session: null,
                                isLoading: false,
                                isInitialized: true
                            });
                            break;

                        case 'TOKEN_REFRESHED':
                            set((state) => ({
                                ...state,
                                session,
                                isLoading: false,
                                isInitialized: true
                            }));
                            break;

                        default:
                            console.log(`🔐 Unhandled auth event: ${event}`);
                    }
                }
            );

            authSubscription = subscription;

            return () => {
                console.log('🔐 Cleaning up auth subscription...');
                if (authSubscription) {
                    authSubscription.unsubscribe();
                    authSubscription = null;
                }
                lastEventTime = 0;
                lastUserId = null;
            };
        },

        loginWithGoogle: async () => {
            console.log('🔐 Starting Google login...');
            set({isLoading: true, error: null});

            try {
                await signInWithGoogle();
            } catch (e) {
                console.error('🔐 Google login failed:', e);
                const error = e instanceof Error ? e : new Error('Login failed');
                set({
                    error,
                    isLoading: false
                });
                throw error;
            }
        },

        logout: async () => {
            console.log('🔐 Starting logout...');
            set({isLoading: true, error: null});

            try {
                await supabaseSignOut();
            } catch (e) {
                console.error('🔐 Logout failed:', e);
                const error = e instanceof Error ? e : new Error('Logout failed');
                set({
                    error,
                    isLoading: false
                });
                throw error;
            }
        },

        clearError: () => {
            set({error: null});
        },
    };
});

export const useAuth = () => {
    const state = useAuthStore();

    React.useEffect(() => {
        if (isGloballyInitialized) {
            console.log('🔐 Auth already globally initialized');
            return () => {
            };
        }

        console.log('🔐 Setting up global auth initialization');
        isGloballyInitialized = true;

        const cleanup = state.initialize();

        return () => {
            console.log('🔐 Cleaning up global auth initialization');
            isGloballyInitialized = false;
            cleanup();
        };
    }, []);

    return state;
};
