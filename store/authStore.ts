// store/authStore.ts
import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/backend/server/lib/supabase';

interface AuthState {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    error: string | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    setSession: (session: Session | null) => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    isLoading: false,
    error: null,

    signInWithGoogle: async () => {
        set({ isLoading: true, error: null });
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                throw error;
            }
        } catch (error: any) {
            console.error('Błąd logowania przez Google:', error);
            set({
                error: error.message || 'Wystąpił błąd podczas logowania przez Google',
                isLoading: false
            });
        } finally {
            set({ isLoading: false });
        }
    },

    signOut: async () => {
        set({ isLoading: true });
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            set({ session: null, user: null });
        } catch (error: any) {
            console.error('Błąd podczas wylogowywania:', error);
            set({
                error: error.message || 'Wystąpił błąd podczas wylogowywania',
                isLoading: false
            });
        } finally {
            set({ isLoading: false });
        }
    },

    setSession: (session) => {
        set({
            session,
            user: session?.user ?? null,
            isLoading: false
        });
    },

    clearError: () => {
        set({ error: null });
    }
}));

export const useAuth = () => useAuthStore();
