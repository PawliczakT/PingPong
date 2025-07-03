//backend/server/trpc/routers/player.ts
import {router} from '../init';
import {
    ensurePlayerProfileProcedure,
    getMyProfileProcedure,
    updateMyProfileProcedure,
} from '@/backend/server/trpc/routers/player/profile';

export const playerRouter = router({
    ensureProfile: ensurePlayerProfileProcedure,
    getMyProfile: getMyProfileProcedure,
    updateMyProfile: updateMyProfileProcedure,
});
