//backend/server/trpc/routers/player/profile.ts
import {TRPCError} from '@trpc/server';
import {protectedProcedure} from '../../init';
import {z} from 'zod';

interface Player {
    id: string;
    user_id: string;
    name: string;
    nickname?: string | null;
    avatar_url?: string | null;
    elo_rating: number;
    wins: number;
    losses: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export const ensurePlayerProfileProcedure = protectedProcedure
    .output(z.custom<Player>(data => typeof data === 'object' && data !== null && 'user_id' in data))
    .mutation(async ({ctx}) => {
        const {user, supabase} = ctx;
        const userId = user.id;

        const {data: existingPlayer, error: fetchError} = await supabase
            .from('players')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

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

        const userName = user.user_metadata?.full_name || user.user_metadata?.name || 'Anonymous Player';
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.avatarUrl || null;

        const newPlayerData = {
            user_id: userId,
            name: userName,
            avatar_url: avatarUrl,
            elo_rating: 1500,
            wins: 0,
            losses: 0,
            active: true,
        };

        const {data: newPlayer, error: insertError} = await supabase
            .from('players')
            .insert(newPlayerData)
            .select()
            .single();

        if (insertError) {
            console.error('Error creating player profile:', insertError);
            if (insertError.code === '23505') {
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
    avatarUrl: z.string().url("Avatar URL must be a valid URL.").nullable().optional(),
});

export const updateMyProfileProcedure = protectedProcedure
    .input(UpdateProfileInput)
    .output(z.custom<Player>(data => typeof data === 'object' && data !== null && 'user_id' in data))
    .mutation(async ({ctx, input}) => {
        const {user, supabase} = ctx;
        const userId = user.id;

        const updateData: {
            name?: string;
            nickname?: string | null;
            avatar_url?: string | null;
            updated_at?: string;
        } = {};

        if (input.name !== undefined) {
            updateData.name = input.name;
        }
        if (input.nickname !== undefined) {
            updateData.nickname = input.nickname;
        }
        if (input.avatarUrl !== undefined) {
            updateData.avatar_url = input.avatarUrl;
        }

        if (Object.keys(updateData).length === 0) {
            const {data: existingPlayer, error: fetchError} = await supabase
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

        updateData.updated_at = new Date().toISOString();

        const {data: updatedPlayer, error: updateError} = await supabase
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
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Player profile not found to update.',
            });
        }

        return updatedPlayer as Player;
    });

export const getMyProfileProcedure = protectedProcedure
    .output(z.custom<Player>(data => typeof data === 'object' && data !== null && 'user_id' in data))
    .query(async ({ctx}) => {
        const {user, supabase} = ctx;
        const userId = user.id;

        const {data: playerProfile, error: fetchError} = await supabase
            .from('players')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: `Player profile not found for user ${userId}. It should have been created automatically.`,
                    cause: fetchError,
                });
            }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch player profile due to a database error.',
                cause: fetchError,
            });
        }

        if (!playerProfile) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `Player profile not found for user ${userId}.`,
            });
        }

        return playerProfile as Player;
    });
