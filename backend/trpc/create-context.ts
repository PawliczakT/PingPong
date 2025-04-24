import { inferAsyncReturnType } from '@trpc/server';
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { supabase } from '@/lib/supabase';

export async function createContext({ req }: FetchCreateContextFnOptions) {
  // Get the session from the request
  const authHeader = req.headers.get('authorization');
  let user = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    } catch (error) {
      console.error('Error verifying token:', error);
    }
  }
  
  return {
    user,
    supabase,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;