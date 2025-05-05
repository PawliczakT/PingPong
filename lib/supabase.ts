import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import {Platform} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';

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
                redirectTo: window.location.origin,
            },
        });
        if (error) console.error('Web OAuth Error:', error);
        return {data, error};
    } else {
        try {
            const configScheme = Constants.expoConfig?.scheme;
            const scheme = typeof configScheme === 'string'
                ? configScheme
                : Array.isArray(configScheme) && configScheme.length > 0
                    ? configScheme[0]
                    : 'pingpongstatkeeper';

            let redirectUrl: string | undefined = undefined;

            if (Platform.OS === 'android') {
                const result = AuthSession.makeRedirectUri({
                    scheme: scheme,
                    path: 'auth/callback',
                });
                const resolvedUrl = Array.isArray(result) ? result[0] : result;
                if (typeof resolvedUrl === 'string' && resolvedUrl) {
                    redirectUrl = resolvedUrl;
                }
            } else {
                const result = AuthSession.makeRedirectUri({
                    scheme: scheme,
                    path: 'auth/callback',
                });
                const resolvedUrl = Array.isArray(result) ? result[0] : result;
                if (typeof resolvedUrl === 'string' && resolvedUrl) {
                    redirectUrl = resolvedUrl;
                }
            }

            if (!redirectUrl) {
                console.error('Failed to create redirect URL.');
                return {data: null, error: new Error('Failed to create redirect URL.')};
            }

            const {data: oauthData, error: oauthError} = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (oauthError || !oauthData?.url) {
                console.error('Error creating auth URL:', oauthError);
                return {data: null, error: oauthError || new Error('Auth URL was not generated.')};
            }

            console.log('Auth URL created:', oauthData.url);

            const authResponse = await WebBrowser.openAuthSessionAsync(
                oauthData.url,
                redirectUrl
            );

            if (authResponse.type === 'success') {
                const {url} = authResponse;
                return {data: null, error: null};
            } else if (authResponse.type === 'cancel' || authResponse.type === 'dismiss') {
                console.log('Authentication cancelled or dismissed by user.');
                return {data: null, error: new Error('Authentication cancelled or dismissed')};
            } else {
                console.error('Authentication failed with WebBrowser result:', authResponse);
                return {data: null, error: new Error('Authentication failed or was cancelled')};
            }

        } catch (error) {
            console.error('Error during Google sign in:', error);
            return {
                data: null,
                error: error instanceof Error ? error : new Error('Unknown error during authentication')
            };
        }
    }
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};
