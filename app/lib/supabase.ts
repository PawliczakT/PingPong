//app/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {Platform} from 'react-native';
import {makeRedirectUri} from 'expo-auth-session';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

class SupabaseClient {
    private static instance: any = null;
    private static instanceCount = 0;

    static getInstance() {
        if (!this.instance) {
            this.instanceCount++;
            if (typeof window !== 'undefined') {
                console.log(`🔍 Creating Supabase instance #${this.instanceCount}`);
            }

            this.instance = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    storage: {
                        getItem: (key: string) => AsyncStorage.getItem(key),
                        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
                        removeItem: (key: string) => AsyncStorage.removeItem(key),
                    },
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: Platform.OS === 'web',
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10,
                    },
                }
            });
        } else {
            console.log('🔄 Reusing existing Supabase instance');
        }
        return this.instance;
    }
}

export const supabase = SupabaseClient.getInstance();

const getRedirectUri = () => {
    if (Platform.OS === 'web') {
        if (process.env.NODE_ENV === 'development') {
            return 'http://localhost:8081/auth/callback';
        }
        return 'https://ping-pong-three-woad.vercel.app/auth/callback';
    }
    return makeRedirectUri({
        scheme: 'pingpongstatkeeper',
        path: 'auth/callback',
    });
};

const redirectUri = getRedirectUri();

export const signInWithGoogle = async () => {
    const {data, error} = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUri,
            queryParams: {access_type: 'offline', prompt: 'select_account'},
            skipBrowserRedirect: Platform.OS !== 'web',
        },
    });
    if (error) throw error;

    if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            Linking.createURL('auth/callback'),
            {showInRecents: true},
        );
        if (result.type === 'success' && result.url) {
            const {error} = await supabase.auth.getSessionFromUrl(result.url, {
                checkSession: false,
            });

            if (error) {
                console.error('Error getting session from URL:', error.message);
                throw new Error('Failed to process authentication callback.');
            }
        }
    }
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};
