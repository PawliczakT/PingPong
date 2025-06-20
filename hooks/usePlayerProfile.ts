// hooks/usePlayerProfile.ts
import {useCallback, useEffect, useState} from 'react';
import {supabase} from '@/backend/server/lib/supabase';
import {Player} from '@/backend/types';
import {User} from '@supabase/supabase-js';

interface UsePlayerProfileReturn {
    currentPlayer: Player | null;
    isLoadingProfile: boolean;
    isNewUser: boolean;
    profileError: string | null;
    refreshProfile: () => Promise<void>;
}

export const usePlayerProfile = (
    user: User | null,
    players: Player[]
): UsePlayerProfileReturn => {
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    const loadPlayerProfile = useCallback(async () => {
        if (!user?.id) {
            setIsLoadingProfile(false);
            setCurrentPlayer(null);
            return;
        }

        setIsLoadingProfile(true);
        setProfileError(null);

        try {
            let foundPlayer = players.find(p => p.user_id === user.id);

            if (!foundPlayer) {
                const {data, error} = await supabase
                    .from('players')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (error) {
                    console.error('Error fetching player profile:', error);
                    setProfileError(error.message);
                    return;
                }

                if (data) {
                    foundPlayer = {
                        id: data.id,
                        user_id: data.user_id,
                        name: data.name,
                        nickname: data.nickname,
                        avatarUrl: data.avatar_url,
                        eloRating: data.elo_rating,
                        wins: data.wins,
                        losses: data.losses,
                        active: data.active,
                        createdAt: data.created_at,
                        updatedAt: data.updated_at,
                    };
                }
            }

            if (foundPlayer) {
                setCurrentPlayer(foundPlayer);
                setIsNewUser(false);
            } else {
                setCurrentPlayer(null);
                setIsNewUser(true);
            }
        } catch (error) {
            console.error('Error loading player profile:', error);
            setProfileError((error as Error)?.message || 'Failed to load profile');
        } finally {
            setIsLoadingProfile(false);
        }
    }, [user?.id, players]);

    useEffect(() => {
        loadPlayerProfile();
    }, [loadPlayerProfile]);

    return {
        currentPlayer,
        isLoadingProfile,
        isNewUser,
        profileError,
        refreshProfile: loadPlayerProfile
    };
};
