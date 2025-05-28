import {createTRPCReact} from '@trpc/react-query';
import {createTRPCClient, httpBatchLink} from '@trpc/client';
import superjson from 'superjson';
import Constants from 'expo-constants';
import {AppRouter} from '@/backend/trpc/app-router';
import { supabase } from './supabase';

export const trpc = createTRPCReact<AppRouter>();

// Non-hook based function to get auth headers
const getAuthHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return {
        Authorization: token ? `Bearer ${token}` : '',
    };
};

export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: `${Constants.expoConfig?.extra?.apiUrl || 'https://rork.app'}/api/trpc`,
            transformer: superjson,
            headers: async () => {
                return await getAuthHeaders();
            },
        }),
    ],
});
