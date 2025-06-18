import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const ExpoSecureStoreAdapter = {
    getItem: (key: string) => {
        return AsyncStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        return AsyncStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        return AsyncStorage.removeItem(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

export const signInWithGoogle = async () => {
    try {
        // For web
        if (Platform.OS === 'web') {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account',
                    },
                },
            });
            if (error) throw error;
            return;
        }

        // For mobile
        const redirectUrl = Linking.createURL('auth/callback');
        console.log('Redirect URL:', redirectUrl);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
            },
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No auth URL returned');

        // Add a small delay to ensure the browser opens after the current stack clears
        setTimeout(async () => {
            try {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUrl,
                    { showInRecents: true }
                );

                if (result.type === 'success') {
                    const url = new URL(result.url);
                    const params = new URLSearchParams(url.hash.substring(1));

                    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                        access_token: params.get('access_token') || '',
                        refresh_token: params.get('refresh_token') || '',
                    });

                    if (sessionError) throw sessionError;
                    return { data: sessionData, error: null };
                }

                throw new Error(`Authentication ${result.type}`);
            } catch (error) {
                console.error('Error in auth session:', error);
                throw error;
            }
        }, 100);

    } catch (error) {
        console.error('Error during Google sign in:', error);
        throw error;
    }
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};
