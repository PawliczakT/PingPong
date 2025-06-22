//backend/lib/trpc.ts
import {createTRPCReact} from '@trpc/react-query';
import {createTRPCClient, httpBatchLink} from '@trpc/client';
import Constants from 'expo-constants';
import {supabaseAsAdmin} from '../server/lib/supabaseAdmin';
import type {AppRouter} from '../server/trpc/index';

export const trpc = createTRPCReact<AppRouter>();

const getAuthHeaders = async () => {
    try {
        const {data} = await supabaseAsAdmin.auth.getSession();
        const token = data?.session?.access_token;
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
        }),
    ],
});
