//backend/api/trpc/[trpc].ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/backend/server/trpc';
import { createContext } from '../../server/trpc/context';

export default async function handler(req: Request) {
    return fetchRequestHandler({
        endpoint: '/api/trpc',
        req,
        router: appRouter,
        createContext,
        onError: (opts) => {
            const { error, path } = opts;
            console.error(`tRPC Error on path '${path}':`, error);
        },
    });
}

export const config = {
    runtime: 'nodejs22.x',
};
