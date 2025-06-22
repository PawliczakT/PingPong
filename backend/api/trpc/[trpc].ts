//backend/api/trpc/[trpc].ts
import {fetchRequestHandler} from '@trpc/server/adapters/fetch';
import {appRouter} from '@/backend/server/trpc';
import {createContext} from '../../server/trpc/context';

const allowedOrigins = [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'https://ping-pong-three-woad.vercel.app',
];

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.get('origin');
        if (origin && allowedOrigins.includes(origin)) {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': origin,
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }
        return new Response('CORS error: origin not allowed', {status: 400});
    }

    return fetchRequestHandler({
        endpoint: '/api/trpc',
        req,
        router: appRouter,
        createContext,
        responseMeta(opts) {
            const origin = req.headers.get('origin');
            const headers = new Headers();

            if (origin && allowedOrigins.includes(origin)) {
                headers.set('Access-Control-Allow-Origin', origin);
            }

            return {
                headers,
            };
        },
        onError: (opts) => {
            const {error, path} = opts;
            console.error(`tRPC Error on path '${path}':`, error);
        },
    });
}

export const config = {
    runtime: 'nodejs22.x',
};
