import { supabase } from '@/lib/supabase';

export const ensurePlayerProfile = async (userId: string) => {
    try {
        // Check if player exists
        const { data: existingPlayer, error: fetchError } = await supabase
            .from('players')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError) {
            console.error('Error checking player profile:', fetchError);
            return { success: false, error: fetchError };
        }

        if (existingPlayer) {
            console.log('Player profile already exists');
            return { success: true, player: existingPlayer };
        }

        // Get user data for profile creation
        const { data: userData } = await supabase.auth.getUser(userId);
        const user = userData?.user;

        if (!user) {
            console.error('User not found');
            return { success: false, error: new Error('User not found') };
        }

        // Create new player profile
        const userName = user.user_metadata?.full_name || user.user_metadata?.name || 'Anonymous Player';
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.avatarUrl || null;

        const newPlayerData = {
            user_id: userId,
            name: userName,
            avatar_url: avatarUrl,
            elo_rating: 1200,
            wins: 0,
            losses: 0,
            active: true,
        };

        const { data: newPlayer, error: insertError } = await supabase
            .from('players')
            .insert(newPlayerData)
            .select()
            .single();

        if (insertError) {
            console.error('Error creating player profile:', insertError);
            return { success: false, error: insertError };
        }

        console.log('Created new player profile');
        return { success: true, player: newPlayer };
    } catch (error) {
        console.error('Exception during player profile creation:', error);
        return { success: false, error };
    }
};

export class PlayerService {
    constructor(private supabase: any) {}

    async createPlayer(playerData) {
        try {
            // Upewnij się, że przekazujemy tylko potrzebne pola
            const player = {
                user_id: playerData.user_id,
                name: playerData.name, // Upewnij się, że name jest stringiem, a nie obiektem
                nickname: playerData.nickname || null,
                avatarUrl: playerData.avatarUrl || null,
                eloRating: playerData.eloRating || 1200,
                wins: playerData.wins || 0,
                losses: playerData.losses || 0,
                active: true,
            };

            const { data, error } = await this.supabase
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
