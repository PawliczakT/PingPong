import {Hono} from 'hono';
import {trpcServer} from '@hono/trpc-server';
import {appRouter} from './trpc/app-router';
import {createContext} from './trpc/create-context';

const app = new Hono();

app.use('/trpc/*', trpcServer({
    router: appRouter,
    createContext,
}));

app.get('/', (c) => {
    return c.json({
        status: 'ok',
        message: 'PingPong StatKeeper API is running',
    });
});

export default app;
