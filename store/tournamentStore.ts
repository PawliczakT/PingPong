import {create} from 'zustand';
import {supabase} from '@/lib/supabase';
import {v4 as uuidv4} from 'uuid';
import type {Set as MatchSet} from '@/types';
import {Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/types';
import {useEffect} from "react";

type TournamentStore = {
    generateTournamentMatches: (tournamentId: string) => Promise<void>;
    tournaments: Tournament[];
    loading: boolean;
    error: string | null;
    lastFetchTimestamp: number | null;
    fetchTournaments: (options?: { force?: boolean }) => Promise<void>;
    createTournament: (name: string, date: string, format: TournamentFormat, playerIds: string[]) => Promise<string | undefined>;
    updateMatchResult: (tournamentId: string, matchId: string, scores: { player1Score: number; player2Score: number; sets?: MatchSet[] }) => Promise<void>;
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

function generateRoundRobinSchedule(playerIds: string[]): { player1Id: string, player2Id: string }[] {
    const schedule: { player1Id: string, player2Id: string }[] = [];
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            // Only one match for each pair of players
            schedule.push({player1Id: playerIds[i], player2Id: playerIds[j]});
        }
    }
    return schedule;
}

function generateGroups(playerIds: string[], numGroups: number): string[][] {
    const shuffledPlayers = shuffleArray([...playerIds]);
    const groups: string[][] = Array.from({length: numGroups}, () => []);

    shuffledPlayers.forEach((playerId, index) => {
        const groupIndex = index % numGroups;
        groups[groupIndex].push(playerId);
    });

    return groups;
}

function generateGroupMatches(tournamentId: string, groups: string[][]): {
    player1Id: string,
    player2Id: string,
    group: number
}[] {
    const matches: { player1Id: string, player2Id: string, group: number }[] = [];

    groups.forEach((group, groupIndex) => {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                matches.push({
                    player1Id: group[i],
                    player2Id: group[j],
                    group: groupIndex + 1 // Groups are 1-indexed
                });
            }
        }
    });

    return matches;
}

function getTopPlayersFromGroups(groups: string[][], matches: TournamentMatch[]): string[] {
    const qualifiers: string[] = [];

    groups.forEach((group, groupIndex) => {
        const groupMatches = matches.filter(m => m.group === groupIndex + 1 && m.status === 'completed');
        const playerStats: Record<string, { played: number, wins: number, points: number, pointsDiff: number }> = {};

        group.forEach(playerId => {
            playerStats[playerId] = {played: 0, wins: 0, points: 0, pointsDiff: 0};
        });

        groupMatches.forEach(match => {
            if (!match.player1Id || !match.player2Id || match.player1Score === null || match.player2Score === null) return;

            const p1 = match.player1Id;
            const p2 = match.player2Id;

            playerStats[p1].played++;
            playerStats[p2].played++;
            playerStats[p1].points += match.player1Score;
            playerStats[p2].points += match.player2Score;
            playerStats[p1].pointsDiff += match.player1Score - match.player2Score;
            playerStats[p2].pointsDiff += match.player2Score - match.player1Score;

            if (match.player1Score > match.player2Score) {
                playerStats[p1].wins++;
            } else {
                playerStats[p2].wins++;
            }
        });

        const sortedPlayers = group.sort((a, b) => {
            const statsA = playerStats[a];
            const statsB = playerStats[b];

            if (statsA.wins !== statsB.wins) return statsB.wins - statsA.wins;
            if (statsA.pointsDiff !== statsB.pointsDiff) return statsB.pointsDiff - statsA.pointsDiff;
            return statsB.points - statsA.points;
        });

        if (sortedPlayers.length > 0) {
            qualifiers.push(sortedPlayers[0]);
        }
    });

    return qualifiers;
}

async function generateKnockoutPhase(tournamentId: string, qualifiedPlayers: string[]): Promise<void> {
    const numPlayers = qualifiedPlayers.length;
    const numRounds = Math.ceil(Math.log2(numPlayers));

    const nextPowerOf2 = Math.pow(2, numRounds);
    let playersWithByes: (string | null)[] = [...qualifiedPlayers];

    while (playersWithByes.length < nextPowerOf2) {
        playersWithByes.push(null);
    }

    playersWithByes = shuffleArray(playersWithByes);

    type KnockoutMatchInsert = {
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
        sets?: MatchSet[];
    };

    let matchesToInsert: KnockoutMatchInsert[] = [];
    let matchIdMatrix: string[][] = [];
    let firstRoundMatches: string[] = [];
    for (let i = 0; i < playersWithByes.length; i += 2) {
        const matchId = uuidv4();
        firstRoundMatches.push(matchId);

        const p1 = playersWithByes[i];
        const p2 = playersWithByes[i + 1];
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
        }

        matchesToInsert.push({
            id: matchId,
            tournament_id: tournamentId,
            round: 2, // Start knockout at round 2 (round 1 is for groups)
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

    for (let round = 3; round <= numRounds + 1; round++) { // +1 because we start knockout at round 2
        const prevRoundMatches = matchIdMatrix[round - 3]; // -3 to adjust for our offset
        const currRoundMatches: string[] = [];

        for (let i = 0; i < prevRoundMatches.length; i += 2) {
            const matchId = uuidv4();
            currRoundMatches.push(matchId);

            const match1 = matchesToInsert.find(m => m.id === prevRoundMatches[i]);
            if (match1) match1.next_match_id = matchId;

            if (i + 1 < prevRoundMatches.length) {
                const match2 = matchesToInsert.find(m => m.id === prevRoundMatches[i + 1]);
                if (match2) match2.next_match_id = matchId;
            }

            matchesToInsert.push({
                id: matchId,
                tournament_id: tournamentId,
                round: round,
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

    return;
}

async function autoSelectRoundRobinWinner(tournamentId: string): Promise<string | null> {
    console.log(`[autoSelectRoundRobinWinner] Starting winner selection for tournament ${tournamentId}`);

    try {
        // Fetch tournament data
        const {data: tournamentData, error: tournamentError} = await supabase
            .from('tournaments')
            .select('*, tournament_matches(*)')
            .eq('id', tournamentId)
            .single();

        if (tournamentError) {
            console.error(`[autoSelectRoundRobinWinner] Error fetching tournament:`, tournamentError);
            return null;
        }

        if (!tournamentData) {
            console.error(`[autoSelectRoundRobinWinner] Tournament ${tournamentId} not found`);
            return null;
        }

        console.log(`[autoSelectRoundRobinWinner] Fetched tournament data:`, tournamentData);

        const matches: TournamentMatch[] = tournamentData.tournament_matches?.map((m: any) => ({
            id: m.id,
            tournamentId: m.tournament_id,
            round: m.round,
            player1Id: m.player1_id,
            player2Id: m.player2_id,
            player1Score: m.player1_score,
            player2Score: m.player2_score,
            status: m.status,
            winnerId: m.winner_id,
            sets: m.sets,
            nextMatchId: m.next_match_id,
            group: m.group,
            matchId: m.match_id,
        })) || [];

        console.log(`[autoSelectRoundRobinWinner] Found ${matches.length} matches in tournament`);

        // Check if all matches are completed
        const allMatchesCompleted = matches.every(m => m.status === 'completed');
        console.log(`[autoSelectRoundRobinWinner] Are all matches completed: ${allMatchesCompleted}`);
        if (!allMatchesCompleted || matches.length === 0) {
            console.log(`[autoSelectRoundRobinWinner] Not all matches are completed or no matches found, exiting.`);
            return null;
        }

        // Calculate points for each player
        const playerStats: Record<string, {
            playerId: string,
            points: number,     // wins
            matches: number,    // number of played matches
            smallPoints: number, // sum of small points (set difference)
            wins: number,        // number of wins
            losses: number,      // number of losses
            headToHead: Record<string, number> // head-to-head results
        }> = {};

        // Initialize stats for each player
        const playerIds = new Set<string>();
        matches.forEach(match => {
            if (match.player1Id) playerIds.add(match.player1Id);
            if (match.player2Id) playerIds.add(match.player2Id);
        });

        console.log(`[autoSelectRoundRobinWinner] Identified ${playerIds.size} players`);

        playerIds.forEach(playerId => {
            playerStats[playerId] = {
                playerId,
                points: 0,
                matches: 0,
                smallPoints: 0,
                wins: 0,
                losses: 0,
                headToHead: {}
            };
        });

        // Calculate stats based on matches
        matches.forEach(match => {
            if (match.status !== 'completed' || !match.player1Id || !match.player2Id) return;

            const player1 = playerStats[match.player1Id];
            const player2 = playerStats[match.player2Id];

            player1.matches++;
            player2.matches++;

            const p1Score = match.player1Score || 0;
            const p2Score = match.player2Score || 0;

            console.log(`[autoSelectRoundRobinWinner] Match: ${match.player1Id} vs ${match.player2Id}, Result: ${p1Score}:${p2Score}`);

            // Add head-to-head results
            if (p1Score > p2Score) {
                player1.points += 2; // 2 points for a win
                player1.wins++;
                player2.losses++;
                player1.headToHead[match.player2Id] = 1;
                player2.headToHead[match.player1Id] = -1;
            } else if (p2Score > p1Score) {
                player2.points += 2; // 2 points for a win
                player2.wins++;
                player1.losses++;
                player2.headToHead[match.player1Id] = 1;
                player1.headToHead[match.player2Id] = -1;
            }

            // Calculate small points (set difference)
            player1.smallPoints += p1Score - p2Score;
            player2.smallPoints += p2Score - p1Score;
        });

        console.log(`[autoSelectRoundRobinWinner] Player stats:`, playerStats);

        // Sort players by points, then by head-to-head, then by small points (set difference)
        const rankedPlayers = Object.values(playerStats).sort((a, b) => {
            // 1. First by points (more points = higher position)
            if (a.points !== b.points) return b.points - a.points;

            // 2. If points are equal, check head-to-head
            if (a.headToHead[b.playerId] !== undefined) {
                return a.headToHead[b.playerId] > 0 ? -1 : 1;
            }

            // 3. If head-to-head is equal or not applicable, check small points
            return b.smallPoints - a.smallPoints;
        });

        console.log(`[autoSelectRoundRobinWinner] Ranked players:`, rankedPlayers);

        // If there is at least one player, select the winner
        if (rankedPlayers.length > 0) {
            const winner = rankedPlayers[0];
            console.log(`[autoSelectRoundRobinWinner] Winner: ${winner.playerId}`);

            try {
                // Update tournament winner with a delay to avoid blocking the main thread
                const {error} = await new Promise<{ error?: any }>((resolve) => {
                    setTimeout(async () => {
                        const result = await supabase
                            .from('tournaments')
                            .update({
                                winner_id: winner.playerId,
                                status: 'completed'
                            })
                            .eq('id', tournamentId);
                        resolve(result);
                    }, 100); // Delay 100ms
                });

                if (error) {
                    console.error(`[autoSelectRoundRobinWinner] Error updating tournament winner:`, error);
                    return null;
                } else {
                    console.log(`[autoSelectRoundRobinWinner] Tournament ${tournamentId} completed. Winner: ${winner.playerId}`);
                    // After selecting the winner, refresh the tournament data
                    return winner.playerId;
                }
            } catch (error) {
                console.error(`[autoSelectRoundRobinWinner] Error selecting winner:`, error);
                return null;
            }
        } else {
            console.error(`[autoSelectRoundRobinWinner] No players to select winner from`);
            return null;
        }
    } catch (error) {
        console.error(`[autoSelectRoundRobinWinner] Error selecting winner:`, error);
        return null;
    }
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
    generateTournamentMatches: async (tournamentId: string) => {
        const tournament = get().tournaments.find(t => t.id === tournamentId);
        if (!tournament) return Promise.reject(new Error('Tournament not found'));

        if (tournament.format === TournamentFormat.GROUP) {
            try {
                set({loading: true, error: null});

                const groupMatches = get().getTournamentMatches(tournamentId).filter(m => m.round === 1);

                const {data: participantsData, error: pErr} = await supabase
                    .from('tournament_participants')
                    .select('player_id')
                    .eq('tournament_id', tournamentId);

                if (pErr) throw pErr;
                const playerIds = participantsData.map(p => p.player_id);

                const numGroups = Math.min(4, Math.ceil(playerIds.length / 3)); // Aim for 3-4 players per group

                const groups = Array.from(new Set(groupMatches.map(m => m.group).filter(Boolean))).map(groupNum => {
                    const groupPlayerIds = new Set<string>();
                    groupMatches.forEach(match => {
                        if (match.group === groupNum) {
                            if (match.player1Id) groupPlayerIds.add(match.player1Id);
                            if (match.player2Id) groupPlayerIds.add(match.player2Id);
                        }
                    });
                    return Array.from(groupPlayerIds);
                });

                const qualifiedPlayers = getTopPlayersFromGroups(groups, groupMatches);

                await generateKnockoutPhase(tournamentId, qualifiedPlayers);

                await get().fetchTournaments();
                set({loading: false});

                return Promise.resolve();
            } catch (error: any) {
                console.error('Generate Tournament Matches Error:', error);
                set({loading: false, error: error.message || 'Failed to generate matches'});
                return Promise.reject(error);
            }
        }

        return Promise.resolve();
    },
    tournaments: [],
    loading: false,
    error: null,
    lastFetchTimestamp: null,

    fetchTournaments: async (options?: { force?: boolean }) => {
        if (get().loading && !options?.force) {
            console.log('[STORE] Skipping fetchTournaments - already loading and not forced.');
            return;
        }

        const lastFetchTimestamp = get().lastFetchTimestamp;
        const now = Date.now();
        const FETCH_INTERVAL = 1500; // 1.5 seconds

        if (lastFetchTimestamp && (now - lastFetchTimestamp < FETCH_INTERVAL) && !options?.force) {
            console.log(`[STORE] Skipping fetchTournaments - too short interval (${now - lastFetchTimestamp}ms)`);
            return;
        }

        console.log('[STORE] Setting loading: true (fetchTournaments)');
        set({loading: true, error: null});

        try {
            const {data: rawTournaments, error} = await supabase
                .from('tournaments')
                .select(`
                    id, name, date, format, status, winner_id, created_at, updated_at,
                    tournament_participants ( player_id ),
                    tournament_matches ( * ) 
                `)
                .order('date', {ascending: false});

            if (error) {
                console.error('Failed to fetch tournaments:', error);
                throw error;
            }

            if (!rawTournaments) {
                set({
                    tournaments: [],
                    loading: false,
                    error: 'No tournaments data returned',
                    lastFetchTimestamp: Date.now()
                });
                return;
            }

            const processedTournaments = rawTournaments.map(t => {
                // Ensure tournament_participants and tournament_matches are arrays, even if null/undefined from Supabase
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
                        id: m.id,
                        tournamentId: m.tournament_id,
                        round: m.round,
                        group: m.group,
                        matchNumber: m.match_number,
                        player1Id: m.player1_id,
                        player2Id: m.player2_id,
                        player1Score: m.player1_score,
                        player2Score: m.player2_score,
                        winner: m.winner_id,
                        matchId: m.match_id,
                        nextMatchId: m.next_match_id,
                        status: m.status as TournamentMatch['status'],
                        sets: m.sets || [], // Default to empty array if sets is null/undefined
                        roundName: m.round_name,
                        startTime: m.start_time,
                    })),
                    winner: t.winner_id,
                    createdAt: t.created_at,
                    updatedAt: t.updated_at,
                };
            });

            // Sort tournaments: active, upcoming, completed, then by date descending
            processedTournaments.sort((a, b) => {
                const statusOrder: Record<TournamentStatus, number> = {
                    [TournamentStatus.IN_PROGRESS]: 1,
                    [TournamentStatus.UPCOMING]: 2,
                    [TournamentStatus.COMPLETED]: 3,
                };
                const statusA = a.status as TournamentStatus;
                const statusB = b.status as TournamentStatus;

                if (statusOrder[statusA] !== statusOrder[statusB]) {
                    return statusOrder[statusA] - statusOrder[statusB];
                }
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });

            set({tournaments: processedTournaments, loading: false, error: null, lastFetchTimestamp: Date.now()});
            console.log('[STORE] Tournaments fetched and processed successfully.');
        } catch (error: any) {
            console.error('Error in fetchTournaments:', error);
            set({error: `Failed to fetch tournaments: ${error.message}`, loading: false});
            console.log('[STORE] set loading: false (fetchTournaments error)');
        }
    },

    createTournament: async (name: string, date: string, format: TournamentFormat, playerIds: string[]): Promise<string | undefined> => {
        set({loading: true, error: null});
        console.log('[STORE] set loading: true (createTournament)');
        let tournamentId: string | undefined = undefined;
        try {
            if (playerIds.length < 2) {
                throw new Error("Minimum 2 players required");
            }

            if (format === TournamentFormat.KNOCKOUT && playerIds.length % 4 !== 0) {
                throw new Error("Knockout tournaments require an even number of players");
            }

            // Handle empty or missing tournament name
            let finalName = name?.trim();
            if (!finalName) {
                // Get existing tournaments to find the next number
                const {data: existingTournaments, error: fetchErr} = await supabase
                    .from('tournaments')
                    .select('name')
                    .ilike('name', 'Tournament %');
                
                if (fetchErr) {
                    console.warn("Error fetching existing tournament names:", fetchErr);
                    finalName = "Tournament 1"; // Default if can't fetch
                } else {
                    // Find the highest tournament number
                    let maxNumber = 0;
                    existingTournaments?.forEach(t => {
                        const match = t.name.match(/Tournament (\d+)/);
                        if (match && match[1]) {
                            const num = parseInt(match[1]);
                            if (!isNaN(num) && num > maxNumber) {
                                maxNumber = num;
                            }
                        }
                    });
                    finalName = `Tournament ${maxNumber + 1}`;
                }
            }

            const {data: tData, error: tErr} = await supabase
                .from('tournaments')
                .insert({name: finalName, date, format, status: 'pending'})
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

            await get().fetchTournaments({force: true}); // Ensure data is re-fetched
            set({loading: false});
            console.log('[STORE] set loading: false (createTournament)');
            return tournamentId;

        } catch (error: any) {
            console.error("Create Tournament Error:", error);
            if (tournamentId) {
                await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
                await supabase.from('tournaments').delete().eq('id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to create tournament'});
            console.log('[STORE] set loading: false (catch createTournament)');
            return undefined;
        }
    },

    generateAndStartTournament: async (tournamentId: string) => {
        set({loading: true, error: null});
        console.log('[STORE] set loading: true (generateAndStartTournament)');
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

            if (existingTournament.format === TournamentFormat.KNOCKOUT && playerIds.length % 4 !== 0) {
                throw new Error("Knockout tournaments require an even number of players");
            }

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
                sets?: MatchSet[];
                group?: number;
            };

            if (existingTournament.format === 'ROUND_ROBIN') {
                const schedule = generateRoundRobinSchedule(playerIds);
                const matchesToInsert: TournamentMatchInsert[] = schedule.map((match, index) => ({
                    id: uuidv4(),
                    tournament_id: tournamentId,
                    round: 1,
                    match_number: index + 1,
                    player1_id: match.player1Id,
                    player2_id: match.player2Id,
                    player1_score: null,
                    player2_score: null,
                    winner_id: null,
                    status: 'scheduled',
                    next_match_id: null,
                }));

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
                console.log('[STORE] set loading: false (generateAndStartTournament)');
            } else if (existingTournament.format === 'GROUP') {
                const numGroups = Math.min(4, Math.ceil(playerIds.length / 3)); // Aim for 3-4 players per group
                const groups = generateGroups(playerIds, numGroups);
                const groupMatches = generateGroupMatches(tournamentId, groups);

                const matchesToInsert: TournamentMatchInsert[] = groupMatches.map((match, index) => ({
                    id: uuidv4(),
                    tournament_id: tournamentId,
                    round: 1, // Group stage is round 1
                    match_number: index + 1,
                    player1_id: match.player1Id,
                    player2_id: match.player2Id,
                    player1_score: null,
                    player2_score: null,
                    winner_id: null,
                    status: 'scheduled',
                    next_match_id: null,
                    group: match.group
                }));

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
                console.log('[STORE] set loading: false (generateAndStartTournament)');
            } else {
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
                    const prevRoundMatches = matchIdMatrix[round - 2]; // -2 to adjust for our offset
                    const currRoundMatches: string[] = [];

                    for (let i = 0; i < prevRoundMatches.length; i += 2) {
                        const matchId = uuidv4();
                        currRoundMatches.push(matchId);

                        const match1 = matchesToInsert.find(m => m.id === prevRoundMatches[i]);
                        if (match1) match1.next_match_id = matchId;

                        if (i + 1 < prevRoundMatches.length) {
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
                console.log('[STORE] set loading: false (generateAndStartTournament)');
            }

        } catch (error: any) {
            console.error("Generate and Start Tournament Error:", error);
            if (generatedMatchesInserted) {
                await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to generate and start tournament'});
            console.log('[STORE] set loading: false (catch generateAndStartTournament)');
        }
    },

    updateMatchResult: async (tournamentId: string, matchId: string, scores: {
        player1Score: number;
        player2Score: number;
        sets?: MatchSet[]
    }) => {
        // --- Optimistic Update Phase ---
        let originalMatchState: TournamentMatch | undefined;
        let tournamentIndex = -1;
        let matchIndex = -1;

        const currentTournament = get().tournaments.find((t, idx) => {
            if (t.id === tournamentId) {
                tournamentIndex = idx;
                return true;
            }
            return false;
        });

        if (!currentTournament) {
            console.error(`Tournament ${tournamentId} not found for optimistic update.`);
            throw new Error(`Tournament ${tournamentId} not found.`);
        }

        const matchToUpdate = currentTournament.matches.find((m, idx) => {
            if (m.id === matchId) {
                matchIndex = idx;
                return true;
            }
            return false;
        });

        if (!matchToUpdate) {
            console.error(`Match ${matchId} not found in tournament ${tournamentId} for optimistic update.`);
            throw new Error(`Match ${matchId} not found in tournament ${tournamentId}.`);
        }
        
        if (matchToUpdate.status === 'completed') {
            console.warn(`Match ${matchId} is already completed. Skipping update.`);
            return; // Or throw error, depending on desired behavior
        }
        if (!matchToUpdate.player1Id || !matchToUpdate.player2Id) {
            throw new Error(`Match ${matchId} lacks defined players.`);
        }

        originalMatchState = JSON.parse(JSON.stringify(matchToUpdate)); // Deep copy for rollback

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
        
        // This check might be specific to knockout, round robin can have draws in individual matches
        // if (p1FinalScore === p2FinalScore && currentTournament.format === TournamentFormat.KNOCKOUT) {
        //     throw new Error("Match score cannot be a draw in knockout");
        // }
        const winnerId = p1FinalScore > p2FinalScore ? matchToUpdate.player1Id : (p2FinalScore > p1FinalScore ? matchToUpdate.player2Id : null);


        // Optimistically update the local store
        set(state => {
            const newTournaments = [...state.tournaments];
            const tournamentToUpdate = newTournaments[tournamentIndex];
            if (tournamentToUpdate && tournamentToUpdate.matches[matchIndex]) {
                const updatedMatch = {
                    ...tournamentToUpdate.matches[matchIndex],
                    player1Score: scores.player1Score, // Store individual set scores if available, or game scores
                    player2Score: scores.player2Score,
                    winner: winnerId, // Use the calculated winnerId based on game scores
                    status: 'completed' as TournamentMatch['status'], // Mark as completed optimistically
                    sets: scores.sets || [],
                };
                tournamentToUpdate.matches[matchIndex] = updatedMatch;
                newTournaments[tournamentIndex] = {...tournamentToUpdate, matches: [...tournamentToUpdate.matches]};
            }
            return {tournaments: newTournaments, error: null, loading: true}; // Set loading true for background tasks
        });
        
        // --- Call Refactored matchStore.addMatch (non-blocking for its main ops) ---
        // This uses the already refactored optimistic addMatch from matchStore
        try {
            const matchStore = require('./matchStore').useMatchStore.getState();
            // addMatch expects game scores, not set scores directly as p1Score/p2Score
            await matchStore.addMatch(
                matchToUpdate.player1Id,
                matchToUpdate.player2Id,
                p1FinalScore, // Pass game scores
                p2FinalScore, // Pass game scores
                scores.sets || [],
                tournamentId
            );
            console.log(`[updateMatchResult] Optimistic global match add initiated for tournament match ${matchId}`);
        } catch (error) {
            // This catch is for synchronous errors from addMatch setup, not its background processing.
            console.error(`[updateMatchResult] Error initiating global match add for tournament match ${matchId}:`, error);
            // Decide if this warrants a rollback of the local tournament match update.
            // For now, let's assume it doesn't, as addMatch handles its own state.
            // The tournament match itself might still be validly updated on the server.
        }

        // --- Background Processing for Tournament-Specific Logic ---
        // This try-catch handles errors for the tournament-specific background operations.
        try {
            const supabaseMatchUpdatePayload = {
                player1_score: scores.player1Score, // these are individual game scores if sets are not used, or total sets won if sets are provided
                player2_score: scores.player2Score,
                winner_id: winnerId, // winnerId calculated from p1FinalScore vs p2FinalScore (total sets won)
                status: 'completed',
                sets: scores.sets, // full set details
            };

            const {error: supabaseUpdateError} = await supabase
                .from('tournament_matches')
                .update(supabaseMatchUpdatePayload)
                .eq('id', matchId);

            if (supabaseUpdateError) {
                // Rollback optimistic tournament match update in Zustand store
                if (originalMatchState && tournamentIndex !== -1 && matchIndex !== -1) {
                    set(state => {
                        const newTournaments = [...state.tournaments];
                        const tournamentToRollback = newTournaments[tournamentIndex];
                        // Ensure the objects are actually being updated for Zustand to re-render
                        if (tournamentToRollback && tournamentToRollback.matches[matchIndex]) {
                            tournamentToRollback.matches = [
                                ...tournamentToRollback.matches.slice(0, matchIndex),
                                originalMatchState,
                                ...tournamentToRollback.matches.slice(matchIndex + 1),
                            ];
                            newTournaments[tournamentIndex] = {...tournamentToRollback};
                        }
                        return {
                            tournaments: newTournaments,
                            loading: false,
                            error: `Failed to update tournament match ${matchId} on server: ${supabaseUpdateError.message}. Local state rolled back.`
                        };
                    });
                } else {
                     set({ loading: false, error: `Failed to update tournament match ${matchId} on server: ${supabaseUpdateError.message}. Rollback data missing.` });
                }
                // Early exit if primary operation failed
                return; 
            }

            // If Supabase update for the current match is successful, proceed with secondary logic:
            // 1. Update next match if applicable
            if (matchToUpdate.nextMatchId && winnerId) { // winnerId must exist to advance a player
                const nextMatchId = matchToUpdate.nextMatchId;
                // Find the next match within the already fetched currentTournament object
                const nextTournamentMatchToUpdate = currentTournament.matches.find(m => m.id === nextMatchId);

                if (nextTournamentMatchToUpdate) {
                    const nextMatchSupabasePayload: { player1_id?: string; player2_id?: string; status?: TournamentMatch['status'] } = {};
                    if (nextTournamentMatchToUpdate.player1Id === null) {
                        nextMatchSupabasePayload.player1_id = winnerId;
                    } else if (nextTournamentMatchToUpdate.player2Id === null) {
                        nextMatchSupabasePayload.player2_id = winnerId;
                    }

                    // Update status to 'scheduled' if both players are now set
                    if ((nextMatchSupabasePayload.player1_id || nextTournamentMatchToUpdate.player1Id) &&
                        (nextMatchSupabasePayload.player2_id || nextTournamentMatchToUpdate.player2Id)) {
                        nextMatchSupabasePayload.status = 'scheduled';
                    }

                    if (Object.keys(nextMatchSupabasePayload).length > 0) {
                        const {error: nextMatchUpdateErr} = await supabase
                            .from('tournament_matches')
                            .update(nextMatchSupabasePayload)
                            .eq('id', nextMatchId);
                        if (nextMatchUpdateErr) {
                            console.error(`Failed to update next match ${nextMatchId} in Supabase:`, nextMatchUpdateErr);
                            // This is a secondary operation failure. Log it and set a non-critical error.
                            // The main match update was successful.
                            set(state => ({
                                error: (state.error ? state.error + "; " : "") + `Failed to update details for next match ${nextMatchId}.`,
                            }));
                        } else {
                            // Optimistically update the next match in local state
                            set(state => {
                                const newTournaments = state.tournaments.map(t => {
                                    if (t.id === tournamentId) {
                                        const updatedMatches = t.matches.map(m => {
                                            if (m.id === nextMatchId) {
                                                return {...m, ...nextMatchSupabasePayload};
                                            }
                                            return m;
                                        });
                                        return {...t, matches: updatedMatches};
                                    }
                                    return t;
                                });
                                return {tournaments: newTournaments};
                            });
                        }
                    }
                }
            } else if (winnerId) { // This is potentially a final match (no nextMatchId) and there's a winner
                const tournament = currentTournament; // Use the tournament object we already have
                if (tournament.format === TournamentFormat.KNOCKOUT) {
                    console.log(`[updateMatchResult] KNOCKOUT final. Winner: ${winnerId}, Tournament: ${tournamentId}`);
                    await get().setTournamentWinner(tournamentId, winnerId);
                } else if (tournament.format === TournamentFormat.ROUND_ROBIN) {
                     // For Round Robin, check if all matches are completed to determine winner
                    const allMatchesInTournamentCompleted = tournament.matches.every(
                        m => m.id === matchId ? true : m.status === 'completed' // Current match is now complete
                    );
                    if (allMatchesInTournamentCompleted) {
                        console.log(`[updateMatchResult] All ROUND_ROBIN matches completed for ${tournamentId}. Determining winner.`);
                        await autoSelectRoundRobinWinner(tournamentId);
                    }
                } else if (tournament.format === TournamentFormat.GROUP) {
                    // For Group stage, check if all group matches (round 1) are completed
                    const groupMatches = tournament.matches.filter(m => m.round === 1);
                    const allGroupMatchesCompleted = groupMatches.every(
                         m => (m.id === matchId && m.round === 1) ? true : (m.round === 1 && m.status === 'completed')
                    );
                    if (allGroupMatchesCompleted && groupMatches.length > 0) { // Ensure there are group matches
                        console.log(`[updateMatchResult] All GROUP stage matches completed for ${tournamentId}. Generating knockout phase.`);
                        await get().generateTournamentMatches(tournamentId); // This generates knockout phase
                    }
                }
            }
            
            // After all background operations, fetch fresh tournament data to ensure UI consistency.
            // This also helps if secondary operations (like setTournamentWinner or autoSelectRoundRobinWinner)
            // have their own fetch calls, this one ensures the very latest state.
            await get().fetchTournaments({force: true});
            set({loading: false, error: null}); // Clear loading and any transient errors

        } catch (error: any) { // Catch errors from the background processing block
            console.error("Error during background processing of updateMatchResult (outer try-catch):", error);
            // If the error wasn't a Supabase update error that caused a rollback,
            // ensure loading is false and set a general error.
            if (!get().error && !(error.message && error.message.includes("Failed to update tournament match"))) { 
                set({loading: false, error: error.message || 'Failed to process tournament match update in background.'});
            } else if (!get().error) { // If an error occurred but wasn't set (e.g. from a non-Supabase part)
                 set({loading: false, error: error.message || 'An unexpected error occurred.' });
            }
            // The function resolved after the optimistic update. UI relies on store changes for error feedback.
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
            winner: m.winner,
            matchId: m.matchId ?? m.id ?? null,
            status: m.status === 'pending_players' ? 'pending' : m.status,
            player1Score: m.player1Score ?? null,
            player2Score: m.player2Score ?? null,
            nextMatchId: m.nextMatchId ?? null,
            sets: m.sets,
            group: m.group
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

        console.log(`[setTournamentWinner] Setting winner ${winnerId} for tournament ${tournamentId}`);
        set({loading: true, error: null});
        console.log('[STORE] set loading: true (setTournamentWinner)');
        try {
            // First, update the local state
            set(state => ({
                tournaments: state.tournaments.map(t =>
                    t.id === tournamentId ? {
                        ...t,
                        winner: winnerId,
                        status: TournamentStatus.COMPLETED
                    } : t
                )
            }));

            // Then, update the database
            const {error} = await supabase.from('tournaments').update({
                winner_id: winnerId,
                status: TournamentStatus.COMPLETED
            }).eq('id', tournamentId);

            if (error) throw error;

            // Refresh tournament data to ensure everything is up-to-date
            await get().fetchTournaments();
            console.log(`[setTournamentWinner] Successfully set winner ${winnerId} for tournament ${tournamentId}`);
            set({loading: false});
            console.log('[STORE] set loading: false (setTournamentWinner)');
        } catch (error: any) {
            console.error("Failed to set tournament winner:", error);
            set({error: error.message || "Failed to set winner"});
            set({loading: false});
            console.log('[STORE] set loading: false (catch setTournamentWinner)');
        }
    },
}));

// Helper to transform Supabase tournament row to local Tournament type
// Note: This basic transform won't populate participants or matches from a simple row event.
// These are typically joined in fetchTournaments or handled by tournament_matches events.
const transformSupabaseTournamentRow = (supabaseTournament: any): Partial<Tournament> => {
    return {
        id: supabaseTournament.id,
        name: supabaseTournament.name,
        date: supabaseTournament.date,
        format: supabaseTournament.format as TournamentFormat,
        status: supabaseTournament.status as TournamentStatus,
        winner: supabaseTournament.winner_id, // maps winner_id to winner
        createdAt: supabaseTournament.created_at,
        updatedAt: supabaseTournament.updated_at,
        // participants and matches are intentionally omitted as they are not directly on the tournament row
    };
};

// Helper to transform Supabase tournament_matches row to local TournamentMatch type
const transformSupabaseTournamentMatch = (supabaseMatch: any): TournamentMatch => {
    return {
        id: supabaseMatch.id,
        tournamentId: supabaseMatch.tournament_id,
        round: supabaseMatch.round,
        group: supabaseMatch.group,
        matchNumber: supabaseMatch.match_number,
        player1Id: supabaseMatch.player1_id,
        player2Id: supabaseMatch.player2_id,
        player1Score: supabaseMatch.player1_score,
        player2Score: supabaseMatch.player2_score,
        winner: supabaseMatch.winner_id, // maps winner_id to winner
        matchId: supabaseMatch.match_id || supabaseMatch.id, // fallback for older data if any
        nextMatchId: supabaseMatch.next_match_id,
        status: supabaseMatch.status as TournamentMatch['status'],
        sets: typeof supabaseMatch.sets === 'string' ? JSON.parse(supabaseMatch.sets) : supabaseMatch.sets || [],
        roundName: supabaseMatch.round_name,
        startTime: supabaseMatch.start_time,
    };
};


// Add a variable to track the last tournament state (used by old throttling logic, may remove/adjust)
let lastTournamentsState: {
    tournamentId: string;
    isCompleted: boolean;
    hasWinner: boolean;
}[] = [];


export function useTournamentsRealtime() {
    useEffect(() => {
        const handleChanges = (payload: any) => {
            const {set, getState} = useTournamentStore;
            console.log('[TOURNAMENT REALTIME] Received payload:', payload);

            // Basic throttling, can be refined later if granular updates are too frequent
            if (getState().loading) {
                console.log('[TOURNAMENT REALTIME] Skipping, store is already loading.');
                return;
            }
            
            try {
                switch (payload.table) {
                    case 'tournaments':
                        const tournamentId = payload.new?.id || payload.old?.id;
                        if (!tournamentId) {
                             console.warn('[TOURNAMENT REALTIME] No ID found for tournament event. Refetching.', payload);
                             getState().fetchTournaments({force: true}).catch(e => console.warn("Error refetching tournaments:", e));
                             return;
                        }
                        switch (payload.eventType) {
                            case 'INSERT':
                                const newTournamentData = transformSupabaseTournamentRow(payload.new);
                                set(state => {
                                    // Avoid duplicates if already present (e.g., from optimistic update)
                                    if (state.tournaments.some(t => t.id === newTournamentData.id)) {
                                        // If it exists, update it, ensuring matches/participants aren't wiped
                                        return {
                                            tournaments: state.tournaments.map(t =>
                                                t.id === newTournamentData.id ? {...t, ...newTournamentData, matches: t.matches || [], participants: t.participants || [] } : t
                                            )
                                        };
                                    }
                                    return {tournaments: [...state.tournaments, {...newTournamentData, matches: [], participants: []} as Tournament]};
                                });
                                console.log(`[TOURNAMENT REALTIME] INSERT tournament: ${tournamentId}`);
                                break;
                            case 'UPDATE':
                                const updatedTournamentData = transformSupabaseTournamentRow(payload.new);
                                set(state => ({
                                    tournaments: state.tournaments.map(t =>
                                        t.id === updatedTournamentData.id ? {...t, ...updatedTournamentData} : t
                                    ),
                                }));
                                console.log(`[TOURNAMENT REALTIME] UPDATE tournament: ${tournamentId}`);
                                break;
                            case 'DELETE':
                                set(state => ({
                                    tournaments: state.tournaments.filter(t => t.id !== payload.old.id),
                                }));
                                console.log(`[TOURNAMENT REALTIME] DELETE tournament: ${payload.old.id}`);
                                break;
                            default:
                                console.log(`[TOURNAMENT REALTIME] Unknown event type for tournaments table: ${payload.eventType}. Refetching.`);
                                getState().fetchTournaments({force: true}).catch(e => console.warn("Error refetching tournaments:", e));
                        }
                        break;

                    case 'tournament_matches':
                        const matchTournamentId = payload.new?.tournament_id || payload.old?.tournament_id;
                        const matchId = payload.new?.id || payload.old?.id;

                        if (!matchTournamentId || !matchId) {
                             console.warn('[TOURNAMENT REALTIME] No ID/tournament_id for tournament_match event. Refetching.', payload);
                             getState().fetchTournaments({force: true}).catch(e => console.warn("Error refetching tournaments:", e));
                             return;
                        }
                        
                        switch (payload.eventType) {
                            case 'INSERT':
                                const newMatchData = transformSupabaseTournamentMatch(payload.new);
                                set(state => ({
                                    tournaments: state.tournaments.map(t => {
                                        if (t.id === matchTournamentId) {
                                            // Avoid duplicate matches if already present (e.g. optimistic update)
                                            if (t.matches.some(m => m.id === newMatchData.id)) {
                                                return { ...t, matches: t.matches.map(m => m.id === newMatchData.id ? newMatchData : m) };
                                            }
                                            return {...t, matches: [...t.matches, newMatchData]};
                                        }
                                        return t;
                                    }),
                                }));
                                console.log(`[TOURNAMENT REALTIME] INSERT match ${matchId} into tournament ${matchTournamentId}`);
                                break;
                            case 'UPDATE':
                                const updatedMatchData = transformSupabaseTournamentMatch(payload.new);
                                set(state => ({
                                    tournaments: state.tournaments.map(t => {
                                        if (t.id === matchTournamentId) {
                                            return {
                                                ...t,
                                                matches: t.matches.map(m =>
                                                    m.id === updatedMatchData.id ? {...m, ...updatedMatchData} : m
                                                ),
                                            };
                                        }
                                        return t;
                                    }),
                                }));
                                console.log(`[TOURNAMENT REALTIME] UPDATE match ${matchId} in tournament ${matchTournamentId}`);
                                break;
                            case 'DELETE':
                                set(state => ({
                                    tournaments: state.tournaments.map(t => {
                                        if (t.id === matchTournamentId) {
                                            return {...t, matches: t.matches.filter(m => m.id !== payload.old.id)};
                                        }
                                        return t;
                                    }),
                                }));
                                console.log(`[TOURNAMENT REALTIME] DELETE match ${payload.old.id} from tournament ${matchTournamentId}`);
                                break;
                            default:
                                console.log(`[TOURNAMENT REALTIME] Unknown event type for tournament_matches: ${payload.eventType}. Refetching.`);
                                getState().fetchTournaments({force: true}).catch(e => console.warn("Error refetching tournaments:", e));
                        }
                        break;
                    default:
                        console.log(`[TOURNAMENT REALTIME] Unhandled table: ${payload.table}. Refetching.`);
                        // Fallback to full refetch if table is not handled or for safety
                        getState().fetchTournaments({force: true}).catch(e => console.warn("Error refetching tournaments:", e));
                }
            } catch (error) {
                console.error("[TOURNAMENT REALTIME] Error processing realtime update:", error, payload);
                getState().fetchTournaments({force: true}).catch(e => console.warn("Error refetching tournaments after processing error:", e));
            }
        };

        const tournamentsChannel = supabase
            .channel('tournaments-changes')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'tournaments'},
                handleChanges
            )
            .subscribe();

        // Listen for changes in the tournament_matches table
        const matchesChannel = supabase
            .channel('tournament-matches-changes')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'tournament_matches'},
                handleChanges
            )
            .subscribe();

        return () => {
            supabase.removeChannel(tournamentsChannel).catch((e) =>
                console.error("Error removing tournaments channel:", e));
            supabase.removeChannel(matchesChannel).catch((e) =>
                console.error("Error removing matches channel:", e));
        };
    }, []);
}
