import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tournament, TournamentFormat, TournamentStatus, Match, TournamentMatch } from "@/types";
import { mockTournaments } from "@/utils/mockData";

interface TournamentState {
  tournaments: Tournament[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createTournament: (
    name: string, 
    date: string, 
    format: TournamentFormat, 
    participants: string[]
  ) => Promise<Tournament>;
  updateTournament: (tournament: Tournament) => Promise<void>;
  getTournamentById: (tournamentId: string) => Tournament | undefined;
  getUpcomingTournaments: () => Tournament[];
  getActiveTournaments: () => Tournament[];
  getCompletedTournaments: () => Tournament[];
  addMatchToTournament: (tournamentId: string, matchId: string) => Promise<void>;
  setTournamentWinner: (tournamentId: string, playerId: string) => Promise<void>;
  updateTournamentStatus: (tournamentId: string, status: TournamentStatus) => Promise<void>;
  generateTournamentMatches: (tournamentId: string) => Promise<TournamentMatch[]>;
  getTournamentMatches: (tournamentId: string) => TournamentMatch[];
  updateTournamentMatch: (tournamentId: string, matchId: string, result: { player1Score: number, player2Score: number, sets: any[] }) => Promise<void>;
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => ({
      tournaments: mockTournaments,
      isLoading: false,
      error: null,

      createTournament: async (name, date, format, participants) => {
        set({ isLoading: true, error: null });
        try {
          const newTournament: Tournament = {
            id: `t${Date.now()}`,
            name,
            date,
            format,
            status: TournamentStatus.UPCOMING,
            participants,
            matches: [],
            tournamentMatches: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          set((state) => ({
            tournaments: [...state.tournaments, newTournament],
            isLoading: false,
          }));
          
          return newTournament;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to create tournament" 
          });
          throw error;
        }
      },

      updateTournament: async (updatedTournament) => {
        set({ isLoading: true, error: null });
        try {
          set((state) => ({
            tournaments: state.tournaments.map((tournament) => 
              tournament.id === updatedTournament.id 
                ? { ...updatedTournament, updatedAt: new Date().toISOString() }
                : tournament
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to update tournament" 
          });
          throw error;
        }
      },

      getTournamentById: (tournamentId) => {
        return get().tournaments.find((tournament) => tournament.id === tournamentId);
      },

      getUpcomingTournaments: () => {
        return get().tournaments.filter(
          (tournament) => tournament.status === TournamentStatus.UPCOMING
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      },

      getActiveTournaments: () => {
        return get().tournaments.filter(
          (tournament) => tournament.status === TournamentStatus.IN_PROGRESS
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      },

      getCompletedTournaments: () => {
        return get().tournaments.filter(
          (tournament) => tournament.status === TournamentStatus.COMPLETED
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },

      addMatchToTournament: async (tournamentId, matchId) => {
        set({ isLoading: true, error: null });
        try {
          set((state) => ({
            tournaments: state.tournaments.map((tournament) => 
              tournament.id === tournamentId 
                ? { 
                    ...tournament, 
                    matches: [...(tournament.matches || []), matchId],
                    updatedAt: new Date().toISOString()
                  }
                : tournament
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to add match to tournament" 
          });
          throw error;
        }
      },

      setTournamentWinner: async (tournamentId, playerId) => {
        set({ isLoading: true, error: null });
        try {
          set((state) => ({
            tournaments: state.tournaments.map((tournament) => 
              tournament.id === tournamentId 
                ? { 
                    ...tournament, 
                    winner: playerId,
                    status: TournamentStatus.COMPLETED,
                    updatedAt: new Date().toISOString()
                  }
                : tournament
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to set tournament winner" 
          });
          throw error;
        }
      },

      updateTournamentStatus: async (tournamentId, status) => {
        set({ isLoading: true, error: null });
        try {
          set((state) => ({
            tournaments: state.tournaments.map((tournament) => 
              tournament.id === tournamentId 
                ? { 
                    ...tournament, 
                    status,
                    updatedAt: new Date().toISOString() 
                  }
                : tournament
            ),
            isLoading: false,
          }));
          
          // If tournament is starting, generate matches
          if (status === TournamentStatus.IN_PROGRESS) {
            await get().generateTournamentMatches(tournamentId);
          }
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to update tournament status" 
          });
          throw error;
        }
      },
      
      generateTournamentMatches: async (tournamentId) => {
        const tournament = get().getTournamentById(tournamentId);
        if (!tournament) throw new Error("Tournament not found");
        
        const participants = [...tournament.participants];
        const tournamentMatches: TournamentMatch[] = [];
        
        if (tournament.format === TournamentFormat.KNOCKOUT) {
          // Shuffle participants
          for (let i = participants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [participants[i], participants[j]] = [participants[j], participants[i]];
          }
          
          // Create first round matches
          const firstRound: TournamentMatch[] = [];
          const numMatches = Math.floor(participants.length / 2);
          
          for (let i = 0; i < numMatches; i++) {
            firstRound.push({
              id: `tm-${tournamentId}-${Date.now()}-${i}`,
              tournamentId,
              round: 1,
              matchNumber: i + 1,
              player1Id: participants[i * 2],
              player2Id: participants[i * 2 + 1],
              player1Score: 0,
              player2Score: 0,
              winner: null,
              matchId: null,
              nextMatchId: null,
              status: 'scheduled',
            });
          }
          
          // If odd number of participants, add a bye
          if (participants.length % 2 !== 0 && participants.length > 1) {
            firstRound.push({
              id: `tm-${tournamentId}-${Date.now()}-bye`,
              tournamentId,
              round: 1,
              matchNumber: numMatches + 1,
              player1Id: participants[participants.length - 1],
              player2Id: null, // Bye
              player1Score: 0,
              player2Score: 0,
              winner: participants[participants.length - 1], // Auto-win for player with bye
              matchId: null,
              nextMatchId: null,
              status: 'completed',
            });
          }
          
          tournamentMatches.push(...firstRound);
          
          // Create subsequent rounds
          let currentRound = firstRound;
          let round = 2;
          
          while (currentRound.length > 1) {
            const nextRound: TournamentMatch[] = [];
            const numNextMatches = Math.ceil(currentRound.length / 2);
            
            for (let i = 0; i < numNextMatches; i++) {
              const nextMatch: TournamentMatch = {
                id: `tm-${tournamentId}-${Date.now()}-r${round}-${i}`,
                tournamentId,
                round,
                matchNumber: i + 1,
                player1Id: null,
                player2Id: null,
                player1Score: 0,
                player2Score: 0,
                winner: null,
                matchId: null,
                nextMatchId: null,
                status: 'pending',
              };
              
              nextRound.push(nextMatch);
              
              // Update previous round matches with nextMatchId
              if (i * 2 < currentRound.length) {
                currentRound[i * 2].nextMatchId = nextMatch.id;
              }
              
              if (i * 2 + 1 < currentRound.length) {
                currentRound[i * 2 + 1].nextMatchId = nextMatch.id;
              }
            }
            
            tournamentMatches.push(...nextRound);
            currentRound = nextRound;
            round++;
          }
        } else if (tournament.format === TournamentFormat.ROUND_ROBIN) {
          // Create matches for each pair of participants
          let matchIndex = 0;
          
          for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
              tournamentMatches.push({
                id: `tm-${tournamentId}-${Date.now()}-${matchIndex}`,
                tournamentId,
                round: 1, // All matches are in the same "round" for round robin
                matchNumber: matchIndex + 1,
                player1Id: participants[i],
                player2Id: participants[j],
                player1Score: 0,
                player2Score: 0,
                winner: null,
                matchId: null,
                nextMatchId: null,
                status: 'scheduled',
              });
              
              matchIndex++;
            }
          }
        } else if (tournament.format === TournamentFormat.GROUP) {
          // For group format, we'll create groups of 4 (or less for the last group)
          const groupSize = 4;
          const numGroups = Math.ceil(participants.length / groupSize);
          
          // Shuffle participants
          for (let i = participants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [participants[i], participants[j]] = [participants[j], participants[i]];
          }
          
          // Create groups
          const groups: string[][] = [];
          
          for (let i = 0; i < numGroups; i++) {
            const start = i * groupSize;
            const end = Math.min(start + groupSize, participants.length);
            groups.push(participants.slice(start, end));
          }
          
          // Create matches within each group
          let matchIndex = 0;
          
          for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            
            for (let i = 0; i < group.length; i++) {
              for (let j = i + 1; j < group.length; j++) {
                tournamentMatches.push({
                  id: `tm-${tournamentId}-${Date.now()}-g${g}-${matchIndex}`,
                  tournamentId,
                  round: 1,
                  group: g + 1,
                  matchNumber: matchIndex + 1,
                  player1Id: group[i],
                  player2Id: group[j],
                  player1Score: 0,
                  player2Score: 0,
                  winner: null,
                  matchId: null,
                  nextMatchId: null,
                  status: 'scheduled',
                });
                
                matchIndex++;
              }
            }
          }
        }
        
        // Update tournament with generated matches
        await get().updateTournament({
          ...tournament,
          tournamentMatches,
        });
        
        return tournamentMatches;
      },
      
      getTournamentMatches: (tournamentId) => {
        const tournament = get().getTournamentById(tournamentId);
        if (!tournament) return [];
        return tournament.tournamentMatches || [];
      },
      
      updateTournamentMatch: async (tournamentId, matchId, result) => {
        const tournament = get().getTournamentById(tournamentId);
        if (!tournament) throw new Error("Tournament not found");
        
        const tournamentMatches = [...(tournament.tournamentMatches || [])];
        const matchIndex = tournamentMatches.findIndex(m => m.id === matchId);
        
        if (matchIndex === -1) throw new Error("Match not found");
        
        const match = tournamentMatches[matchIndex];
        
        // Ensure player IDs are not null before proceeding
        if (!match.player1Id || !match.player2Id) {
          throw new Error("Match players not properly set");
        }
        
        const winner = result.player1Score > result.player2Score ? match.player1Id : match.player2Id;
        
        // Update tournament match
        tournamentMatches[matchIndex] = {
          ...match,
          player1Score: result.player1Score,
          player2Score: result.player2Score,
          winner,
          status: 'completed',
        };
        
        // If this match has a next match, update the next match with the winner
        if (match.nextMatchId) {
          const nextMatchIndex = tournamentMatches.findIndex(m => m.id === match.nextMatchId);
          
          if (nextMatchIndex !== -1) {
            const nextMatch = tournamentMatches[nextMatchIndex];
            
            // Determine if this winner should be player1 or player2 in the next match
            if (!nextMatch.player1Id) {
              tournamentMatches[nextMatchIndex] = {
                ...nextMatch,
                player1Id: winner,
                status: nextMatch.player2Id ? 'scheduled' : 'pending',
              };
            } else {
              tournamentMatches[nextMatchIndex] = {
                ...nextMatch,
                player2Id: winner,
                status: 'scheduled',
              };
            }
          }
        }
        
        // Check if tournament is completed (final match is completed)
        const finalMatch = tournamentMatches.find(m => !m.nextMatchId && m.status === 'completed');
        
        if (finalMatch && tournament.format === TournamentFormat.KNOCKOUT) {
          // Set tournament winner
          if (finalMatch.winner) {
            await get().setTournamentWinner(tournamentId, finalMatch.winner);
          }
        } else if (tournament.format === TournamentFormat.ROUND_ROBIN) {
          // Check if all matches are completed
          const allCompleted = tournamentMatches.every(m => m.status === 'completed');
          
          if (allCompleted) {
            // Calculate standings
            const standings: Record<string, { wins: number, losses: number, points: number }> = {};
            
            // Initialize standings
            tournament.participants.forEach(playerId => {
              standings[playerId] = { wins: 0, losses: 0, points: 0 };
            });
            
            // Count wins and losses
            tournamentMatches.forEach(m => {
              if (m.status === 'completed' && m.winner) {
                standings[m.winner].wins++;
                standings[m.winner].points += 2; // 2 points for a win
                
                const loserId = m.winner === m.player1Id ? m.player2Id : m.player1Id;
                if (loserId) {
                  standings[loserId].losses++;
                  standings[loserId].points += 1; // 1 point for a loss
                }
              }
            });
            
            // Find the winner (player with most points)
            let maxPoints = -1;
            let winnerId = null;
            
            Object.entries(standings).forEach(([playerId, stats]) => {
              if (stats.points > maxPoints) {
                maxPoints = stats.points;
                winnerId = playerId;
              }
            });
            
            if (winnerId) {
              await get().setTournamentWinner(tournamentId, winnerId);
            }
          }
        }
        
        // Update tournament with updated matches
        await get().updateTournament({
          ...tournament,
          tournamentMatches,
        });
      },
    }),
    {
      name: "pingpong-tournaments",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);