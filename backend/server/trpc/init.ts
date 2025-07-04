//backend/server/trpc/init.ts
import {initTRPC, TRPCError} from '@trpc/server';
import {type Context} from './context';

const init = initTRPC.context<Context>().create({
    errorFormatter({shape}) {
        return shape;
    },
});

const isAuthenticated = init.middleware(({ctx, next}) => {
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

export const router = init.router;
export const publicProcedure = init.procedure;
export const protectedProcedure = init.procedure.use(isAuthenticated);
