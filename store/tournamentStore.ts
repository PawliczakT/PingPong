import { create } from "zustand";
import { Tournament, TournamentFormat, TournamentStatus, Match, TournamentMatch } from "@/types";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from 'uuid';

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
  (set, get) => ({

    tournaments: [],
    isLoading: false,
    error: null,

    createTournament: async (name, date, format, participants) => {
      set({ isLoading: true, error: null });
      try {
        // Insert tournament
        const { data: tournamentData, error: tournamentError } = await supabase.from('tournaments').insert([
          {
            name,
            date,
            format,
            status: TournamentStatus.UPCOMING,
          }
        ]).select().single();
        if (tournamentError) throw tournamentError;
        // Insert participants
        const participantRows = participants.map((playerId) => ({
          tournament_id: tournamentData.id,
          player_id: playerId,
        }));
        if (participantRows.length > 0) {
          const { error: participantsError } = await supabase.from('tournament_participants').insert(participantRows);
          if (participantsError) {
            console.error('Błąd dodawania uczestników:', participantsError);
            if (typeof window !== 'undefined') alert('Błąd dodawania uczestników: ' + participantsError.message);
            throw participantsError;
          } else {
            console.log('Dodano uczestników:', participantRows);
          }
        }
        // Compose Tournament object
        const newTournament: Tournament = {
          id: tournamentData.id,
          name: tournamentData.name,
          date: tournamentData.date,
          format: tournamentData.format,
          status: tournamentData.status,
          participants,
          matches: [],
          tournamentMatches: [],
          createdAt: tournamentData.created_at,
          updatedAt: tournamentData.updated_at,
        };
        set((state) => ({
          tournaments: [...state.tournaments, newTournament],
          isLoading: false,
        }));
        // Automatycznie generuj drabinkę/mecze po utworzeniu turnieju
        await get().generateTournamentMatches(newTournament.id);
        // Odśwież turnieje po wygenerowaniu meczów
        await fetchTournamentsFromSupabase();
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
        const { error } = await supabase.from('tournaments').update({
          name: updatedTournament.name,
          date: updatedTournament.date,
          format: updatedTournament.format,
          status: updatedTournament.status,
          winner: updatedTournament.winner,
          updated_at: new Date().toISOString(),
        }).eq('id', updatedTournament.id);
        if (error) throw error;
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
          
          // Jeśli turniej jest uruchamiany, automatycznie generuj drabinkę i mecze
          if (status === TournamentStatus.IN_PROGRESS) {
            console.log('Turniej jest uruchamiany, generuję drabinkę i mecze...');
            // Najpierw usuń wszystkie istniejące mecze dla tego turnieju (opcjonalnie, jeśli chcesz nadpisać)
            await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
            console.log('Usunięto istniejące mecze dla turnieju.');
            // Następnie wygeneruj pełną drabinkę i zapisz do bazy
            await get().generateTournamentMatches(tournamentId);
            console.log('Wygenerowano pełną drabinkę i mecze dla turnieju.');
            // Po wygenerowaniu, odśwież turnieje
            await fetchTournamentsFromSupabase();
            console.log('Odświeżono turnieje po wygenerowaniu meczów.');
          }
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to update tournament status" 
          });
          console.error('Błąd aktualizacji statusu turnieju:', error);
          throw error;
        }
      },
      
      generateTournamentMatches: async (tournamentId) => {
  const { fetchTournamentsFromSupabase } = require('./tournamentStore');
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
              id: uuidv4(),
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
              id: uuidv4(),
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
                id: uuidv4(),
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
                id: uuidv4(),
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
                  id: uuidv4(),
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

        // --- NEW: Add knockout phase after group phase ---
        // This logic assumes group matches are round 1, knockout will be round 2+
        // Find group winners (and optionally best runner-up)
        // 1. Group by group number
        const groupResults: Record<number, { playerId: string, points: number, setsWon: number }[]> = {};
        for (const match of tournamentMatches.filter(m => m.round === 1 && m.status === 'completed')) {
          const group = match.group;
          if (!group) continue;
          if (!groupResults[group]) groupResults[group] = [];
          // Add/update player1
          let p1 = groupResults[group].find(p => p.playerId === match.player1Id);
          if (!p1) { p1 = { playerId: match.player1Id!, points: 0, setsWon: 0 }; groupResults[group].push(p1); }
          let p2 = groupResults[group].find(p => p.playerId === match.player2Id);
          if (!p2) { p2 = { playerId: match.player2Id!, points: 0, setsWon: 0 }; groupResults[group].push(p2); }
          // Win/loss points
          if (match.winner === match.player1Id) {
            p1.points += 2;
            p2.points += 1;
          } else if (match.winner === match.player2Id) {
            p2.points += 2;
            p1.points += 1;
          }
          // Sets won
          if (Array.isArray(match.sets)) {
            let p1Sets = 0, p2Sets = 0;
            match.sets.forEach(set => {
              if (set.player1Score > set.player2Score) p1Sets++;
              else if (set.player2Score > set.player1Score) p2Sets++;
            });
            p1.setsWon += p1Sets;
            p2.setsWon += p2Sets;
          }
        }
        // 2. Find group winners
        let advancing: { playerId: string, points: number, setsWon: number }[] = [];
        Object.values(groupResults).forEach(players => {
          players.sort((a, b) => b.points !== a.points ? b.points - a.points : b.setsWon - a.setsWon);
          if (players.length > 0) advancing.push(players[0]);
        });
        // 3. If only 3 advancing, add best runner-up
        if (advancing.length === 3) {
          // Find best 2nd place
          let seconds: { playerId: string, points: number, setsWon: number }[] = [];
          Object.values(groupResults).forEach(players => {
            if (players.length > 1) seconds.push(players[1]);
          });
          if (seconds.length > 0) {
            seconds.sort((a, b) => b.points !== a.points ? b.points - a.points : b.setsWon - a.setsWon);
            advancing.push(seconds[0]);
          }
        }
        // 4. Sort advancing by points/setsWon for seeding
        advancing.sort((a, b) => b.points !== a.points ? b.points - a.points : b.setsWon - a.setsWon);
        // --- DEBUG LOGI ---
        console.log('[KO] groupResults:', groupResults);
        console.log('[KO] advancing:', advancing);
        // 5. Create knockout matches
        const knockoutMatches: TournamentMatch[] = [];
        if (advancing.length === 3) {
  // Best gets bye to final
  const [bye, ...rest] = advancing;
  // Semifinal: rest[0] vs rest[1]
  const semiId = uuidv4();
  knockoutMatches.push({
    id: semiId,
    tournamentId,
    round: 2,
    matchNumber: 1,
    player1Id: rest[0].playerId,
    player2Id: rest[1].playerId,
    player1Score: 0,
    player2Score: 0,
    winner: null,
    matchId: null,
    nextMatchId: null, // Will update after final is created
    status: 'scheduled',
  });
  // Final
  const finalId = uuidv4();
  knockoutMatches.push({
    id: finalId,
    tournamentId,
    round: 3,
    matchNumber: 1,
    player1Id: bye.playerId,
    player2Id: null,
    player1Score: 0,
    player2Score: 0,
    winner: null,
    matchId: null,
    nextMatchId: null,
    status: 'pending',
  });
  // Link semi to final
  knockoutMatches[0].nextMatchId = finalId;
} else if ((advancing.length & (advancing.length - 1)) === 0 && advancing.length >= 4) {
  // Obsługa knockout dla 4, 8, 16, ... graczy (pełna drabinka, potęga 2)
  // Algorytm: generuj kolejne rundy, każda runda dzieli liczbę graczy przez 2
  let round = 1;
  let matchesInRound = advancing.length / 2;
  let players = advancing.map(a => a.playerId);
  let matchNumber = 1;
  const roundsArr: { matches: any[], round: number }[] = [];
  // Ćwierćfinały, półfinały, finał, ...
  while (matchesInRound >= 1) {
    const roundMatches = [];
    for (let i = 0; i < matchesInRound; i++) {
      const player1Id = players[i * 2] || null;
      const player2Id = players[i * 2 + 1] || null;
      const matchId = uuidv4();
      roundMatches.push({
        id: matchId,
        tournamentId,
        round,
        matchNumber,
        player1Id,
        player2Id,
        player1Score: 0,
        player2Score: 0,
        winner: null,
        matchId: null,
        nextMatchId: null, // Uzupełnimy później
        status: 'scheduled',
      });
      matchNumber++;
    }
    roundsArr.push({ matches: roundMatches, round });
    players = new Array(matchesInRound).fill(null); // Placeholdery dla zwycięzców
    matchesInRound = Math.floor(matchesInRound / 2);
    round++;
    matchNumber = 1;
  }
  // Dodaj mecze do knockoutMatches
  roundsArr.forEach(r => knockoutMatches.push(...r.matches));
  // Ustaw nextMatchId dla każdej rundy (poza finałem)
  for (let r = 0; r < roundsArr.length - 1; r++) {
    for (let i = 0; i < roundsArr[r].matches.length; i++) {
      const next = roundsArr[r + 1].matches[Math.floor(i / 2)];
      roundsArr[r].matches[i].nextMatchId = next.id;
    }
  }
} else {
  // Ostrzeżenie o nieobsługiwanej liczbie graczy
  console.warn('[KO] Liczba graczy knockout nie jest obsługiwana:', advancing.length);
}

// Szczegółowe logi knockoutMatches po wygenerowaniu:
console.log('[KO] knockoutMatches szczegóły:');
knockoutMatches.forEach(m => {
  console.log(`KO: round=${m.round}, matchNumber=${m.matchNumber}, player1Id=${m.player1Id}, player2Id=${m.player2Id}, id=${m.id}`);
});
// Sprawdź ciągłość numeracji rund:
const roundsSet = new Set(knockoutMatches.map(m => m.round));
const roundsArrSorted = Array.from(roundsSet).sort((a, b) => a - b);
for (let i = 1; i < roundsArrSorted.length; i++) {
  if (roundsArrSorted[i] !== roundsArrSorted[i - 1] + 1) {
    console.warn('[KO] Nieciągłość numeracji rund:', roundsArrSorted);
  }
}
// Sprawdź powtarzające się rundy:
const roundCounts: Record<number, number> = {};
knockoutMatches.forEach(m => {
  roundCounts[m.round] = (roundCounts[m.round] || 0) + 1;
});
Object.entries(roundCounts).forEach(([round, count]) => {
  if (count > advancing.length / 2 && Number(round) !== roundsArrSorted[roundsArrSorted.length - 1]) {
    console.warn(`[KO] Podejrzanie dużo meczów w rundzie ${round}:`, count);
  }
});
        // Add knockout matches to tournamentMatches
// (szczegółowe logi już powyżej)
tournamentMatches.push(...knockoutMatches);
        // --- END knockout logic ---
        
        // Zapisz wygenerowane mecze do bazy (tabela tournament_matches)
        if (tournamentMatches.length > 0) {
          // Przygotuj dane zgodne ze schematem tabeli
          const matchesToInsert = tournamentMatches.map(m => ({
            id: m.id,
            tournament_id: m.tournamentId,
            round: m.round,
            match_number: m.matchNumber,
            player1_id: m.player1Id,
            player2_id: m.player2Id,
            player1_score: m.player1Score,
            player2_score: m.player2Score,
            winner: m.winner,
            match_id: m.matchId,
            next_match_id: m.nextMatchId,
            status: m.status,
            group: m.group || null
          }));
          const { error: matchesError, data: insertData } = await supabase.from('tournament_matches').insert(matchesToInsert);
          if (matchesError) {
            console.error('Błąd dodawania meczów:', matchesError);
            if (typeof window !== 'undefined') alert('Błąd dodawania meczów: ' + matchesError.message);
            throw matchesError;
          } else {
            console.log('Dodano mecze:', matchesToInsert);
            console.log('Odpowiedź z inserta:', insertData);
          }
        }
        // Update tournament with generated matches (w pamięci/zustand)
        await get().updateTournament({
          ...tournament,
          tournamentMatches,
        });
        
        await fetchTournamentsFromSupabase();
  return tournamentMatches;
      },
      
      getTournamentMatches: (tournamentId) => {
        const tournament = get().getTournamentById(tournamentId);
        if (!tournament) return [];
        return (tournament.tournamentMatches || []) as TournamentMatch[];
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
        
        // Update tournament match and always set status to 'completed'
        tournamentMatches[matchIndex] = {
          ...match,
          player1Score: result.player1Score,
          player2Score: result.player2Score,
          winner,
          status: 'completed',
        };

        // --- Knockout fix: propagate winner to all next matches that reference this match as previous ---
        // For each match in the next rounds, if player1Id/player2Id is null and previous match is this one, set the winner
        tournamentMatches.forEach((m, idx) => {
          // If this match is referenced as nextMatchId and player1Id/player2Id is empty, set winner
          if (m.nextMatchId === match.nextMatchId && m.id !== match.id) {
            // Defensive: skip self
            return;
          }
          if (m.id !== match.id && m.nextMatchId === match.nextMatchId) {
            // Defensive: skip self
            return;
          }
          // If this match is the next match, update player slots
          if (m.id === match.nextMatchId) {
            if (!m.player1Id) {
              tournamentMatches[idx] = { ...m, player1Id: winner, status: m.player2Id ? 'scheduled' : 'pending' };
            } else if (!m.player2Id) {
              tournamentMatches[idx] = { ...m, player2Id: winner, status: 'scheduled' };
            }
          }
        });
        // Update status in Supabase as well
        await supabase.from('tournament_matches').update({
          player1_score: result.player1Score,
          player2_score: result.player2Score,
          winner,
          status: 'completed',
        }).eq('id', matchId);
        
        // --- GROUP PHASE: check if all group matches are completed, then regenerate knockout phase ---
        if (match.round === 1 && tournament.format === TournamentFormat.GROUP) {
          const allGroupCompleted = tournamentMatches.filter(m => m.round === 1).every(m => m.status === 'completed');
          const hasKnockout = tournamentMatches.some(m => m.round > 1);
          if (allGroupCompleted) {
            // Usuń stare knockouty (round > 1)
            const groupMatches = tournamentMatches.filter(m => m.round === 1);
            tournamentMatches.length = 0;
            tournamentMatches.push(...groupMatches);
            // Wygeneruj knockouty na nowo
            await get().generateTournamentMatches(tournamentId);
            // Po wygenerowaniu knockoutów, usuń ewentualne duplikaty knockoutów z tournamentMatches
            const seenIds = new Set();
            for (let i = tournamentMatches.length - 1; i >= 0; i--) {
              const match = tournamentMatches[i];
              if (!match.id) continue;
              if (seenIds.has(match.id)) {
                tournamentMatches.splice(i, 1);
              } else {
                seenIds.add(match.id);
              }
            }
            // Odśwież turnieje
            const { fetchTournamentsFromSupabase } = require('./tournamentStore');
            await fetchTournamentsFromSupabase();
            console.log('[KO] Knockout phase regenerated after group completion');
            // Użytkownik dostanie alert na froncie (w TournamentDetailScreen)
          }
        }
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
        
        // --- ZAPISZ MECZ DO OGÓLNEJ HISTORII (matches) ---
  // Jeżeli nie ma powiązanego matchId, utwórz nowy rekord w matches
  if (!match.matchId) {
    try {
      const matchStore = require('./matchStore').useMatchStore.getState();
      const newMatch = await matchStore.addMatch(
        match.player1Id,
        match.player2Id,
        result.player1Score,
        result.player2Score,
        result.sets || [],
        tournamentId
      );
      // Zaktualizuj matchId w tournamentMatches i w bazie
      tournamentMatches[matchIndex].matchId = newMatch.id;
      await supabase.from('tournament_matches').update({ match_id: newMatch.id }).eq('id', matchId);
      console.log('Dodano mecz do matches oraz zaktualizowano matchId:', newMatch.id);
    } catch (err) {
      console.error('Błąd podczas dodawania meczu do matches:', err);
    }
  }

  // Update tournament with updated matches
  await get().updateTournament({
    ...tournament,
    tournamentMatches,
  });
  // --- KONIEC funkcji updateTournamentMatch ---
      },
      
      // Fetch all tournaments from Supabase on store initialization
  }),
);

// Fetch tournaments from Supabase when the app starts
export const fetchTournamentsFromSupabase = async () => {
  useTournamentStore.setState({ isLoading: true, error: null });
  try {
    const { data: tournamentsData, error: tournamentsError } = await supabase.from('tournaments').select('*');
    if (tournamentsError) throw tournamentsError;
    console.log('tournamentsData', tournamentsData);
    // Fetch participants for all tournaments
    const { data: participantsData, error: participantsError } = await supabase.from('tournament_participants').select('*');
    if (participantsError) throw participantsError;
    // Fetch matches for all tournaments
    const { data: matchesData, error: matchesError } = await supabase.from('tournament_matches').select('*');
    if (matchesError) {
      console.error('Błąd pobierania meczów:', matchesError);
      if (typeof window !== 'undefined') alert('Błąd pobierania meczów: ' + matchesError.message);
      throw matchesError;
    }
    // Fetch all matches (for sets)
    const { data: allMatchesData, error: allMatchesError } = await supabase.from('matches').select('*');
    if (allMatchesError) {
      console.error('Błąd pobierania wszystkich meczów:', allMatchesError);
      throw allMatchesError;
    }
    // Build a map of matchId -> sets
    const setsByMatchId: Record<string, any[]> = {};
    if (Array.isArray(allMatchesData)) {
      allMatchesData.forEach((m: any) => {
        if (m.id && m.sets) {
          setsByMatchId[m.id] = typeof m.sets === 'string' ? JSON.parse(m.sets) : m.sets;
        }
      });
    }
    console.log('matchesData', matchesData);
    if (Array.isArray(matchesData) && matchesData.length === 0) {
      if (typeof window !== 'undefined') alert('UWAGA: matchesData jest puste po fetchu!');
      console.warn('UWAGA: matchesData jest puste po fetchu!');
    }
    // Group participants by tournament
    const participantsByTournament: Record<string, string[]> = {};
    participantsData.forEach((row: any) => {
      if (!participantsByTournament[row.tournament_id]) participantsByTournament[row.tournament_id] = [];
      participantsByTournament[row.tournament_id].push(row.player_id);
    });
    // Group matches by tournament
    const matchesByTournament: Record<string, any[]> = {};
    matchesData.forEach((row: any) => {
      if (!matchesByTournament[row.tournament_id]) matchesByTournament[row.tournament_id] = [];
      matchesByTournament[row.tournament_id].push({
        id: row.id,
        tournamentId: row.tournament_id,
        round: row.round,
        matchNumber: row.match_number,
        player1Id: row.player1_id,
        player2Id: row.player2_id,
        player1Score: row.player1_score,
        player2Score: row.player2_score,
        winner: row.winner,
        matchId: row.match_id,
        nextMatchId: row.next_match_id,
        status: row.status,
        group: row.group,
        sets: row.match_id && setsByMatchId[row.match_id] ? setsByMatchId[row.match_id] : [],
      });
    });
    console.log('matchesByTournament', matchesByTournament);
  // --- END LOGS ---
    const tournaments: Tournament[] = tournamentsData.map((item: any) => ({
      id: item.id,
      name: item.name,
      date: item.date,
      format: item.format,
      status: item.status,
      winner: item.winner,
      participants: participantsByTournament[item.id] || [],
      matches: [],
      tournamentMatches: matchesByTournament[item.id] || [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
    // LOGI: ile meczów i jakie rundy ma każdy turniej
    Object.entries(matchesByTournament).forEach(([tid, matches]) => {
      const rounds = Array.from(new Set(matches.map((m: any) => m.round)));
      console.log(`[FETCH] Tournament ${tid}: ${matches.length} matches, rounds:`, rounds);
    });
    useTournamentStore.setState({ tournaments, isLoading: false });
  } catch (error) {
    useTournamentStore.setState({ isLoading: false, error: error instanceof Error ? error.message : "Failed to fetch tournaments" });
  }
};

// Setup realtime subscriptions for tournaments and tournament_participants tables
import { useEffect } from "react";

export const useTournamentsRealtime = () => {
  useEffect(() => {
    const tournamentsChannel = supabase
      .channel('tournaments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => {
          fetchTournamentsFromSupabase();
        }
      )
      .subscribe();
    const participantsChannel = supabase
      .channel('tournament-participants-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_participants' },
        () => {
          fetchTournamentsFromSupabase();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(tournamentsChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, []);
};

// Usage example (call in App.tsx or useEffect in root):
// import { useTournamentStore, fetchTournamentsFromSupabase, useTournamentsRealtime } from '@/store/tournamentStore';
// useTournamentsRealtime();
// useEffect(() => { fetchTournamentsFromSupabase(); }, []);