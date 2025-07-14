//backend/api/lib/trpc.ts
import {createTRPCReact} from '@trpc/react-query';
import {createTRPCClient, httpBatchLink} from '@trpc/client';
import type {AppRouter} from '../../server/trpc';
import {supabase} from "../../../app/lib/supabase";

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
    const isDev = process.env.NODE_ENV === 'development' ||
        process.env.EXPO_PUBLIC_ENV === 'development';

    if (isDev) {
        return process.env.EXPO_PUBLIC_API_URL_DEV || 'http://127.0.0.1:8081/api/trpc';
    }
    return process.env.EXPO_PUBLIC_API_URL || 'https://ping-pong-three-woad.vercel.app/api/trpc';
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
