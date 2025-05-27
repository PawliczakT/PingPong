import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../app-router'; // Assuming protectedProcedure is exported from app-router
import { z } from 'zod';

// Define the expected structure of a player based on the database schema
// This can be refined with Zod for input/output validation if desired
interface Player {
  id: bigint; // Assuming 'id' is the primary key and is returned
  user_id: string;
  name: string;
  nickname?: string | null;
  avatar_url?: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  active: boolean;
  created_at: string; // Assuming TIMESTAMPTZ is returned as string
  updated_at: string; // Assuming TIMESTAMPTZ is returned as string
}

export const ensurePlayerProfileProcedure = protectedProcedure
  .output(z.custom<Player>(data => typeof data === 'object' && data !== null && 'user_id' in data)) // Basic validation
  .mutation(async ({ ctx }) => {
    const { user, supabase } = ctx;
    const userId = user.id;

    // 1. Query for existing player
    const { data: existingPlayer, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle to get one record or null

    if (fetchError) {
      console.error('Error fetching player profile:', fetchError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch player profile.',
        cause: fetchError,
      });
    }

    if (existingPlayer) {
      return existingPlayer as Player;
    }

    // 2. If no player exists, create one
    const userName = user.user_metadata?.full_name || user.user_metadata?.name || 'Anonymous Player';
    const avatarUrl = user.user_metadata?.avatar_url || null;

    const newPlayerData = {
      user_id: userId,
      name: userName,
      avatar_url: avatarUrl,
      elo_rating: 1000,
      wins: 0,
      losses: 0,
      active: true,
      // nickname can be null/undefined
      // created_at and updated_at will be set by default in the DB
    };

    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert(newPlayerData)
      .select()
      .single(); // Use single to get the inserted record

    if (insertError) {
      console.error('Error creating player profile:', insertError);
      // Check for unique constraint violation on user_id, though maybeSingle should prevent this path if record exists
      if (insertError.code === '23505') { // PostgreSQL unique violation
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A player profile already exists for this user.',
          cause: insertError,
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create player profile.',
        cause: insertError,
      });
    }

    if (!newPlayer) {
        // This case should ideally not be reached if insert was successful without error
        console.error('New player data is null after insert without error.');
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve new player profile after creation.',
        });
    }
    
    return newPlayer as Player;
  });

export const UpdateProfileInput = z.object({
  name: z.string().min(1, "Name cannot be empty if provided.").optional(),
  nickname: z.string().nullable().optional(),
  avatar_url: z.string().url("Avatar URL must be a valid URL.").nullable().optional(),
});

export const updateMyProfileProcedure = protectedProcedure
  .input(UpdateProfileInput)
  .output(z.custom<Player>(data => typeof data === 'object' && data !== null && 'user_id' in data)) // Basic validation
  .mutation(async ({ ctx, input }) => {
    const { user, supabase } = ctx;
    const userId = user.id;

    const updateData: {
      name?: string;
      nickname?: string | null;
      avatar_url?: string | null;
      updated_at?: string; // Keep updated_at for Supabase auto-update or manual set
    } = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.nickname !== undefined) {
      updateData.nickname = input.nickname;
    }
    if (input.avatar_url !== undefined) {
      updateData.avatar_url = input.avatar_url;
    }

    // If no fields are provided for update, we could return the existing profile or throw an error.
    // For now, proceeding with update even if object is empty (Supabase might handle this or might error).
    // A more robust way would be to check if Object.keys(updateData).length === 0.
    if (Object.keys(updateData).length === 0) {
      // Fetch and return the current profile if no actual changes are requested.
      const { data: existingPlayer, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError || !existingPlayer) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch existing player profile.',
          cause: fetchError,
        });
      }
      return existingPlayer as Player;
    }
    
    // Add updated_at to ensure it's refreshed
    updateData.updated_at = new Date().toISOString();

    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating player profile:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update player profile.',
        cause: updateError,
      });
    }

    if (!updatedPlayer) {
      // This case implies the record to update was not found, which shouldn't happen for an authenticated user
      // whose profile should have been ensured.
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Player profile not found to update.',
      });
    }

    return updatedPlayer as Player;
  });

export const getMyProfileProcedure = protectedProcedure
  .output(z.custom<Player>(data => typeof data === 'object' && data !== null && 'user_id' in data)) // Reuse existing output validation
  .query(async ({ ctx }) => {
    const { user, supabase } = ctx;
    const userId = user.id;

    const { data: playerProfile, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', userId)
      .single(); // Use .single() as user_id should be unique

    if (fetchError) {
      // Log the error for server-side inspection
      console.error(`Error fetching profile for user ${userId}:`, fetchError);

      // If the error indicates that no rows were found (e.g., PostgREST PGRST116)
      // This is a situation that ideally shouldn't happen if ensurePlayerProfile works correctly.
      if (fetchError.code === 'PGRST116' || !playerProfile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Player profile not found for user ${userId}. It should have been created automatically.`,
          cause: fetchError,
        });
      }
      // For other types of database errors
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch player profile due to a database error.',
        cause: fetchError,
      });
    }

    if (!playerProfile) {
      // This is a fallback, .single() should throw if no record and exactly one was expected.
      // However, if it somehow returns null without an error that fetchError.code caught.
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Player profile not found for user ${userId}, and no specific database error was caught.`,
      });
    }

    return playerProfile as Player;
  });
