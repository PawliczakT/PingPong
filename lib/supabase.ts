import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';

// Initialize the Supabase client with direct values
// Make sure these match your actual Supabase project values
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Platform-specific Google OAuth client IDs
const googleClientIdIOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
const googleClientIdAndroid = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase URL or Anonymous Key. Please check your environment variables.');
  // Optionally, throw an error or handle this situation appropriately
  // throw new Error('Missing Supabase configuration.');
}

// Create a custom storage implementation using AsyncStorage
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

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper for Google Auth
export const signInWithGoogle = async () => {
  if (Platform.OS === 'web') {
    // Handle web authentication
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // On web, let Supabase handle the redirect automatically
        // You might need to configure the redirect URL in your Supabase project settings
        // redirectTo: window.location.origin, // Keep if needed for specific flows
      },
    });
    // Note: For web, Supabase usually handles the redirect and session detection automatically.
    // You might not need to return data/error here unless you have specific post-redirect logic.
    if (error) console.error('Web OAuth Error:', error);
    return { data, error }; // Or handle the redirect/session state elsewhere
  } else {
    // Handle native authentication (iOS and Android)
    try {
      // Get the app info for the redirect URL
      const scheme = Constants.expoConfig?.scheme || 'pingpongstatkeeper';
      // Note: package name is not typically used directly in makeRedirectUri for standard OAuth
      // const packageName = Constants.expoConfig?.android?.package || 'app.rork.pingpong_statkeeper';

      // Create a proper redirect URL based on the platform
      let redirectUrl: string | undefined = undefined; // Initialize as potentially undefined

      if (Platform.OS === 'android') {
        // For Android, use the scheme
        const result = AuthSession.makeRedirectUri({
          scheme: scheme,
          path: 'auth/callback',
          // native: `${scheme}://auth/callback`, // Often equivalent to just scheme
        });
        // **FIX START (Android)**
        const resolvedUrl = Array.isArray(result) ? result[0] : result;
        if (typeof resolvedUrl === 'string' && resolvedUrl) {
            redirectUrl = resolvedUrl;
        }
        // **FIX END (Android)**
        console.log('Android Redirect URL:', redirectUrl);
      } else {
        // For iOS, use the scheme
        const result = AuthSession.makeRedirectUri({
          scheme: scheme,
          path: 'auth/callback',
        });
       // **FIX START (iOS)**
       const resolvedUrl = Array.isArray(result) ? result[0] : result;
        if (typeof resolvedUrl === 'string' && resolvedUrl) {
            redirectUrl = resolvedUrl;
        }
       // **FIX END (iOS)**
        console.log('iOS Redirect URL:', redirectUrl);
      }

      // **Add Check:** Ensure redirectUrl was successfully created
      if (!redirectUrl) {
          console.error('Failed to create redirect URL.');
          return { data: null, error: new Error('Failed to create redirect URL.') };
      }

      // Set platform-specific client ID
      // Note: Supabase typically handles client IDs via its dashboard configuration for native providers.
      // You might only need these if doing manual OAuth flows, but with signInWithOAuth, Supabase usually infers this.
      // Let's comment these out unless you have a specific reason for needing them here.
      /*
      let clientId = '';
      if (Platform.OS === 'ios') {
          clientId = googleClientIdIOS;
      } else if (Platform.OS === 'android') {
          clientId = googleClientIdAndroid;
      }
      console.log('Using client ID:', clientId); // Verify if this is truly needed with Supabase helper
      */

      // Create the auth URL
      const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl, // Use the resolved redirect URL
          skipBrowserRedirect: true, // Important for native flows
          // queryParams: { access_type: 'offline', prompt: 'consent' } // Add if needed for refresh tokens etc.
        },
      });

      if (oauthError || !oauthData?.url) {
        console.error('Error creating auth URL:', oauthError);
        return { data: null, error: oauthError || new Error('Auth URL was not generated.') };
      }

      console.log('Auth URL created:', oauthData.url);

      // Open the URL with WebBrowser
      const authResponse = await WebBrowser.openAuthSessionAsync(
        oauthData.url,
        redirectUrl // The URL the browser should redirect back *to* after auth
      );

      console.log('WebBrowser result type:', authResponse.type);

      // Handle the returned URL
      if (authResponse.type === 'success') {
        const { url } = authResponse;
        console.log('Success URL:', url);

        // Supabase listens for the session change via the deep link automatically when using skipBrowserRedirect correctly.
        // The exchangeCodeForSession step is usually *not* needed here because the Supabase client
        // handles the session creation internally when the app is opened via the redirect URL.
        // You should listen for auth state changes instead.

        // **REMOVE or COMMENT OUT Manual Code Exchange:**
        /*
        const params = new URLSearchParams(url.split('#')[0].split('?')[1]); // Be careful with URL parsing, hash might contain params
        const code = params.get('code'); // Code is usually in the hash fragment for OAuth implicit/hybrid flows

        // Alternative parsing focusing on hash fragment:
        const hashFragment = url.split('#')[1];
        if (hashFragment) {
            const params = new URLSearchParams(hashFragment);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');

            if (access_token && refresh_token) {
                console.log('Tokens extracted, setting session manually');
                // Manually set session if needed (less common with supabase-js v2)
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });
                if (sessionError) {
                    console.error("Error setting session manually:", sessionError);
                    return { data: null, error: sessionError };
                }
                console.log("Session set manually:", sessionData);
                return { data: sessionData, error: null }; // Return the session data
            } else {
                 console.log('Tokens not found in URL fragment.');
                 // Fallback or error handling
            }
        }
        */

        // Instead of manual exchange, simply return success or wait for Supabase auth state change.
        // The Supabase client's listener should pick up the session from the redirect.
         console.log("Authentication flow succeeded via browser. Waiting for Supabase client to detect session.");
         // You might return a pending state or null here, relying on an auth state listener elsewhere in your app.
        return { data: null, error: null }; // Indicate browser flow success


      } else if (authResponse.type === 'cancel' || authResponse.type === 'dismiss') {
         console.log('Authentication cancelled or dismissed by user.');
         return { data: null, error: new Error('Authentication cancelled or dismissed') };
      } else {
         console.error('Authentication failed with WebBrowser result:', authResponse);
         return { data: null, error: new Error('Authentication failed or was cancelled') };
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

// Helper for signing out
export const signOut = async () => {
  return await supabase.auth.signOut();
};