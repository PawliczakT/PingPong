//backend/server/lib/supabaseAdmin.ts
import {createClient} from '@supabase/supabase-js';
import Constants from 'expo-constants';
import {Database} from '../../types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || Constants.expoConfig?.extra?.supabaseServiceKey;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('KRYTYCZNY BŁĄD SERWERA: Brakuje Supabase URL lub Service Role Key. Sprawdź zmienne środowiskowe na serwerze.');
    console.error('Supabase URL:', supabaseUrl);
    console.error('Supabase Service Key:', supabaseServiceKey ? '***' : 'undefined');
    throw new Error('Missing Supabase server environment variables');
}

export const supabaseAsAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
