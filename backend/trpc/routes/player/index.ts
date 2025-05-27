import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { Context } from '../../create-context'; // Adjust path as necessary
import { ensurePlayerProfileProcedure, updateMyProfileProcedure, getMyProfileProcedure } from './profile'; // Import getMyProfileProcedure

// Initialize tRPC for this router if not using a global t instance
// Or import 't' if it's exported from app-router.ts
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const playerRouter = t.router({
  ensureProfile: ensurePlayerProfileProcedure,
  updateProfile: updateMyProfileProcedure,
  getProfile: getMyProfileProcedure, // Add getMyProfileProcedure here
});

// Export the type of the router for convenience
export type PlayerRouter = typeof playerRouter;
