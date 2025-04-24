import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import { Context } from './create-context';
import { hiProcedure } from './routes/example/hi/route';

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

// Create a middleware to check if the user is authenticated
const isAuthenticated = t.middleware(({ ctx, next }) => {
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

// Base procedures
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);

// Create the router
export const appRouter = t.router({
  example: t.router({
    hi: hiProcedure,
  }),
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;