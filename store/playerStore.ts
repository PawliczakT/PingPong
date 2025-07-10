//store/playerStore.ts
import {create} from "zustand";
import {Player} from "@/backend/types";
import {supabase} from '@/app/lib/supabase';
import {useEffect} from "react";
import {getRankByWins, Rank} from "@/constants/achievements";
import {trpcClient} from '@/backend/api/lib/trpc';
import {useEloStore} from "@/store/eloStore";

interface PlayerState {
    players: Player[];
    isLoading: boolean;
    error: string | null;
    addPlayer: (name: string, nickname?: string, avatarUrl?: string, user_id?: string) => Promise<Player>;
    updatePlayer: (player: Player) => Promise<void>;
    deactivatePlayer: (playerId: string) => Promise<void>;
    getPlayerById: (playerId: string) => Player | undefined;
    getActivePlayersSortedByRating: () => Player[];
    updatePlayerRating: (playerId: string, newRating: number) => Promise<void>;
    updatePlayerStats: (playerId: string, won: boolean) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>()(
    (set, get) => ({
        players: [],
        isLoading: false,
        error: null,

        addPlayer: async (name, nickname, avatarUrl, user_id) => {
            set({isLoading: true, error: null});
            try {
                const existing = get().players.find(
                    p => p.name?.trim().toLowerCase() === name?.trim().toLowerCase() ||
                        (!!nickname && !!p.nickname && p.nickname?.trim().toLowerCase() === nickname.trim().toLowerCase())
                );
                if (existing) {
                    const errMsg = 'Użytkownik o takiej nazwie lub nicku już istnieje.';
                    set({isLoading: false, error: errMsg});
                    throw new Error(errMsg);
                }
                const newPlayer: Omit<Player, 'id' | 'createdAt' | 'updatedAt' | 'rank'> = {
                    name,
                    nickname: nickname || '',
                    avatarUrl: avatarUrl || '',
                    eloRating: 1500,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    active: true,
                    user_id: user_id || undefined,
                };
                const {data, error} = await supabase.from('players').insert([
                    {
                        ...newPlayer,
                    }
                ]).select().single();
                if (error) throw error;
                const player: Player = {
                    id: data.id,
                    ...newPlayer,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    rank: getRankByWins(data.wins),
                };
                set((state) => ({
                    players: [...state.players, player],
                    isLoading: false
                }));

                try {
                    if (player) {
                        const metadata = {
                            notification_type: 'new_player' as const,
                            newPlayerNickname: player.nickname || player.name || 'Nowy gracz',
                            playerId: player.id,
                        };
                        await trpcClient.chat.sendSystemNotification.mutate({
                            type: 'new_player',
                            metadata: metadata,
                        });
                    }
                } catch (e) {
                    console.warn("Failed to dispatch new_player system notification via tRPC", e);
                }

                return player;
            } catch (error) {
                set({isLoading: false, error: error instanceof Error ? error.message : "Failed to add player"});
                throw error;
            }
        },

        updatePlayer: async (updatedPlayer) => {
            set({isLoading: true, error: null});
            try {
                const {error} = await supabase.from('players').update({
                    name: updatedPlayer.name,
                    nickname: updatedPlayer.nickname,
                    avatar_url: updatedPlayer.avatarUrl,
                    elo_rating: updatedPlayer.eloRating,
                    wins: updatedPlayer.wins,
                    losses: updatedPlayer.losses,
                    active: updatedPlayer.active,
                    updated_at: new Date().toISOString(),
                }).eq('id', updatedPlayer.id);
                if (error) throw error;
                set((state) => ({
                    players: state.players.map((player) =>
                        player.id === updatedPlayer.id
                            ? {...updatedPlayer, updatedAt: new Date().toISOString()}
                            : player
                    ),
                    isLoading: false,
                }));
            } catch (error) {
                set({isLoading: false, error: error instanceof Error ? error.message : "Failed to update player"});
                throw error;
            }
        },

        deactivatePlayer: async (playerId) => {
            set({isLoading: true, error: null});
            try {
                const {error} = await supabase.from('players').update({
                    active: false,
                    updated_at: new Date().toISOString(),
                }).eq('id', playerId);
                if (error) throw error;
                set((state) => ({
                    players: state.players.map((player) =>
                        player.id === playerId
                            ? {...player, active: false, updatedAt: new Date().toISOString()}
                            : player
                    ),
                    isLoading: false,
                }));
            } catch (error) {
                set({isLoading: false, error: error instanceof Error ? error.message : "Failed to deactivate player"});
                throw error;
            }
        },

        getPlayerById: (playerId) => {
            return get().players.find((player) => player.id === playerId);
        },

        getActivePlayersSortedByRating: () => {
            return [...get().players]
                .filter((player) => player.active)
                .sort((a, b) => b.eloRating - a.eloRating);
        },

        updatePlayerRating: async (playerId, newRating) => {
            set({isLoading: true, error: null});
            try {
                const {error} = await supabase.from('players').update({
                    elo_rating: newRating,
                    updated_at: new Date().toISOString(),
                }).eq('id', playerId);
                if (error) throw error;
                set((state) => ({
                    players: state.players.map((player) =>
                        player.id === playerId
                            ? {...player, eloRating: newRating, updatedAt: new Date().toISOString()}
                            : player
                    ),
                    isLoading: false,
                }));
            } catch (error) {
                set({
                    isLoading: false,
                    error: error instanceof Error ? error.message : "Failed to update player rating"
                });
                throw error;
            }
        },

        updatePlayerStats: async (playerId, won) => {
            set({isLoading: true, error: null});
            try {
                const player = get().players.find((p) => p.id === playerId);
                if (!player) throw new Error('Player not found');
                const oldRank = player.rank;
                const newWins = won ? player.wins + 1 : player.wins;
                const newLosses = won ? player.losses : player.losses + 1;
                const newRank: Rank = getRankByWins(newWins);

                // POPRAWKA: Wywołanie notyfikacji o zmianie rangi przez tRPC
                if (oldRank && newRank.name !== oldRank.name) {
                    try {
                        const metadata = {
                            notification_type: 'rank_up' as const,
                            playerNickname: player.nickname || player.name || 'Gracz',
                            rankName: newRank.name,
                        };
                        await trpcClient.chat.sendSystemNotification.mutate({
                            type: 'rank_up',
                            metadata: metadata,
                        });
                    } catch (e) {
                        console.warn("Failed to dispatch rank_up system notification via tRPC", e);
                    }
                }

                const {error} = await supabase.from('players').update({
                    wins: newWins,
                    losses: newLosses,
                    updated_at: new Date().toISOString(),
                }).eq('id', playerId);
                if (error) throw error;
                set((state) => ({
                    players: state.players.map((p) =>
                        p.id === playerId
                            ? {
                                ...p,
                                wins: newWins,
                                losses: newLosses,
                                rank: newRank,
                                updatedAt: new Date().toISOString()
                            }
                            : p
                    ),
                    isLoading: false,
                }));
            } catch (error) {
                set({
                    isLoading: false,
                    error: error instanceof Error ? error.message : "Failed to update player stats"
                });
                throw error;
            }
        },
    }),
);

export const fetchPlayersFromSupabase = async () => {
    console.log('🔍 Starting fetchPlayersFromSupabase...');
    usePlayerStore.setState({isLoading: true, error: null});

    try {
        const {data, error} = await supabase.from('players').select('*');

        if (error) {
            console.error('🔍 Supabase query error:', error.message);
            throw error;
        }

        if (!data) {
            console.warn('🔍 No data returned from players query');
            usePlayerStore.setState({players: [], isLoading: false});
            return;
        }

        console.log(`🔍 Successfully fetched ${data.length} players`);

        const players: Player[] = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            nickname: item.nickname,
            avatarUrl: item.avatar_url,
            eloRating: item.elo_rating,
            wins: item.wins,
            losses: item.losses,
            gamesPlayed: item.games_played || 0,
            dailyDelta: item.daily_delta || 0,
            lastMatchDay: item.last_match_day || '',
            active: item.active,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            rank: getRankByWins(item.wins),
        }));

        usePlayerStore.setState({players, isLoading: false});

        // Initialize eloStore with the fetched players
        useEloStore.getState().initialize(players);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch players";
        console.error('🔍 fetchPlayersFromSupabase failed:', errorMessage);
        usePlayerStore.setState({
            isLoading: false,
            error: errorMessage
        });
        throw error;
    }
};

export const usePlayersRealtime = () => {
    useEffect(() => {
        const channel = supabase
            .channel('players-changes')
            .on('postgres_changes', {event: '*', schema: 'public', table: 'players'},
                () => {
                    fetchPlayersFromSupabase().catch((e) => {
                        console.warn("Error during players realtime update:", e);
                    })
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel).catch(r =>
                console.error("Error removing players channel:", r));
        };
    }, []);
};
