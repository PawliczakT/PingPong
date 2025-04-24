import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Achievement, AchievementProgress, AchievementType } from "@/types";
import { usePlayerStore } from "./playerStore";
import { useMatchStore } from "./matchStore";
import { useTournamentStore } from "./tournamentStore";
import { achievements } from "@/constants/achievements";

interface AchievementState {
  playerAchievements: Record<string, AchievementProgress[]>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initializePlayerAchievements: (playerId: string) => void;
  updateAchievementProgress: (playerId: string, achievementType: AchievementType, progress: number) => void;
  unlockAchievement: (playerId: string, achievementType: AchievementType) => Promise<Achievement | null>;
  getPlayerAchievements: (playerId: string) => AchievementProgress[];
  getUnlockedAchievements: (playerId: string) => Achievement[];
  checkAndUpdateAchievements: (playerId: string) => Promise<Achievement[]>;
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      playerAchievements: {},
      isLoading: false,
      error: null,

      initializePlayerAchievements: (playerId) => {
        if (!get().playerAchievements[playerId]) {
          set((state) => ({
            playerAchievements: {
              ...state.playerAchievements,
              [playerId]: achievements.map(achievement => ({
                type: achievement.type,
                progress: 0,
                unlocked: false,
                unlockedAt: null,
              })),
            },
          }));
        }
      },

      updateAchievementProgress: (playerId, achievementType, progress) => {
        set((state) => {
          // Initialize if needed
          if (!state.playerAchievements[playerId]) {
            get().initializePlayerAchievements(playerId);
          }
          
          const updatedAchievements = state.playerAchievements[playerId].map(achievement => {
            if (achievement.type === achievementType && !achievement.unlocked) {
              return {
                ...achievement,
                progress: Math.max(achievement.progress, progress),
              };
            }
            return achievement;
          });
          
          return {
            playerAchievements: {
              ...state.playerAchievements,
              [playerId]: updatedAchievements,
            },
          };
        });
      },

      unlockAchievement: async (playerId, achievementType) => {
        const achievementDef = achievements.find(a => a.type === achievementType);
        if (!achievementDef) return null;
        
        set((state) => {
          const updatedAchievements = state.playerAchievements[playerId]?.map(achievement => {
            if (achievement.type === achievementType && !achievement.unlocked) {
              return {
                ...achievement,
                progress: achievementDef.target,
                unlocked: true,
                unlockedAt: new Date().toISOString(),
              };
            }
            return achievement;
          }) || [];
          
          return {
            playerAchievements: {
              ...state.playerAchievements,
              [playerId]: updatedAchievements,
            },
          };
        });
        
        return achievementDef;
      },

      getPlayerAchievements: (playerId) => {
        if (!get().playerAchievements[playerId]) {
          get().initializePlayerAchievements(playerId);
        }
        return get().playerAchievements[playerId] || [];
      },

      getUnlockedAchievements: (playerId) => {
        const playerAchievements = get().getPlayerAchievements(playerId);
        const unlockedTypes = playerAchievements
          .filter(a => a.unlocked)
          .map(a => a.type);
        
        return achievements.filter(a => unlockedTypes.includes(a.type));
      },

      checkAndUpdateAchievements: async (playerId) => {
        const playerStore = usePlayerStore.getState();
        const matchStore = useMatchStore.getState();
        const tournamentStore = useTournamentStore.getState();
        
        const player = playerStore.getPlayerById(playerId);
        if (!player) return [];
        
        // Initialize achievements if needed
        get().initializePlayerAchievements(playerId);
        
        const playerMatches = matchStore.getMatchesByPlayerId(playerId);
        const playerWins = player.wins;
        const playerLosses = player.losses;
        const totalMatches = playerWins + playerLosses;
        
        // Get tournaments won by player
        const tournamentsWon = tournamentStore.tournaments.filter(t => t.winner === playerId).length;
        
        // Calculate current win streak
        let currentStreak = 0;
        let isWinStreak = true;
        
        // Sort matches by date (newest first)
        const sortedMatches = [...playerMatches].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        for (const match of sortedMatches) {
          const isWin = match.winner === playerId;
          
          if (currentStreak === 0) {
            // First match in the sequence
            currentStreak = 1;
            isWinStreak = isWin;
          } else if (isWin === isWinStreak) {
            // Continuing the streak
            currentStreak++;
          } else {
            // Streak broken
            break;
          }
        }
        
        // Calculate longest win streak
        let longestWinStreak = 0;
        let currentWinStreak = 0;
        
        // Sort matches by date (oldest first)
        const chronologicalMatches = [...sortedMatches].reverse();
        
        for (const match of chronologicalMatches) {
          if (match.winner === playerId) {
            currentWinStreak++;
            longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
          } else {
            currentWinStreak = 0;
          }
        }
        
        // Check for clean sweep matches (won without losing a set)
        const cleanSweepMatches = playerMatches.filter(match => {
          if (match.winner !== playerId) return false;
          
          // Check if player won all sets
          const playerIsPlayer1 = match.player1Id === playerId;
          return match.sets.every(set => 
            playerIsPlayer1 
              ? set.player1Score > set.player2Score 
              : set.player2Score > set.player1Score
          );
        }).length;
        
        // Check for top player defeats
        const topPlayerIds = playerStore.getActivePlayersSortedByRating()
          .slice(0, 3)
          .map(p => p.id)
          .filter(id => id !== playerId);
        
        const topPlayerDefeats = playerMatches.filter(match => {
          const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;
          return match.winner === playerId && topPlayerIds.includes(opponentId);
        }).length;
        
        // Update progress for each achievement type
        const progressUpdates = [
          { type: AchievementType.FIRST_WIN, progress: playerWins > 0 ? 1 : 0 },
          { type: AchievementType.WINS_10, progress: playerWins },
          { type: AchievementType.WINS_25, progress: playerWins },
          { type: AchievementType.WINS_50, progress: playerWins },
          { type: AchievementType.MATCHES_10, progress: totalMatches },
          { type: AchievementType.MATCHES_25, progress: totalMatches },
          { type: AchievementType.MATCHES_50, progress: totalMatches },
          { type: AchievementType.MATCHES_100, progress: totalMatches },
          { type: AchievementType.WIN_STREAK_3, progress: isWinStreak ? currentStreak : 0 },
          { type: AchievementType.WIN_STREAK_5, progress: isWinStreak ? currentStreak : 0 },
          { type: AchievementType.WIN_STREAK_10, progress: isWinStreak ? currentStreak : 0 },
          { type: AchievementType.LONGEST_STREAK_5, progress: longestWinStreak },
          { type: AchievementType.LONGEST_STREAK_10, progress: longestWinStreak },
          { type: AchievementType.TOURNAMENT_WIN, progress: tournamentsWon },
          { type: AchievementType.TOURNAMENT_WINS_3, progress: tournamentsWon },
          { type: AchievementType.TOURNAMENT_WINS_5, progress: tournamentsWon },
          { type: AchievementType.CLEAN_SWEEP, progress: cleanSweepMatches },
          { type: AchievementType.CLEAN_SWEEPS_5, progress: cleanSweepMatches },
          { type: AchievementType.CLEAN_SWEEPS_10, progress: cleanSweepMatches },
          { type: AchievementType.DEFEAT_TOP_PLAYER, progress: topPlayerDefeats },
          { type: AchievementType.DEFEAT_TOP_PLAYERS_5, progress: topPlayerDefeats },
          { type: AchievementType.DEFEAT_TOP_PLAYERS_10, progress: topPlayerDefeats },
        ];
        
        // Update progress for all achievements
        progressUpdates.forEach(update => {
          get().updateAchievementProgress(playerId, update.type, update.progress);
        });
        
        // Check which achievements should be unlocked
        const achievementDefs = achievements;
        const playerAchievements = get().getPlayerAchievements(playerId);
        
        const newlyUnlocked: Achievement[] = [];
        
        for (const achievement of playerAchievements) {
          if (!achievement.unlocked) {
            const def = achievementDefs.find(a => a.type === achievement.type);
            if (def && achievement.progress >= def.target) {
              const unlocked = await get().unlockAchievement(playerId, achievement.type);
              if (unlocked) {
                newlyUnlocked.push(unlocked);
              }
            }
          }
        }
        
        return newlyUnlocked;
      },
    }),
    {
      name: "pingpong-achievements",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);