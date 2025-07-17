//app/services/playerService.ts
import {supabase} from '@/backend/server/lib/supabase';

export const ensurePlayerProfile = async (userId: string) => {
    try {
        const {data: existingPlayer, error: fetchError} = await supabase
            .from('players')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError) {
            console.error('Error checking player profile:', fetchError);
            return {success: false, error: fetchError};
        }

        if (existingPlayer) {
            console.log('Player profile already exists');
            return {success: true, player: existingPlayer};
        }

        const {data: userData} = await supabase.auth.getUser();
        const user = userData?.user;

        if (!user || user.id !== userId) {
            console.error('User not found or mismatch');
            return {success: false, error: new Error('User not found or mismatch')};
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
            return {success: false, error: insertError};
        }

        console.log('Created new player profile');
        return {success: true, player: newPlayer};
    } catch (error) {
        console.error('Exception during player profile creation:', error);
        return {success: false, error};
    }
};

interface PlayerCreationData {
    user_id: string;
    name: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    eloRating?: number;
    wins?: number;
    losses?: number;
}

export class PlayerService {
    constructor(private supabase: any) {
    }

    async createPlayer(playerData: PlayerCreationData) {
        try {
            const player = {
                user_id: playerData.user_id,
                name: playerData.name,
                nickname: playerData.nickname || null,
                avatar_url: playerData.avatarUrl || null,
                elo_rating: playerData.eloRating || 1500,
                wins: playerData.wins || 0,
                losses: playerData.losses || 0,
                active: true,
            };

            const {data, error} = await this.supabase
                .from('players')
                .insert(player)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error in createPlayer:", error);
            throw error;
        }
    }
}
