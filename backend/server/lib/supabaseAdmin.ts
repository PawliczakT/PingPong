//backend/server/lib/supabaseAdmin.ts
import {createClient} from '@supabase/supabase-js';
import {Database} from '../../types/supabase';

const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
        '❌ Supabase admin client initialisation failed – missing environment variables.',
        {
            supabaseUrlPresent: !!supabaseUrl,
            serviceRoleKeyPresent: !!supabaseServiceKey,
        },
    );
    throw new Error('Missing Supabase environment variables on the server');
}

export const supabaseAsAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
