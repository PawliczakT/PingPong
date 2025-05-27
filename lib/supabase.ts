import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import {Platform} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const googleClientIdIOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
const googleClientIdAndroid = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '';

if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = 'KRYTYCZNY BŁĄD: Brakuje Supabase URL lub Anon Key. Sprawdź plik .env i prefiks EXPO_PUBLIC_, a następnie przebuduj aplikację.';
    console.error(errorMsg);
    throw new Error(errorMsg);
}


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
    if (Platform.OS === 'web') {
        const {data, error} = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'https://msiemlfljcnhnwkwwpvhm.supabase.co/auth/v1/callback',
            },
        });
        return {data, error};
    } else {
        try {
            const {data, error} = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;
            if (!data?.url) throw new Error('No login URL returned from Supabase');

            console.log(`[Auth] Opening browser for auth: ${data.url}`);

            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                'pingpongstatkeeper://'
            );

            console.log(`[Auth] Auth result type: ${result.type}`);

            if (result.type === 'success') {
                const {data: sessionData, error: sessionError} = await supabase.auth.getSession();
                if (sessionError) {
                    console.error('[Auth] Error getting session after auth flow:', sessionError);
                    return {data: null, error: sessionError};
                }
                if (!sessionData?.session) {
                    console.log('[Auth] No session found after successful auth flow');
                    return {data: null, error: new Error('Authentication completed but no session found')};
                }
                console.log('[Auth] Successfully authenticated with Google');
                return {data: sessionData, error: null};
            }

            return {
                data: null,
                error: new Error(`Authentication ${result.type === 'cancel' ? 'cancelled' : 'failed'}`),
            };
        } catch (error) {
            console.error('[Auth] Error during Google login:', error);
            return {
                data: null,
                error: error instanceof Error ? error : new Error('Failed to authenticate'),
            };
        }
    }
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};
