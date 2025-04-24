import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import Constants from 'expo-constants';
import { AppRouter } from '@/backend/trpc/app-router';
import { useAuthStore } from '@/store/authStore';

// Create the tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// Create the tRPC client
export const trpcClient = createTRPCClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${Constants.expoConfig?.extra?.apiUrl || 'https://rork.app'}/api/trpc`,
      headers() {
        const { session } = useAuthStore.getState();
        const token = session?.access_token;
        
        return {
          Authorization: token ? `Bearer ${token}` : '',
        };
      },
    }),
  ],
});