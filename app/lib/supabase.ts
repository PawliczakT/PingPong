import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {Platform} from 'react-native';

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
