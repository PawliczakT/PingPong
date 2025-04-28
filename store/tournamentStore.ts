import {create} from 'zustand';
import {supabase} from '@/lib/supabase';
import {v4 as uuidv4} from 'uuid';
import {Set, Tournament, TournamentMatch, TournamentStatus} from '@/types';
import {useEffect} from "react";

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
    generateAndStartTournament: (tournamentId: string) => Promise<void>;
    getUpcomingTournaments: () => Tournament[];
    getActiveTournaments: () => Tournament[];
    getCompletedTournaments: () => Tournament[];
};

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
        return Promise.resolve();
    },
    tournaments: [],
    loading: false,
    error: null,

    fetchTournaments: async () => {
        set({loading: true, error: null});
        try {
            const {data: tournamentsData, error: tErr} = await supabase
                .from('tournaments')
                .select('*');
            if (tErr) throw tErr;

            const {data: participantsData, error: pErr} = await supabase
                .from('tournament_participants')
                .select('tournament_id, player_id');
            if (pErr) throw pErr;

            const {data: matchesData, error: mErr} = await supabase
                .from('tournament_matches')
                .select('*');
            if (mErr) throw mErr;

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
                    tournamentMatches: matches,
                    winner: t.winner_id,
                };
            });

            set({tournaments, loading: false});
        } catch (error: any) {
            console.error("Fetch Tournaments Error:", error);
            set({loading: false, error: error.message || 'Failed to fetch tournaments'});
        }
    },

    createTournament: async (name: string, date: string, format: 'KNOCKOUT', playerIds: string[]): Promise<string | undefined> => {
        set({loading: true, error: null});
        let tournamentId: string | undefined = undefined;
        try {
            if (playerIds.length < 2) {
                throw new Error("Minimum 2 players required");
            }

            const {data: tData, error: tErr} = await supabase
                .from('tournaments')
                .insert({name, date, format, status: 'pending'})
                .select()
                .single();

            if (tErr) throw tErr;
            if (!tData?.id) throw new Error("Failed to retrieve tournament ID after creation.");

            tournamentId = tData.id;

            const participantsRows = playerIds.map(pid => ({
                tournament_id: tournamentId!,
                player_id: pid
            }));
            const {error: pErr} = await supabase.from('tournament_participants').insert(participantsRows);
            if (pErr) {
                await supabase.from('tournaments').delete().eq('id', tournamentId);
                throw pErr;
            }

            await get().fetchTournaments();
            set({loading: false});
            return tournamentId;

        } catch (error: any) {
            console.error("Create Tournament Error:", error);
            if (tournamentId) {
                await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
                await supabase.from('tournaments').delete().eq('id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to create tournament'});
            return undefined;
        }
    },

    generateAndStartTournament: async (tournamentId: string) => {
        set({loading: true, error: null});
        let generatedMatchesInserted = false;

        try {
            const existingTournament = get().tournaments.find(t => t.id === tournamentId);
            if (!existingTournament) throw new Error(`Tournament ${tournamentId} not found.`);
            if (existingTournament.status !== 'pending') throw new Error(`Tournament ${tournamentId} is not in pending state.`);

            const {data: participantsData, error: pFetchErr} = await supabase
                .from('tournament_participants')
                .select('player_id')
                .eq('tournament_id', tournamentId);

            if (pFetchErr) throw pFetchErr;
            if (!participantsData || participantsData.length < 2) {
                throw new Error("Not enough participants found for this tournament.");
            }
            const playerIds = participantsData.map(p => p.player_id);

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

            if (shuffledPlayers.length % 2 !== 0) shuffledPlayers.push(null);
            let firstRoundMatches: string[] = [];
            for (let i = 0; i < shuffledPlayers.length; i += 2) {
                const matchId = uuidv4();
                firstRoundMatches.push(matchId);
                const p1 = shuffledPlayers[i];
                const p2 = shuffledPlayers[i + 1] ?? null;
                let status: TournamentMatch['status'] = 'pending';
                let winner = null;

                if (p1 && p2) {
                    status = 'scheduled';
                } else if (p1 && !p2) {
                    status = 'completed';
                    winner = p1;
                } else if (!p1 && p2) {
                    status = 'completed';
                    winner = p2;
                } else {
                    status = 'pending';
                }

                matchesToInsert.push({
                    id: matchId,
                    tournament_id: tournamentId,
                    round: 1,
                    match_number: i / 2 + 1,
                    player1_id: p1,
                    player2_id: p2,
                    player1_score: winner === p1 ? 1 : null,
                    player2_score: winner === p2 ? 1 : null,
                    winner_id: winner,
                    status: status,
                    next_match_id: null,
                });
            }
            matchIdMatrix.push(firstRoundMatches);

            for (let round = 2; round <= numRounds; round++) {
                const prevRoundMatches = matchIdMatrix[round - 2];
                const currRoundMatches: string[] = [];
                for (let i = 0; i < prevRoundMatches.length; i += 2) {
                    const matchId = uuidv4();
                    currRoundMatches.push(matchId);

                    const match1 = matchesToInsert.find(m => m.id === prevRoundMatches[i]);
                    if (match1) match1.next_match_id = matchId;
                    if (prevRoundMatches[i + 1]) {
                        const match2 = matchesToInsert.find(m => m.id === prevRoundMatches[i + 1]);
                        if (match2) match2.next_match_id = matchId;
                    }

                    matchesToInsert.push({
                        id: matchId,
                        tournament_id: tournamentId,
                        round,
                        match_number: i / 2 + 1,
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

            const {error: mErr} = await supabase.from('tournament_matches').insert(matchesToInsert);
            if (mErr) throw mErr;
            generatedMatchesInserted = true;

            const {error: statusErr} = await supabase
                .from('tournaments')
                .update({status: 'active'})
                .eq('id', tournamentId);
            if (statusErr) throw statusErr;

            await get().fetchTournaments();
            set({loading: false});

        } catch (error: any) {
            console.error("Generate and Start Tournament Error:", error);
            if (generatedMatchesInserted) {
                await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to start tournament'});
        }
    },

    updateMatchResult: async (tournamentId: string, matchId: string, scores: {
        player1Score: number;
        player2Score: number;
        sets?: Set[]
    }) => {
        set({loading: true, error: null});
        try {
            const currentMatch = get().tournaments.find(t => t.id === tournamentId)
                ?.matches.find(m => m.id === matchId);

            if (!currentMatch) throw new Error(`Match ${matchId} not found in tournament ${tournamentId}`);
            if (currentMatch.status === 'completed') {
                console.warn(`Match ${matchId} is already completed.`);
                set({loading: false});
                return;
            }
            if (!currentMatch.player1Id || !currentMatch.player2Id) throw new Error(`Match ${matchId} lacks players.`);

            let p1FinalScore = scores.player1Score;
            let p2FinalScore = scores.player2Score;
            if (scores.sets && scores.sets.length > 0) {
                p1FinalScore = 0;
                p2FinalScore = 0;
                scores.sets.forEach(set => {
                    if (set.player1Score > set.player2Score) p1FinalScore++;
                    else if (set.player2Score > set.player1Score) p2FinalScore++;
                });
            }

            if (p1FinalScore === p2FinalScore) throw new Error("Match score cannot be a draw in knockout");

            const winnerId = p1FinalScore > p2FinalScore ? currentMatch.player1Id : currentMatch.player2Id;

            const updateData = {
                player1_score: scores.player1Score,
                player2_score: scores.player2Score,
                winner_id: winnerId,
                status: 'completed',
                sets: scores.sets || undefined
            };

            const {error: updateErr} = await supabase
                .from('tournament_matches').update(updateData).eq('id', matchId);
            if (updateErr) throw updateErr;

            if (currentMatch.nextMatchId) {
                const nextMatchId = currentMatch.nextMatchId;
                const nextMatch = get().tournaments.find(t => t.id === tournamentId)
                    ?.matches.find(m => m.id === nextMatchId);

                if (nextMatch) {
                    const updateData: {
                        player1_id?: string;
                        player2_id?: string;
                        status?: TournamentMatch['status'];
                    } = {};

                    if (nextMatch.player1Id === null) {
                        updateData.player1_id = winnerId;
                    } else if (nextMatch.player2Id === null) {
                        updateData.player2_id = winnerId;
                    }

                    if ((updateData.player1_id || nextMatch.player1Id) &&
                        (updateData.player2_id || nextMatch.player2Id)) {
                        updateData.status = 'scheduled';
                    }

                    if (Object.keys(updateData).length > 0) {
                        await supabase.from('tournament_matches').update(updateData).eq('id', nextMatchId);
                    }
                }
            } else {
                await get().setTournamentWinner(tournamentId, winnerId);
            }

            await get().fetchTournaments();

        } catch (error: any) {
            console.error("Update Match Result Error:", error);
            set({loading: false, error: error.message || 'Failed to update match'});
        }
    },

    getTournamentById: (id: string) => {
        return get().tournaments.find(t => t.id === id);
    },

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
            tournaments: state.tournaments.map(t => t.id === tournamentId ? {...t, status} : t)
        }));
        const {error} = await supabase.from('tournaments').update({status}).eq('id', tournamentId);
        if (error) {
            console.error("DB Status Update Error:", error);
            get().fetchTournaments();
        }
    },

    setTournamentWinner: async (tournamentId: string, winnerId: string) => {
        if (!winnerId) {
            console.warn("Cannot set tournament winner - no winner ID provided");
            return;
        }

        try {
            set(state => ({
                tournaments: state.tournaments.map(t =>
                    t.id === tournamentId ? {
                        ...t,
                        winner: winnerId,
                        status: TournamentStatus.COMPLETED
                    } : t
                )
            }));

            set({loading: true});
            const {error} = await supabase.from('tournaments').update({
                winner_id: winnerId,
                status: TournamentStatus.COMPLETED
            }).eq('id', tournamentId);

            if (error) throw error;
        } catch (error: any) {
            console.error("Failed to set tournament winner:", error);
            set({error: error.message || "Failed to set winner"});
            await get().fetchTournaments();
        } finally {
            set({loading: false});
        }
    },
}));

export function useTournamentsRealtime() {
    useEffect(() => {
        const channel = supabase
            .channel('tournaments-changes')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'tournaments'},
                () => {
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
