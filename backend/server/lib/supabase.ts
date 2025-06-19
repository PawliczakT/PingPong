//app/(auth)/login.tsx
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {Platform} from 'react-native';

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
        detectSessionInUrl: Platform.OS === 'web',
    },
});

export const signInWithGoogle = async () => {
    try {
        let redirectUrl;

        if (Platform.OS === 'web') {
            // Dla web używaj Supabase callback URL
            redirectUrl = `${supabaseUrl}/auth/v1/callback`;
        } else {
            // Dla mobile używaj deep link
            redirectUrl = Linking.createURL('auth/callback');
        }

        const {data, error} = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account',
                },
                skipBrowserRedirect: Platform.OS !== 'web',
            },
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No auth URL returned');

        if (Platform.OS === 'web') {
            window.location.href = data.url;
            return;
        }

        // For mobile
        const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectUrl,
            {showInRecents: true}
        );

        if (result.type === 'success') {
            const url = new URL(result.url);
            const params = new URLSearchParams(url.hash.substring(1));

            const {error: sessionError} = await supabase.auth.setSession({
                access_token: params.get('access_token') || '',
                refresh_token: params.get('refresh_token') || '',
            });

            if (sessionError) throw sessionError;
        } else {
            throw new Error(`Authentication ${result.type}`);
        }
    } catch (error) {
        console.error('Error during Google sign in:', error);
        throw error;
    }
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};
