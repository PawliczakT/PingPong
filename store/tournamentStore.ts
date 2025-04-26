import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// --- TYPES --- (Pozostają bez zmian, jak w poprzedniej odpowiedzi)
export type Tournament = {
  id: string;
  name: string;
  format: 'KNOCKOUT';
  date: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
  participants: string[];
  matches: TournamentMatch[];
  winner: string | null;
};

export type Player = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export type TournamentMatch = {
  id: string;
  tournamentId: string;
  round: number;
  player1Id: string | null;
  player2Id: string | null;
  winner: string | null;
  matchId: string | null;
  status: 'pending' | 'scheduled' | 'completed';
  player1Score: number | null;
  player2Score: number | null;
  nextMatchId: string | null;
  sets?: Set[];
};

export type Set = {
  player1Score: number;
  player2Score: number;
};

// --- STORE ---
type TournamentStore = {
  generateTournamentMatches: (tournamentId: string) => Promise<void>;
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  fetchTournaments: () => Promise<void>;
  createTournament: (name: string, date: string, format: 'KNOCKOUT', playerIds: string[]) => Promise<string | undefined>;
  updateMatchResult: (
    tournamentId: string,
    matchId: string,
    scores: { player1Score: number; player2Score: number; sets?: Set[] }
  ) => Promise<void>;
  getTournamentById: (id: string) => Tournament | undefined;
  getTournamentMatches: (tournamentId: string) => TournamentMatch[];
  updateTournamentStatus: (tournamentId: string, status: Tournament['status']) => Promise<void>;
  setTournamentWinner: (tournamentId: string, winnerId: string) => Promise<void>;
};

// --- Helper Function ---
function shuffleArray<T>(array: T[]): T[] {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}


export const useTournamentStore = create<TournamentStore>((set, get) => ({
  generateTournamentMatches: async (tournamentId: string) => {
    // Stub: implement real logic as needed
    return Promise.resolve();
  },
  // --- Stan początkowy ---
  tournaments: [],
  loading: false,
  error: null, // Upewnij się, że tu jest przecinek, jeśli to nie ostatni element stanu

  // --- Pobieranie Turniejów ---
  fetchTournaments: async () => {
    set({ loading: true, error: null });
    try {
        // Pobierz turnieje
        const { data: tournamentsData, error: tErr } = await supabase
            .from('tournaments')
            .select('*');
        if (tErr) throw tErr;

        // Pobierz uczestników (relacja wiele do wielu)
        const { data: participantsData, error: pErr } = await supabase
            .from('tournament_participants')
            .select('tournament_id, player_id');
        if (pErr) throw pErr;

        // Pobierz wszystkie mecze turniejowe
        const { data: matchesData, error: mErr } = await supabase
            .from('tournament_matches')
            .select('*');
        if (mErr) throw mErr;

        // Grupuj uczestników i mecze według ID turnieju
        const participantsByTournament: Record<string, string[]> = {};
        (participantsData || []).forEach((p: any) => {
            if (!participantsByTournament[p.tournament_id]) {
                participantsByTournament[p.tournament_id] = [];
            }
            participantsByTournament[p.tournament_id].push(p.player_id);
        });

        const matchesByTournament: Record<string, TournamentMatch[]> = {};
(matchesData || []).forEach((m: any) => {
    if (!matchesByTournament[m.tournament_id]) {
        matchesByTournament[m.tournament_id] = [];
    }
    matchesByTournament[m.tournament_id].push({
        id: m.id,
        tournamentId: m.tournament_id,
        round: m.round,
        player1Id: m.player1_id,
        player2Id: m.player2_id,
        winner: m.winner_id ?? null,
        matchId: m.id ?? null,
        status: m.status === 'pending_players' ? 'pending' : m.status,
        player1Score: m.player1_score ?? null,
        player2Score: m.player2_score ?? null,
        nextMatchId: m.next_match_id ?? null,
        sets: m.sets,
    });
});

        // Złóż obiekty turniejów
        const tournaments: Tournament[] = (tournamentsData || []).map((t: any) => {
        const matches = matchesByTournament[t.id] || [];
        return {
          id: t.id,
          name: t.name,
          format: t.format ?? 'KNOCKOUT',
          date: t.date,
          status: t.status,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          participants: participantsByTournament[t.id] || [],
          matches,
          tournamentMatches: matches, // Ensure both are set
          winner: t.winner_id,
        };
      });

      set({ tournaments, loading: false });
    } catch (error: any) {
      console.error("Fetch Tournaments Error:", error);
      set({ loading: false, error: error.message || 'Failed to fetch tournaments' });
    }
  }, // Przecinek po metodzie fetchTournaments

  // --- Tworzenie Turnieju i Generowanie Drabinki ---
  createTournament: async (name: string, date: string, format: 'KNOCKOUT', playerIds: string[]): Promise<string | undefined> => {
    set({ loading: true, error: null });
    let tournamentId: string | undefined = undefined;
    try {
      // 1. Sprawdź liczbę graczy
      if (playerIds.length < 2) {
        throw new Error("Minimum 2 players required");
      }

      // 2. Utwórz turniej w bazie danych
      const { data: tData, error: tErr } = await supabase
        .from('tournaments')
        .insert({ name, date, format, status: 'pending' })
        .select()
        .single();

      if (tErr) throw tErr;
      if (!tData?.id) throw new Error("Failed to retrieve tournament ID after creation."); // Dodatkowe zabezpieczenie

      tournamentId = tData.id; // Teraz wiemy, że to string

      // 3. Dodaj uczestników do tabeli `tournament_participants`
      const participantsRows = playerIds.map(pid => ({
        tournament_id: tournamentId!, // Użycie asercji non-null (!) lub sprawdzenie wyżej
        player_id: pid
      }));
      const { error: pErr } = await supabase.from('tournament_participants').insert(participantsRows);
      if (pErr) {
          await supabase.from('tournaments').delete().eq('id', tournamentId);
          throw pErr;
      }

      // 4. Generowanie drabinki (Single Elimination) - poprawiona logika
      type TournamentMatchInsert = {
        id: string;
        tournament_id: string;
        round: number;
        match_number: number;
        player1_id: string | null;
        player2_id: string | null;
        player1_score: number | null;
        player2_score: number | null;
        winner_id: string | null;
        status: TournamentMatch['status'];
        next_match_id: string | null;
        sets?: Set[];
      };
      const numPlayers = playerIds.length;
      const numRounds = Math.ceil(Math.log2(numPlayers));
      let matchesToInsert: TournamentMatchInsert[] = [];
      let matchIdMatrix: string[][] = [];
      let shuffledPlayers: (string | null)[] = shuffleArray([...playerIds]);
      // --- 1. Pierwsza runda ---
      if (shuffledPlayers.length % 2 !== 0) shuffledPlayers.push(null);
      let firstRoundMatches: string[] = [];
      for (let i = 0; i < shuffledPlayers.length; i += 2) {
        const matchId = uuidv4();
        firstRoundMatches.push(matchId);
        matchesToInsert.push({
          id: matchId,
          tournament_id: tournamentId!,
          round: 1,
          match_number: i/2 + 1,
          player1_id: shuffledPlayers[i],
          player2_id: shuffledPlayers[i+1] ?? null,
          player1_score: null,
          player2_score: null,
          winner_id: null,
          status: (shuffledPlayers[i] && shuffledPlayers[i+1]) ? 'scheduled' : 'completed',
          next_match_id: null,
        });
      }
      matchIdMatrix.push(firstRoundMatches);
      // --- 2. Kolejne rundy ---
      for (let round = 2; round <= numRounds; round++) {
        const prevRoundMatches = matchIdMatrix[round - 2];
        const currRoundMatches: string[] = [];
        for (let i = 0; i < prevRoundMatches.length; i += 2) {
          const matchId = uuidv4();
          currRoundMatches.push(matchId);
          // Ustaw next_match_id dla meczów z poprzedniej rundy
          const match1 = matchesToInsert.find(m => m.id === prevRoundMatches[i]);
          if (match1) match1.next_match_id = matchId;
          if (prevRoundMatches[i+1]) {
            const match2 = matchesToInsert.find(m => m.id === prevRoundMatches[i+1]);
            if (match2) match2.next_match_id = matchId;
          }
          matchesToInsert.push({
            id: matchId,
            tournament_id: tournamentId!,
            round,
            match_number: i/2 + 1,
            player1_id: null,
            player2_id: null,
            player1_score: null,
            player2_score: null,
            winner_id: null,
            status: 'pending',
            next_match_id: null,
          });
        }
        matchIdMatrix.push(currRoundMatches);
      }

      // 5. Wstaw wszystkie wygenerowane mecze do bazy danych
      const { error: mErr } = await supabase.from('tournament_matches').insert(matchesToInsert);
      if (mErr) {
        await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
        await supabase.from('tournaments').delete().eq('id', tournamentId);
        throw mErr;
      }

      // 6. Odśwież listę turniejów w stanie
      await get().fetchTournaments();
      set({ loading: false });
      return tournamentId;

    } catch (error: any) {
      console.error("Create Tournament Error:", error);
      if (tournamentId) {
           await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
           await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
           await supabase.from('tournaments').delete().eq('id', tournamentId);
      }
      set({ loading: false, error: error.message || 'Failed to create tournament' });
      return undefined;
    }
  }, // Przecinek po metodzie createTournament

  // --- Aktualizacja Wyniku Meczu i Przesunięcie Zwycięzcy ---
  updateMatchResult: async (tournamentId: string, matchId: string, scores: { player1Score: number; player2Score: number; sets?: Set[] }) => {
    set({ loading: true, error: null });
    try {
        const currentMatch = get().tournaments.find(t => t.id === tournamentId)
                                ?.matches.find(m => m.id === matchId);

        if (!currentMatch) throw new Error(`Match ${matchId} not found in tournament ${tournamentId}`);
        if (currentMatch.status === 'completed') { console.warn(`Match ${matchId} is already completed.`); set({ loading: false }); return; }
        if (!currentMatch.player1Id || !currentMatch.player2Id) throw new Error(`Match ${matchId} lacks players.`);

        let p1FinalScore = scores.player1Score;
        let p2FinalScore = scores.player2Score;
        if (scores.sets && scores.sets.length > 0) {
            p1FinalScore = 0; p2FinalScore = 0;
            scores.sets.forEach(set => {
                if (set.player1Score > set.player2Score) p1FinalScore++;
                else if (set.player2Score > set.player1Score) p2FinalScore++;
            });
        }

        if(p1FinalScore === p2FinalScore) throw new Error("Match score cannot be a draw in knockout"); // Dodatkowa walidacja

        const winnerId = p1FinalScore > p2FinalScore ? currentMatch.player1Id : currentMatch.player2Id;
        //const loserId = p1FinalScore < p2FinalScore ? currentMatch.player1Id : currentMatch.player2Id;

        const updateData: any = {
            player1_score: scores.player1Score,
            player2_score: scores.player2Score,
            winner_id: winnerId,
            status: 'completed',
        };
        if (scores.sets) updateData.sets = scores.sets;

        const { error: updateErr } = await supabase
            .from('tournament_matches').update(updateData).eq('id', matchId);
        if (updateErr) throw updateErr;

        if (currentMatch.nextMatchId) {
            const nextMatchId = currentMatch.nextMatchId;
            const nextMatch = get().tournaments.find(t => t.id === tournamentId)
                                 ?.matches.find(m => m.id === nextMatchId);

            if (nextMatch) {
                let nextMatchUpdateData: { player1_id?: string, player2_id?: string, status?: TournamentMatch['status'] } = {};
                 if (nextMatch.player1Id === null) nextMatchUpdateData.player1_id = winnerId;
                 else if (nextMatch.player2Id === null) nextMatchUpdateData.player2_id = winnerId;
                 else console.warn(`Next match ${nextMatchId} already has both players.`);

                const newPlayer1Id = nextMatchUpdateData.player1_id ?? nextMatch.player1Id;
                const newPlayer2Id = nextMatchUpdateData.player2_id ?? nextMatch.player2Id;
                if (newPlayer1Id && newPlayer2Id && nextMatch.status === 'pending') { // Check against 'pending'
                    nextMatchUpdateData.status = 'scheduled';
                }

                 if (Object.keys(nextMatchUpdateData).length > 0) {
                     const { error: nextUpdateErr } = await supabase
                         .from('tournament_matches').update(nextMatchUpdateData).eq('id', nextMatchId);
                     if (nextUpdateErr) console.error(`Failed to update next match ${nextMatchId}:`, nextUpdateErr);
                 }
            } else console.warn(`Next match ${nextMatchId} not found in state.`);
        } else {
             const allMatches = get().tournaments.find(t => t.id === tournamentId)?.matches ?? [];
             const isFinal = !allMatches.some(m => m.round > currentMatch.round);
             if(isFinal){
                  await get().setTournamentWinner(tournamentId, winnerId);
             }
        }

        await get().fetchTournaments();

    } catch (error: any) {
      console.error("Update Match Result Error:", error);
      set({ loading: false, error: error.message || 'Failed to update match' });
    }
  }, // Przecinek po metodzie updateMatchResult

  // --- Dodatkowe metody (gettery, settery statusu/zwycięzcy) ---
  getTournamentById: (id: string) => {
    return get().tournaments.find(t => t.id === id);
  },

  // --- SELECTORS ---
  getUpcomingTournaments: () => {
    return get().tournaments.filter(t => t.status === 'pending');
  },
  getActiveTournaments: () => {
    return get().tournaments.filter(t => t.status === 'active');
  },
  getCompletedTournaments: () => {
    return get().tournaments.filter(t => t.status === 'completed');
  },

  getTournamentMatches: (tournamentId: string) => {
    const tournament = get().getTournamentById(tournamentId);
    // Defensive: ensure matches are in the correct format
    if (!tournament || !Array.isArray(tournament.matches)) return [];
    return tournament.matches.map((m: any) => ({
      id: m.id,
      tournamentId: m.tournamentId,
      round: m.round,
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      winner: m.winner ?? null,
      matchId: m.matchId ?? m.id ?? null,
      status: m.status === 'pending_players' ? 'pending' : m.status,
      player1Score: m.player1Score ?? null,
      player2Score: m.player2Score ?? null,
      nextMatchId: m.nextMatchId ?? null,
      sets: m.sets,
    }));
  },

  updateTournamentStatus: async (tournamentId: string, status: Tournament['status']) => {
      set(state => ({
          tournaments: state.tournaments.map(t => t.id === tournamentId ? { ...t, status } : t)
      }));
      const { error } = await supabase.from('tournaments').update({ status }).eq('id', tournamentId);
      if (error) { console.error("DB Status Update Error:", error); get().fetchTournaments(); }
  },

  setTournamentWinner: async (tournamentId: string, winnerId: string) => {
       const tournament = get().getTournamentById(tournamentId);
       const allMatchesCompleted = tournament?.matches.every(m => m.status === 'completed');
       //if (!allMatchesCompleted && (tournament?.matches?.length ?? 0 > 0) ) {
       //     console.warn("Cannot set tournament winner, not all matches completed.");
       //     // Można rzucić błąd lub po prostu nie ustawiać
       //     return;
       //}

      set(state => ({
          tournaments: state.tournaments.map(t => t.id === tournamentId ? { ...t, winner: winnerId, status: 'completed' } : t)
      }));
      const { error } = await supabase.from('tournaments').update({ winner_id: winnerId, status: 'completed' }).eq('id', tournamentId);
      if (error) { console.error("DB Winner Update Error:", error); get().fetchTournaments(); }
  }, // Przecinek dodany po metodzie setTournamentWinner

})); // Zamknięcie create

// --- REALTIME HOOK ---
import { useEffect } from "react";

export function useTournamentsRealtime() {
  useEffect(() => {
    const channel = supabase
      .channel('tournaments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => {
          // Fetch latest tournaments on any change
          if (typeof useTournamentStore.getState().fetchTournaments === 'function') {
            useTournamentStore.getState().fetchTournaments();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}