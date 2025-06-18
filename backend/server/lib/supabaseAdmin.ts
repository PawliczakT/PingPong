// backend/server/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('KRYTYCZNY BŁĄD SERWERA: Brakuje Supabase URL lub Service Role Key. Sprawdź zmienne środowiskowe na serwerze.');
    throw new Error('Missing Supabase server environment variables');
}

export const supabaseAsAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
