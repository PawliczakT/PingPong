import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Match, Set, HeadToHead } from "@/types";
import { mockMatches } from "@/utils/mockData";
import { usePlayerStore } from "./playerStore";
import { useStatsStore } from "./statsStore";
import { useNotificationStore } from "./notificationStore";
import { useAchievementStore } from "./achievementStore";
import { calculateEloRating } from "@/utils/elo";

interface MatchState {
  matches: Match[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addMatch: (
    player1Id: string, 
    player2Id: string, 
    player1Score: number, 
    player2Score: number, 
    sets: Set[],
    tournamentId?: string
  ) => Promise<Match>;
  getMatchById: (matchId: string) => Match | undefined;
  getMatchesByPlayerId: (playerId: string) => Match[];
  getRecentMatches: (limit?: number) => Match[];
  getHeadToHead: (player1Id: string, player2Id: string) => HeadToHead;
}

export const useMatchStore = create<MatchState>()(
  persist(
    (set, get) => ({
      matches: mockMatches,
      isLoading: false,
      error: null,

      addMatch: async (player1Id, player2Id, player1Score, player2Score, sets, tournamentId) => {
        set({ isLoading: true, error: null });
        try {
          const winner = player1Score > player2Score ? player1Id : player2Id;
          
          // Get current player ratings
          const playerStore = usePlayerStore.getState();
          const statsStore = useStatsStore.getState();
          const notificationStore = useNotificationStore.getState();
          const achievementStore = useAchievementStore.getState();
          
          const player1 = playerStore.getPlayerById(player1Id);
          const player2 = playerStore.getPlayerById(player2Id);
          
          if (!player1 || !player2) {
            throw new Error("Player not found");
          }
          
          // Calculate new ELO ratings
          const { player1NewRating, player2NewRating } = calculateEloRating(
            player1.eloRating,
            player2.eloRating,
            winner === player1Id
          );
          
          // Create new match
          const newMatch: Match = {
            id: `m${Date.now()}`,
            player1Id,
            player2Id,
            player1Score,
            player2Score,
            sets,
            winner,
            date: new Date().toISOString(),
            tournamentId,
          };
          
          // Update player ratings
          await playerStore.updatePlayerRating(player1Id, player1NewRating);
          await playerStore.updatePlayerRating(player2Id, player2NewRating);
          
          // Update player stats
          await playerStore.updatePlayerStats(player1Id, winner === player1Id);
          await playerStore.updatePlayerStats(player2Id, winner === player2Id);
          
          // Update streaks
          statsStore.updatePlayerStreak(player1Id, winner === player1Id);
          statsStore.updatePlayerStreak(player2Id, winner === player2Id);
          
          // Record rating changes
          statsStore.addRankingChange({
            playerId: player1Id,
            oldRating: player1.eloRating,
            newRating: player1NewRating,
            change: player1NewRating - player1.eloRating,
            date: new Date().toISOString(),
          });
          
          statsStore.addRankingChange({
            playerId: player2Id,
            oldRating: player2.eloRating,
            newRating: player2NewRating,
            change: player2NewRating - player2.eloRating,
            date: new Date().toISOString(),
          });
          
          set((state) => ({
            matches: [newMatch, ...state.matches],
            isLoading: false,
          }));
          
          // Send notifications
          notificationStore.sendMatchResultNotification(newMatch, player1, player2);
          
          // Check for significant rating changes
          if (Math.abs(player1NewRating - player1.eloRating) >= 15) {
            notificationStore.sendRankingChangeNotification(
              player1, 
              player1.eloRating, 
              player1NewRating
            );
          }
          
          if (Math.abs(player2NewRating - player2.eloRating) >= 15) {
            notificationStore.sendRankingChangeNotification(
              player2, 
              player2.eloRating, 
              player2NewRating
            );
          }
          
          // Check for achievements
          const player1Achievements = await achievementStore.checkAndUpdateAchievements(player1Id);
          const player2Achievements = await achievementStore.checkAndUpdateAchievements(player2Id);
          
          // Send achievement notifications
          player1Achievements.forEach(achievement => {
            notificationStore.sendAchievementNotification(player1, achievement);
          });
          
          player2Achievements.forEach(achievement => {
            notificationStore.sendAchievementNotification(player2, achievement);
          });
          
          return newMatch;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to add match" 
          });
          throw error;
        }
      },

      getMatchById: (matchId) => {
        return get().matches.find((match) => match.id === matchId);
      },

      getMatchesByPlayerId: (playerId) => {
        return get().matches.filter(
          (match) => match.player1Id === playerId || match.player2Id === playerId
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },

      getRecentMatches: (limit = 10) => {
        return [...get().matches]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit);
      },

      getHeadToHead: (player1Id, player2Id) => {
        const matches = get().matches.filter(
          (match) => 
            (match.player1Id === player1Id && match.player2Id === player2Id) ||
            (match.player1Id === player2Id && match.player2Id === player1Id)
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const player1Wins = matches.filter(
          (match) => match.winner === player1Id
        ).length;
        
        const player2Wins = matches.filter(
          (match) => match.winner === player2Id
        ).length;
        
        return {
          player1Id,
          player2Id,
          player1Wins,
          player2Wins,
          matches,
        };
      },
    }),
    {
      name: "pingpong-matches",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);