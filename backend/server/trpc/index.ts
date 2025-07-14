//backend/server/trpc/index.ts
import {router} from './init';
import {playerRouter} from './routers/player';
import {chatRouter} from './routers/chat';

export const appRouter = router({
    player: playerRouter,
    chat: chatRouter,
});

export type AppRouter = typeof appRouter;
