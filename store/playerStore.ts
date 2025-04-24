import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Player } from "@/types";
import { mockPlayers, createMockPlayer } from "@/utils/mockData";
import { getInitialEloRating } from "@/utils/elo";

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
  persist(
    (set, get) => ({
      players: mockPlayers,
      isLoading: false,
      error: null,

      addPlayer: async (name, nickname, avatarUrl) => {
        set({ isLoading: true, error: null });
        try {
          const newPlayer: Player = {
            id: `p${Date.now()}`,
            name,
            nickname,
            avatarUrl,
            eloRating: getInitialEloRating(),
            wins: 0,
            losses: 0,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          set((state) => ({
            players: [...state.players, newPlayer],
            isLoading: false,
          }));
          
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
        set((state) => ({
          players: state.players.map((player) => 
            player.id === playerId 
              ? { 
                  ...player, 
                  eloRating: newRating, 
                  updatedAt: new Date().toISOString() 
                } 
              : player
          ),
        }));
      },

      updatePlayerStats: async (playerId, won) => {
        set((state) => ({
          players: state.players.map((player) => 
            player.id === playerId 
              ? { 
                  ...player, 
                  wins: won ? player.wins + 1 : player.wins,
                  losses: won ? player.losses : player.losses + 1,
                  updatedAt: new Date().toISOString() 
                } 
              : player
          ),
        }));
      },
    }),
    {
      name: "pingpong-players",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);