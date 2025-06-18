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
    const redirectUrl = Platform.select({
        web: 'https://ping-pong-three-woad.vercel.app/auth/callback',
        default: 'pingpongstatkeeper://auth/callback'
    });

    console.log(`[Auth] Starting Google OAuth with redirect: ${redirectUrl}`);

    const {data, error} = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: Platform.OS !== 'web',
        },
    });

    if (error) throw error;
    if (Platform.OS === 'web' || !data?.url) return {data, error};

    // Dla aplikacji mobilnej
    const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
    );

    if (result.type !== 'dismiss') {
        WebBrowser.dismissBrowser();
    }

    if (result.type === 'success') {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1));

        const {data: sessionData, error: sessionError} = await supabase.auth.setSession({
            access_token: params.get('access_token') || '',
            refresh_token: params.get('refresh_token') || '',
        });

        if (sessionError) throw sessionError;
        return {data: sessionData, error: null};
    }

    return {
        data: null,
        error: new Error(`Authentication ${result.type === 'cancel' ? 'cancelled' : 'failed'}`),
    };
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};
