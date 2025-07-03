//backend/api/lib/trpc.ts
import {createTRPCReact} from '@trpc/react-query';
import {createTRPCClient, httpBatchLink} from '@trpc/client';
import Constants from 'expo-constants';
import {supabase} from '../../server/lib/supabase';
import type {AppRouter} from '../../server/trpc';

export const trpc = createTRPCReact<AppRouter>();

const getAuthHeaders = async () => {
    try {
        const {data: {session}} = await supabase.auth.getSession();
        const token = session?.access_token;
        return token ? {Authorization: `Bearer ${token}`} : {};
    } catch (error) {
        console.error('Error getting auth headers:', error);
        return {};
    }
};

const getApiUrl = () => {
    if (__DEV__) {
        return Constants.expoConfig?.extra?.apiUrlDev || 'http://127.0.0.1:8081/api/trpc';
    }
    return Constants.expoConfig?.extra?.apiUrl || 'https://ping-pong-three-woad.vercel.app/api/trpc';
};

export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: getApiUrl(),
            headers: getAuthHeaders,
            fetch: async (url, options) => {
                console.log('🚀 Fetching:', url, options);
                const headers = await getAuthHeaders();
                return fetch(url, {
                    ...options,
                    headers: {
                        ...options?.headers,
                        ...headers,
                    },
                });
            },
        }),
    ],
});
