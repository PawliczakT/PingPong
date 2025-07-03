//api/trpc/[trpc].ts
import {fetchRequestHandler} from '@trpc/server/adapters/fetch';
import {appRouter} from '../../backend/server/trpc';
import {createContext} from '../../backend/server/trpc/context';
import {type NextRequest} from 'next/server';

// A list of allowed origins for CORS
const allowedOrigins = [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'https://ping-pong-three-woad.vercel.app',
    "http://localhost:19006",
    "http://localhost:3000",
    "http://localhost:54323",
    "http://127.0.0.1:54323"
];


/**
 * The main handler for all tRPC requests.
 * It uses the fetchRequestHandler from tRPC to process requests.
 */
const handler = (req: NextRequest) => {
    return fetchRequestHandler({
        endpoint: '/api/trpc',
        req,
        router: appRouter,
        createContext,
        /**
         * responseMeta is used to set custom headers on the response,
         * primarily for handling CORS. This function will be called
         * for all responses, including OPTIONS preflight requests.
         */
        responseMeta() {
            const origin = req.headers.get('origin');
            const headers = new Headers();

            // Set CORS headers if the origin is in the allowed list
            if (origin && allowedOrigins.includes(origin)) {
                headers.set('Access-Control-Allow-Origin', origin);
                headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
                headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            }

            // If the request is a preflight OPTIONS request, we can return an empty response with the CORS headers.
            if (req.method === 'OPTIONS') {
                return new Response(null, {status: 204, headers});
            }

            return {
                headers,
            };
        },
        onError: ({path, error}) => {
            console.error(`❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`);
        },
    });
}

// Explicitly export the handler for GET, POST, and OPTIONS methods.
// This is the key change that tells Vercel which HTTP methods are allowed.
export {handler as GET, handler as POST, handler as OPTIONS};

// Vercel recommends using the 'edge' runtime for better performance with fetch-based APIs.
// If you have Node.js specific dependencies (like 'fs'), you might need to use 'nodejs'.
export const runtime = 'edge';
