// backend/server/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {Platform} from 'react-native';

declare global {
    interface Window {
        supabaseInstanceCount?: number;
    }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined') {
    window.supabaseInstanceCount = (window.supabaseInstanceCount || 0) + 1;
    console.log(`🔍 Creating Supabase instance #${window.supabaseInstanceCount}`);
}

const ExpoSecureStoreAdapter = {
    getItem: (key: string) => AsyncStorage.getItem(key),
    setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
    removeItem: (key: string) => AsyncStorage.removeItem(key),
};

let supabaseInstance: any = null;

export const supabase = (() => {
    if (supabaseInstance) {
        console.log('🔄 Reusing existing Supabase instance');
        return supabaseInstance;
    }

    if (typeof window !== 'undefined') {
        window.supabaseInstanceCount = (window.supabaseInstanceCount || 0) + 1;
        console.log(`🔍 Creating Supabase instance #${window.supabaseInstanceCount}`);
    }

    console.log('🆕 Creating new Supabase client instance');
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storage: ExpoSecureStoreAdapter,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: Platform.OS === 'web',
        },
    });

    return supabaseInstance;
})();

export const signInWithGoogle = async () => {
    try {
        const {data, error} = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: Platform.OS === 'web'
                    ? window.location.origin
                    : Linking.createURL('auth/callback'),
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account',
                },
                skipBrowserRedirect: Platform.OS !== 'web',
            },
        });

        if (error) throw error;

        if (Platform.OS !== 'web') {
            if (!data?.url) throw new Error('No auth URL returned for mobile');

            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                Linking.createURL('auth/callback'),
                {showInRecents: true}
            );

            if (result.type === 'success' && result.url) {
                const url = new URL(result.url);
                const accessToken = new URLSearchParams(url.hash.substring(1)).get('access_token');
                const refreshToken = new URLSearchParams(url.hash.substring(1)).get('refresh_token');

                if (!accessToken || !refreshToken) {
                    throw new Error('Tokens not found in mobile redirect URL');
                }

                const {error: sessionError} = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (sessionError) throw sessionError;
            } else if (result.type !== 'cancel') {
                throw new Error(`Authentication failed or was canceled: ${result.type}`);
            }
        }

    } catch (error) {
        console.error('Error during Google sign in:', error);
        throw error;
    }
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};
