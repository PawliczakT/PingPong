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
            elo_rating: 1000,
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
