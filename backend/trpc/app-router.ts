import {initTRPC, TRPCError} from '@trpc/server';
import superjson from 'superjson';
import {Context} from './create-context';
import {hiProcedure} from './routes/example/hi/route';
import { playerRouter } from './routes/player'; // Import playerRouter
import { chatRouter } from './routes/chat'; // Import chatRouter

const t = initTRPC.context<Context>().create({
    transformer: superjson,
});

const isAuthenticated = t.middleware(({ctx, next}) => {
    if (!ctx.user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to access this resource',
        });
    }
    return next({
        ctx: {
            ...ctx,
            user: ctx.user,
        },
    });
});

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);

export const appRouter = t.router({
    example: t.router({
        hi: hiProcedure,
    }),
    player: playerRouter, // Add playerRouter here
    chat: chatRouter, // Add chatRouter here
});

export type AppRouter = typeof appRouter;
