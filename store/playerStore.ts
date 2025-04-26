import { create } from "zustand";
import { Player } from "@/types";
import { getInitialEloRating } from "@/utils/elo";
import { supabase } from "@/lib/supabase";

interface PlayerState {
  players: Player[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addPlayer: (name: string, nickname?: string, avatarUrl?: string) => Promise<Player>;
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

    addPlayer: async (name, nickname, avatarUrl) => {
      set({ isLoading: true, error: null });
      try {
        // Check for duplicate name or nickname (case-insensitive)
        const existing = get().players.find(
          p => p.name.trim().toLowerCase() === name.trim().toLowerCase() ||
               (!!nickname && !!p.nickname && p.nickname.trim().toLowerCase() === nickname.trim().toLowerCase())
        );
        if (existing) {
          const errMsg = 'Użytkownik o takiej nazwie lub nicku już istnieje.';
          set({ isLoading: false, error: errMsg });
          throw new Error(errMsg);
        }
        const { data, error } = await supabase.from('players').insert([
          {
            name,
            nickname,
            avatar_url: avatarUrl,
            elo_rating: getInitialEloRating(),
            wins: 0,
            losses: 0,
            active: true,
          }
        ]).select().single();
        if (error) throw error;
        const newPlayer: Player = {
          id: data.id,
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
        set((state) => ({
          players: [...state.players, newPlayer],
          isLoading: false,
        }));
        await fetchPlayersFromSupabase();
        return newPlayer;
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to add player"
        });
        throw error;
      }
    },

    updatePlayer: async (updatedPlayer) => {
      set({ isLoading: true, error: null });
      try {
        const { error } = await supabase.from('players').update({
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
              ? { ...updatedPlayer, updatedAt: new Date().toISOString() }
              : player
          ),
          isLoading: false,
        }));
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to update player"
        });
        throw error;
      }
    },

    deactivatePlayer: async (playerId) => {
      set({ isLoading: true, error: null });
      try {
        const { error } = await supabase.from('players').update({
          active: false,
          updated_at: new Date().toISOString(),
        }).eq('id', playerId);
        if (error) throw error;
        set((state) => ({
          players: state.players.map((player) =>
            player.id === playerId
              ? { ...player, active: false, updatedAt: new Date().toISOString() }
              : player
          ),
          isLoading: false,
        }));
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to deactivate player"
        });
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
      set({ isLoading: true, error: null });
      try {
        const { error } = await supabase.from('players').update({
          elo_rating: newRating,
          updated_at: new Date().toISOString(),
        }).eq('id', playerId);
        if (error) throw error;
        set((state) => ({
          players: state.players.map((player) =>
            player.id === playerId
              ? { ...player, eloRating: newRating, updatedAt: new Date().toISOString() }
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
      set({ isLoading: true, error: null });
      try {
        const player = get().players.find((p) => p.id === playerId);
        if (!player) throw new Error('Player not found');
        const newWins = won ? player.wins + 1 : player.wins;
        const newLosses = won ? player.losses : player.losses + 1;
        const { error } = await supabase.from('players').update({
          wins: newWins,
          losses: newLosses,
          updated_at: new Date().toISOString(),
        }).eq('id', playerId);
        if (error) throw error;
        set((state) => ({
          players: state.players.map((p) =>
            p.id === playerId
              ? { ...p, wins: newWins, losses: newLosses, updatedAt: new Date().toISOString() }
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
    // Fetch all players from Supabase on store initialization
  }),
);

// Fetch players from Supabase when the app starts
export const fetchPlayersFromSupabase = async () => {
  usePlayerStore.setState({ isLoading: true, error: null });
  try {
    const { data, error } = await supabase.from('players').select('*');
    if (error) throw error;
    const players: Player[] = data.map((item: any) => ({
      id: item.id,
      name: item.name,
      nickname: item.nickname,
      avatarUrl: item.avatar_url,
      eloRating: item.elo_rating,
      wins: item.wins,
      losses: item.losses,
      active: item.active,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
    usePlayerStore.setState({ players, isLoading: false });
  } catch (error) {
    usePlayerStore.setState({ isLoading: false, error: error instanceof Error ? error.message : "Failed to fetch players" });
  }
};

// Setup realtime subscription for players table
import { useEffect } from "react";

export const usePlayersRealtime = () => {
  useEffect(() => {
    const channel = supabase
      .channel('players-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          fetchPlayersFromSupabase();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};

// Usage example (call in App.tsx or useEffect in root):
// import { usePlayerStore, fetchPlayersFromSupabase, usePlayersRealtime } from '@/store/playerStore';
// usePlayersRealtime();