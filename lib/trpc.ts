import {createTRPCReact} from '@trpc/react-query';
import {createTRPCClient, httpBatchLink} from '@trpc/client';
import superjson from 'superjson';
import Constants from 'expo-constants';
import {AppRouter} from '@/backend/trpc/app-router';
import {useAuthStore} from '@/store/authStore';

export const trpc = createTRPCReact<AppRouter>();
export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: `${Constants.expoConfig?.extra?.apiUrl || 'https://rork.app'}/api/trpc`,
            transformer: superjson,
            headers() {
                const session = useAuthStore().session
                const token = session?.access_token;
                return {
                    Authorization: token ? `Bearer ${token}` : '',
                };
            },
        }),
    ],
});
