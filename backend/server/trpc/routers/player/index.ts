//backend/server/trpc/routers/player/index.ts
import {initTRPC} from '@trpc/server';
import superjson from 'superjson';
import {Context} from '../../context';
import {ensurePlayerProfileProcedure, getMyProfileProcedure, updateMyProfileProcedure} from './profile';

const t = initTRPC.context<Context>().create({
    transformer: superjson,
});

export const playerRouter = t.router({
    ensureProfile: ensurePlayerProfileProcedure,
    updateProfile: updateMyProfileProcedure,
    getProfile: getMyProfileProcedure,
});

export type PlayerRouter = typeof playerRouter;
