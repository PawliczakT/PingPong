import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './trpc/app-router';
import { createContext } from './trpc/create-context';

// Create Hono app
const app = new Hono();

// Add tRPC to Hono
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext,
}));

// Add a simple health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'PingPong StatKeeper API is running',
  });
});

export default app;