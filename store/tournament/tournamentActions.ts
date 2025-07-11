/**
 * @fileoverview Defines actions for the tournament store.
 * These functions are responsible for asynchronous operations like fetching data
 * from Supabase, interacting with other stores, and then updating the tournament state
 * using the provided `set` and `get` functions from Zustand.
 */
import { supabase } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type { StateCreator } from 'zustand';
import type {
    TournamentStoreState,
    Tournament,
    TournamentMatch,
    MatchSet,
    TournamentFormat,
    TournamentStatus,
    FullTournamentStore,
    TournamentStoreActions,
    TournamentStoreGetters
} from './tournamentTypes';
import {
    transformMatchData,
    shuffleArray,
    generateRoundRobinSchedule,
    generateGroups,
    generateGroupMatches,
    getTopPlayersFromGroups,
    generateKnockoutPhase,
    autoSelectRoundRobinWinner,
} from './tournamentLogic';
import { useMatchStore } from '../matchStore';
import { usePlayerStore } from '../playerStore';
import type { TournamentWonMetadata } from '@/backend/server/trpc/services/notificationService';
import { dispatchSystemNotification } from '@/backend/server/trpc/services/notificationService';

const FETCH_INTERVAL = 1500; // 1.5 seconds

/**
 * Helper function to add a completed tournament match to the global match history.
 * @param {TournamentMatch} match - The tournament match that was completed.
 * @param {{ player1Score: number; player2Score: number; sets?: MatchSet[] }} scores - The scores of the match.
 * @param {string} tournamentId - The ID of the tournament this match belongs to.
 */
const _addTournamentMatchToHistory = async (
    match: TournamentMatch,
    scores: { player1Score: number; player2Score: number; sets?: MatchSet[] },
    tournamentId: string
): Promise<void> => {
    const { addMatch: addGlobalMatch } = useMatchStore.getState();
    if (match.player1Id && match.player2Id) {
        await addGlobalMatch(
            match.player1Id,
            match.player2Id,
            scores.player1Score, // These are overall set scores (e.g., 3-1)
            scores.player2Score,
            scores.sets || [],   // Detailed set scores (e.g., [{11-5}, {5-11}])
            tournamentId
        );
    }
};

/**
 * Creates the actions slice for the tournament store.
 * These actions handle asynchronous operations, data fetching,
 * and state mutations related to tournaments and matches.
 *
 * @param set - Zustand's `set` function, wrapped by Immer for direct state mutation.
 * @param get - Zustand's `get` function to access current state or other actions/getters.
 * @returns {TournamentStoreActions} An object containing all action functions.
 */
export const createTournamentActions: StateCreator<
    FullTournamentStore,
    [["zustand/immer", never], never],
    [],
    TournamentStoreActions
> = (set, get) => ({
    fetchTournaments: async (options?: { force?: boolean }) => {
        if (get().loading && !options?.force) {
            return;
        }

        const lastFetchTimestamp = get().lastFetchTimestamp;
        const now = Date.now();

        if (!options?.force && lastFetchTimestamp && (now - lastFetchTimestamp < FETCH_INTERVAL)) {
            return;
        }

        set(state => {
            state.loading = true;
            state.error = null;
        });

        try {
            const { data: rawTournaments, error } = await supabase
                .from('tournaments')
                .select(`
                    id, name, date, format, status, winner_id, created_at, updated_at,
                    tournament_participants ( player_id ),
                    tournament_matches ( * )
                `)
                .order('date', { ascending: false });

            if (error) throw error;

            if (!rawTournaments) {
                set(state => {
                    state.tournaments = [];
                    state.loading = false;
                    state.error = 'No tournaments data returned';
                    state.lastFetchTimestamp = Date.now();
                });
                return;
            }

            const processedTournaments = rawTournaments.map(t => {
                const participantsData = Array.isArray(t.tournament_participants) ? t.tournament_participants : [];
                const matchesData = Array.isArray(t.tournament_matches) ? t.tournament_matches : [];

                return {
                    id: t.id,
                    name: t.name,
                    date: t.date,
                    format: t.format as TournamentFormat,
                    status: t.status as TournamentStatus,
                    participants: participantsData.map((p: any) => p.player_id),
                    matches: matchesData.map((m: any) => ({
                        ...transformMatchData(m), // Use the logic function
                        isUpdating: false, // Client-side state for UI
                    })).sort((a,b) => (a.round - b.round) || (a.matchNumber - b.matchNumber)),
                    winner: t.winner_id,
                    createdAt: t.created_at,
                    updatedAt: t.updated_at,
                } as Tournament; // Ensure type compatibility
            });

            // Sort tournaments by status then date
            processedTournaments.sort((a, b) => {
                const statusOrder: Record<TournamentStatus, number> = {
                    [TournamentStatus.ACTIVE]: 1,
                    [TournamentStatus.UPCOMING]: 2,
                    [TournamentStatus.PENDING]: 2, // Treat pending same as upcoming for sort
                    [TournamentStatus.COMPLETED]: 3,
                    [TournamentStatus.CANCELLED]: 4,
                };
                if (statusOrder[a.status] !== statusOrder[b.status]) {
                    return statusOrder[a.status] - statusOrder[b.status];
                }
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });

            set(state => {
                state.tournaments = processedTournaments;
                state.loading = false;
                state.lastFetchTimestamp = Date.now();
            });

        } catch (error: any) {
            set(state => {
                state.error = `Failed to fetch tournaments: ${error.message}`;
                state.loading = false;
            });
        }
    },

    createTournament: async (name: string, date: string, format: TournamentFormat, playerIds: string[]): Promise<string | undefined> => {
        set(state => { state.loading = true; state.error = null; });
        let tournamentId: string | undefined = undefined;

        try {
            if (playerIds.length < 2) {
                throw new Error("Minimum 2 players required for a tournament.");
            }
            // Basic validation for knockout, other formats might have own rules
            if (format === TournamentFormat.KNOCKOUT && playerIds.length < 2) { // Or playerIds.length % 2 !== 0 for stricter knockout
                // The original code had playerIds.length % 4 !== 0, which is very restrictive.
                // Adjusted to a more common requirement, or this can be removed if byes handle it.
                // For now, let's keep it simple. More complex validation can be added.
                // throw new Error("Knockout tournaments require an even number of players (or specific numbers for byes).");
            }


            let finalName = name?.trim();
            if (!finalName) {
                const { data: existingTournaments, error: fetchErr } = await supabase
                    .from('tournaments')
                    .select('name')
                    .ilike('name', 'Tournament %');

                if (fetchErr) {
                    console.warn("Failed to fetch existing tournament names for auto-naming:", fetchErr);
                    finalName = "Tournament 1";
                } else {
                    let maxNumber = 0;
                    existingTournaments?.forEach(t => {
                        const match = t.name.match(/Tournament (\d+)/);
                        if (match && match[1]) {
                            const num = parseInt(match[1], 10);
                            if (!isNaN(num) && num > maxNumber) maxNumber = num;
                        }
                    });
                    finalName = `Tournament ${maxNumber + 1}`;
                }
            }

            const { data: tData, error: tErr } = await supabase
                .from('tournaments')
                .insert({ name: finalName, date, format, status: TournamentStatus.PENDING })
                .select()
                .single();

            if (tErr) throw tErr;
            if (!tData?.id) throw new Error("Failed to retrieve tournament ID after creation.");
            tournamentId = tData.id;

            const participantsRows = playerIds.map(pid => ({ tournament_id: tournamentId!, player_id: pid }));
            const { error: pErr } = await supabase.from('tournament_participants').insert(participantsRows);

            if (pErr) {
                // Rollback tournament creation if participants fail
                await supabase.from('tournaments').delete().eq('id', tournamentId);
                throw pErr;
            }

            await get().fetchTournaments({ force: true }); // Refresh list
            set(state => { state.loading = false; });
            return tournamentId;

        } catch (error: any) {
            if (tournamentId) { // Attempt rollback if ID was generated
                await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
                await supabase.from('tournaments').delete().eq('id', tournamentId);
            }
            set(state => {
                state.loading = false;
                state.error = error.message || 'Failed to create tournament';
            });
            return undefined;
        }
    },

    generateAndStartTournament: async (tournamentId: string) => {
        set(state => { state.loading = true; state.error = null; });
        let generatedMatchesInserted = false;

        try {
            const tournament = get().getTournamentById(tournamentId);
            if (!tournament) throw new Error(`Tournament ${tournamentId} not found.`);
            if (tournament.status !== TournamentStatus.PENDING) throw new Error(`Tournament ${tournamentId} is not in pending state.`);

            const { data: participantsData, error: pFetchErr } = await supabase
                .from('tournament_participants')
                .select('player_id')
                .eq('tournament_id', tournamentId);

            if (pFetchErr) throw pFetchErr;
            const playerIds = participantsData?.map(p => p.player_id) || [];
            if (playerIds.length < 2) throw new Error("Not enough participants for this tournament.");

            let matchesToInsertDb: any[] = []; // Matches to be inserted into DB

            if (tournament.format === TournamentFormat.ROUND_ROBIN) {
                const schedule = generateRoundRobinSchedule(playerIds);
                matchesToInsertDb = schedule.map((match, index) => ({
                    id: uuidv4(),
                    tournament_id: tournamentId,
                    round: 1, // Round robin is typically a single "round" or stage
                    match_number: index + 1,
                    player1_id: match.player1Id,
                    player2_id: match.player2Id,
                    status: 'scheduled',
                }));
            } else if (tournament.format === TournamentFormat.GROUP) {
                // Example: Max 4 groups, aim for at least 3 players per group if possible
                const numGroups = Math.min(4, Math.max(1, Math.ceil(playerIds.length / 3)));
                const groups = generateGroups(playerIds, numGroups);
                const groupMatches = generateGroupMatches(groups); // tournamentId not needed here
                matchesToInsertDb = groupMatches.map((match, index) => ({
                    id: uuidv4(),
                    tournament_id: tournamentId,
                    round: 1, // Group stage matches
                    match_number: index + 1,
                    player1_id: match.player1Id,
                    player2_id: match.player2Id,
                    group: match.group,
                    status: 'scheduled',
                }));
            } else if (tournament.format === TournamentFormat.KNOCKOUT) {
                // Direct knockout
                const knockoutMatches = await generateKnockoutPhase(tournamentId, playerIds, 1); // Starting round 1
                // generateKnockoutPhase already inserts, so we just need to update status
                // This is a bit inconsistent, ideally generateKnockoutPhase returns matches to insert
                // For now, if it inserts, matchesToInsertDb can remain empty here for the check below
                generatedMatchesInserted = knockoutMatches.length > 0;
            }

            if (matchesToInsertDb.length > 0) {
                const { error: mErr } = await supabase.from('tournament_matches').insert(matchesToInsertDb);
                if (mErr) throw mErr;
                generatedMatchesInserted = true;
            }

            if (generatedMatchesInserted || tournament.format === TournamentFormat.KNOCKOUT) { // Knockout might insert within its logic
                 const { error: statusErr } = await supabase
                    .from('tournaments')
                    .update({ status: TournamentStatus.ACTIVE })
                    .eq('id', tournamentId);
                if (statusErr) throw statusErr;
            } else if (matchesToInsertDb.length === 0 && tournament.format !== TournamentFormat.KNOCKOUT) {
                // Only throw if no matches were generated for formats that should produce them here
                throw new Error("No matches were generated for the tournament.");
            }


            await get().fetchTournaments({ force: true });
            set(state => { state.loading = false; });

        } catch (error: any) {
            if (generatedMatchesInserted) { // Attempt to clean up matches if start failed after insertion
                await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
            }
            set(state => {
                state.loading = false;
                state.error = error.message || 'Failed to generate and start tournament';
            });
        }
    },

    generateTournamentMatches: async (tournamentId: string) => {
        // This action is specifically for generating knockout phase matches after a group stage.
        set(state => { state.loading = true; state.error = null; });
        try {
            const tournament = get().getTournamentById(tournamentId);
            if (!tournament) throw new Error('Tournament not found');
            if (tournament.format !== TournamentFormat.GROUP) {
                throw new Error('This function is only for generating knockout matches for Group tournaments.');
            }
            if (tournament.status !== TournamentStatus.ACTIVE && tournament.status !== TournamentStatus.COMPLETED) { // Or some other status indicating group phase is done
                 // Allow generating if group stage is "completed" but overall tournament not yet
            }

            const groupMatches = get().getTournamentMatches(tournamentId).filter(m => m.round === 1 && m.status === 'completed');
            if (groupMatches.length === 0 && tournament.matches.filter(m => m.round === 1).some(m => m.status !== 'completed')) {
                throw new Error("Not all group matches are completed yet.");
            }

            const { data: participantsData, error: pErr } = await supabase
                .from('tournament_participants')
                .select('player_id')
                .eq('tournament_id', tournamentId);
            if (pErr) throw pErr;

            // Reconstruct groups based on participants and completed group matches
            // This part of logic might need to be more robust, relying on how groups were initially formed
            // For simplicity, assuming groups can be derived from existing match data or participants
             const distinctGroupNumbers = Array.from(new Set(tournament.matches.filter(m => m.round === 1 && m.group != null).map(m => m.group!)));
             const groupsAsPlayerIds: string[][] = distinctGroupNumbers.map(groupNum => {
                 const playerIdsInGroup = new Set<string>();
                 tournament.matches.forEach(m => {
                     if (m.group === groupNum) {
                         if(m.player1Id) playerIdsInGroup.add(m.player1Id);
                         if(m.player2Id) playerIdsInGroup.add(m.player2Id);
                     }
                 });
                 return Array.from(playerIdsInGroup);
             });


            const qualifiedPlayers = getTopPlayersFromGroups(groupsAsPlayerIds, groupMatches);
            if (qualifiedPlayers.length === 0 && groupsAsPlayerIds.length > 0) {
                 throw new Error("No players qualified from the group stage, or groups were empty.");
            }
             if (qualifiedPlayers.length < 2 && qualifiedPlayers.length > 0) { // Only one qualifier
                await get().setTournamentWinner(tournamentId, qualifiedPlayers[0]);
                set(state => { state.loading = false; });
                return; // Early exit, tournament ends
            }
            if (qualifiedPlayers.length === 0) { // No one qualified, maybe all matches were draws or no matches
                 set(state => {
                    state.loading = false;
                    state.error = "No players qualified from group stage.";
                });
                return;
            }


            await generateKnockoutPhase(tournamentId, qualifiedPlayers, 2); // Knockout starts at round 2

            await get().fetchTournaments({ force: true });
            set(state => { state.loading = false; });

        } catch (error: any) {
            console.error('Generate Tournament Matches (Knockout Phase) Error:', error);
            set(state => {
                state.loading = false;
                state.error = error.message || 'Failed to generate knockout phase matches';
            });
        }
    },

    updateMatchResult: async (tournamentId: string, matchId: string, scores: { player1Score: number; player2Score: number; sets?: MatchSet[] }) => {
        const originalTournaments = JSON.parse(JSON.stringify(get().tournaments)); // Deep copy for rollback
        const tournament = get().getTournamentById(tournamentId);
        const match = tournament?.matches.find(m => m.id === matchId);

        if (!tournament || !match) {
            set(state => { state.error = "Tournament or match not found for update."; });
            return;
        }
        if (!match.player1Id || !match.player2Id) {
             set(state => { state.error = "Match players not defined."; });
            return;
        }


        set(state => {
            const tourney = state.tournaments.find(t => t.id === tournamentId);
            if (tourney) {
                const m = tourney.matches.find(mx => mx.id === matchId);
                if (m) m.isUpdating = true;
            }
        });

        try {
            // Calculate winner based on sets if available, otherwise direct scores
            let p1FinalSetScore = 0;
            let p2FinalSetScore = 0;

            if (scores.sets && scores.sets.length > 0) {
                scores.sets.forEach(set => {
                    if (set.player1Score > set.player2Score) p1FinalSetScore++;
                    else if (set.player2Score > set.player1Score) p2FinalSetScore++;
                });
            } else { // Fallback to direct scores if no sets provided (e.g. simple score reporting)
                p1FinalSetScore = scores.player1Score;
                p2FinalSetScore = scores.player2Score;
            }

            if (p1FinalSetScore === p2FinalSetScore) throw new Error("Match score cannot be a draw based on sets/scores provided.");
            const winnerId = p1FinalSetScore > p2FinalSetScore ? match.player1Id : match.player2Id;

            const matchUpdateData = {
                player1_score: scores.player1Score, // These are the summary scores (e.g. total games won)
                player2_score: scores.player2Score,
                winner_id: winnerId,
                status: 'completed' as TournamentMatch['status'],
                sets: scores.sets, // Detailed set scores
            };

            const { error: updateErr } = await supabase.from('tournament_matches').update(matchUpdateData).eq('id', matchId);
            if (updateErr) throw updateErr;

            // Add to global match history
            await _addTournamentMatchToHistory(match, scores, tournamentId);

            // Check if this was the final match of a knockout stage or round robin
            const currentTournament = get().getTournamentById(tournamentId); // Get fresh tournament data
            if (!currentTournament) throw new Error("Failed to fetch tournament after match update.");

            const allMatches = currentTournament.matches.map(m => m.id === matchId ? {...m, ...matchUpdateData, winner: winnerId, status: 'completed'} : m);
            const allMatchesCompleted = allMatches.every(m => m.status === 'completed');

            if (match.nextMatchId) {
                 const nextMatch = currentTournament.matches.find(m => m.id === match.nextMatchId);
                 if (nextMatch && winnerId) {
                    const nextMatchUpdatePayload: Partial<TournamentMatch> = {};
                    let newStatus: TournamentMatch['status'] | undefined = nextMatch.status;

                    if (nextMatch.player1Id === null) {
                        nextMatchUpdatePayload.player1Id = winnerId;
                    } else if (nextMatch.player2Id === null) {
                        nextMatchUpdatePayload.player2Id = winnerId;
                    }
                    // If both players are now set for the next match, change status to 'scheduled'
                    if ((nextMatchUpdatePayload.player1Id || nextMatch.player1Id) && (nextMatchUpdatePayload.player2Id || nextMatch.player2Id)) {
                         newStatus = 'scheduled';
                    }
                     if(newStatus !== nextMatch.status) nextMatchUpdatePayload.status = newStatus;


                    if (Object.keys(nextMatchUpdatePayload).length > 0) {
                        await supabase.from('tournament_matches').update({
                            player1_id: nextMatchUpdatePayload.player1Id, // map to DB columns
                            player2_id: nextMatchUpdatePayload.player2Id,
                            status: nextMatchUpdatePayload.status,
                        }).eq('id', match.nextMatchId);
                    }
                 }
            } else if (allMatchesCompleted) { // No next match ID implies it could be a final match or end of a stage
                if (currentTournament.format === TournamentFormat.KNOCKOUT || (currentTournament.format === TournamentFormat.GROUP && currentTournament.matches.some(m => m.round > 1))) {
                    // If it's a knockout tournament, or group tournament in knockout phase, the winner of this match is the tournament winner
                    if (winnerId) await get().setTournamentWinner(tournamentId, winnerId);
                } else if (currentTournament.format === TournamentFormat.ROUND_ROBIN) {
                    const playerIds = currentTournament.participants;
                    await autoSelectRoundRobinWinner(tournamentId, allMatches, playerIds, currentTournament.name);
                } else if (currentTournament.format === TournamentFormat.GROUP && allMatches.filter(m => m.round === 1).every(m => m.status === 'completed')) {
                    // All group matches completed, try to generate next phase
                    await get().generateTournamentMatches(tournamentId);
                }
            }

            await get().fetchTournaments({ force: true }); // Refresh all data

        } catch (error: any) {
            set(state => {
                state.tournaments = originalTournaments; // Rollback optimistic update
                state.error = error.message || 'Failed to update match result';
            });
        } finally {
            set(state => {
                const tourney = state.tournaments.find(t => t.id === tournamentId);
                if (tourney) {
                    const m = tourney.matches.find(mx => mx.id === matchId);
                    if (m) m.isUpdating = false;
                }
            });
        }
    },

    updateTournamentStatus: async (tournamentId: string, status: TournamentStatus) => {
        const originalStatus = get().getTournamentById(tournamentId)?.status;
        set(state => {
            const tournament = state.tournaments.find(t => t.id === tournamentId);
            if (tournament) tournament.status = status;
        });
        try {
            const { error } = await supabase.from('tournaments').update({ status }).eq('id', tournamentId);
            if (error) throw error;
            await get().fetchTournaments({force: true}); // Ensure local state is consistent
        } catch (error: any) {
            set(state => {
                const tournament = state.tournaments.find(t => t.id === tournamentId);
                if (tournament && originalStatus) tournament.status = originalStatus; // Rollback
                state.error = `Failed to update tournament status: ${error.message}`;
            });
        }
    },

    setTournamentWinner: async (tournamentId: string, winnerId: string) => {
        if (!winnerId) {
            console.error('No winnerId provided to setTournamentWinner');
            set(state => { state.error = 'Winner ID is required.'; });
            return;
        }
        set(state => { state.loading = true; state.error = null; });
        const tournament = get().getTournamentById(tournamentId);

        try {
            const { error } = await supabase.from('tournaments').update({
                winner_id: winnerId,
                status: TournamentStatus.COMPLETED
            }).eq('id', tournamentId);

            if (error) throw error;

            if (tournament) {
                const playerStore = usePlayerStore.getState();
                const winnerPlayer = playerStore.getPlayerById(winnerId);
                if (winnerPlayer) {
                    const metadata: TournamentWonMetadata = {
                        notification_type: 'tournament_won',
                        winnerNickname: winnerPlayer.nickname || 'Unknown Player',
                        tournamentName: tournament.name,
                        tournamentId: tournament.id,
                    };
                    await dispatchSystemNotification('tournament_won', metadata);
                }
            }

            // Optimistically update local state before refetch for faster UI response
            set(state => {
                const T = state.tournaments.find(t => t.id === tournamentId);
                if(T) {
                    T.winner = winnerId;
                    T.status = TournamentStatus.COMPLETED;
                }
            });

            await get().fetchTournaments({ force: true }); // Refresh to ensure consistency
            set(state => { state.loading = false; });

        } catch (error: any) {
            set(state => {
                state.error = error.message || "Failed to set tournament winner";
                state.loading = false;
                // Potentially rollback optimistic update if fetchTournaments doesn't overwrite it correctly
                const T = state.tournaments.find(t => t.id === tournamentId);
                if(T && tournament) { // If original tournament data was fetched
                    T.winner = tournament.winner;
                    T.status = tournament.status;
                }
            });
        }
    },
    // Placeholder for handleTournamentUpdate and handleMatchUpdate, will be moved to realtime.ts
    // For now, these are not part of the actions created by this StateCreator
    handleTournamentUpdate: () => { console.warn("handleTournamentUpdate called from actions stub");},
    handleMatchUpdate: () => { console.warn("handleMatchUpdate called from actions stub");},

});
