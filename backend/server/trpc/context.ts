//backend/server/trpc/context.ts
import {FetchCreateContextFnOptions} from '@trpc/server/adapters/fetch';
import {supabaseAsAdmin} from '../lib/supabaseAdmin';

export async function createContext({req}: FetchCreateContextFnOptions) {
    const authHeader = req.headers.get('authorization');
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            console.log('🔍 Verifying token...');

            const {data, error} = await supabaseAsAdmin.auth.getUser(token);

            if (!error && data?.user) {
                user = data.user;
                console.log('✅ User authenticated:', user.id);
            } else {
                console.log('❌ Auth failed:', error);
            }
        } catch (error) {
            console.error('❌ Error verifying token:', error);
        }
    } else {
        console.log('❌ No valid auth header');
    }

    return {
        user,
        supabase: supabaseAsAdmin,
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
