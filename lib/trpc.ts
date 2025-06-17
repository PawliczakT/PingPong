//lib/trpc.ts
import {createTRPCReact} from '@trpc/react-query';
import {createTRPCClient, httpBatchLink} from '@trpc/client';
import Constants from 'expo-constants';
import {supabase} from './supabase';
import type {AppRouter} from '../backend/server/trpc';

export const trpc = createTRPCReact<AppRouter>();

const getAuthHeaders = async () => {
    try {
        const {data} = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        return token ? {Authorization: `Bearer ${token}`} : {};
    } catch (error) {
        console.error('Error getting auth headers:', error);
        return {};
    }
};

export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: Constants.expoConfig?.extra?.apiUrl,
            headers: getAuthHeaders,
        }),
    ],
});
