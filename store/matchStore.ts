import { create } from "zustand";
import { Achievement } from "@/types";
import { Match, Set, HeadToHead } from "@/types";
import { usePlayerStore } from "./playerStore";
// import { useStatsStore } from "./statsStore"; // replaced by dynamic require
import { useNotificationStore } from "./notificationStore";
// import { useAchievementStore } from "./achievementStore"; // replaced by dynamic require
import { calculateEloRating } from "@/utils/elo";
import { supabase } from "@/lib/supabase";

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
  (set, get) => ({

    matches: [],
    isLoading: false,
    error: null,

    addMatch: async (player1Id, player2Id, player1Score, player2Score, sets, tournamentId) => {
      set({ isLoading: true, error: null });
      try {
        const winner = player1Score > player2Score ? player1Id : player2Id;
        // Get current player ratings
        const playerStore = usePlayerStore.getState();
        const statsStore = require("./statsStore").useStatsStore.getState();
        const notificationStore = useNotificationStore.getState();
        const achievementStore = require("./achievementStore").useAchievementStore.getState();
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
        // Insert match into Supabase
        const { data, error } = await supabase.from('matches').insert([
          {
            player1_id: player1Id,
            player2_id: player2Id,
            player1_score: player1Score,
            player2_score: player2Score,
            sets: JSON.stringify(sets),
            winner: winner,
            tournament_id: tournamentId,
            date: new Date().toISOString(),
          }
        ]).select().single();
        if (error) throw error;
        const newMatch: Match = {
          id: data.id,
          player1Id: data.player1_id,
          player2Id: data.player2_id,
          player1Score: data.player1_score,
          player2Score: data.player2_score,
          sets: typeof data.sets === 'string' ? JSON.parse(data.sets) : data.sets,
          winner: data.winner,
          date: data.date,
          tournamentId: data.tournament_id,
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
        player1Achievements.forEach((achievement: Achievement) => {
          notificationStore.sendAchievementNotification(player1, achievement);
        });
        player2Achievements.forEach((achievement: Achievement) => {
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
    // Fetch all matches from Supabase on store initialization
  }),
);

// Fetch matches from Supabase when the app starts
export const fetchMatchesFromSupabase = async () => {
  useMatchStore.setState({ isLoading: true, error: null });
  try {
    const { data, error } = await supabase.from('matches').select('*');
    if (error) throw error;
    const matches: Match[] = data.map((item: any) => ({
      id: item.id,
      player1Id: item.player1_id,
      player2Id: item.player2_id,
      player1Score: item.player1_score,
      player2Score: item.player2_score,
      sets: typeof item.sets === 'string' ? JSON.parse(item.sets) : item.sets,
      winner: item.winner,
      date: item.date,
      tournamentId: item.tournament_id,
    }));
    useMatchStore.setState({ matches, isLoading: false });
  } catch (error) {
    useMatchStore.setState({ isLoading: false, error: error instanceof Error ? error.message : "Failed to fetch matches" });
  }
};

// Setup realtime subscription for matches table
import { useEffect } from "react";

export const useMatchesRealtime = () => {
  useEffect(() => {
    const channel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          fetchMatchesFromSupabase();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};

// Usage example (call in App.tsx or useEffect in root):
// import { useMatchStore, fetchMatchesFromSupabase, useMatchesRealtime } from '@/store/matchStore';
// useMatchesRealtime();