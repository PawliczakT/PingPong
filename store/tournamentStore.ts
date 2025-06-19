import {create} from 'zustand';
import {supabase} from '@/backend/server/lib/supabase';
import {v4 as uuidv4} from 'uuid';
import type {Set as MatchSet} from '@/backend/types';
import {Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/backend/types';
import {useEffect} from "react";
import {dispatchSystemNotification} from '@/backend/server/trpc/services/notificationService';
import {usePlayerStore} from './playerStore';

type TournamentStore = {
    generateTournamentMatches: (tournamentId: string) => Promise<void>;
    tournaments: Tournament[];
    loading: boolean;
    error: string | null;
    lastFetchTimestamp: number | null;
    fetchTournaments: (options?: { force?: boolean }) => Promise<void>;
    createTournament: (name: string, date: string, format: TournamentFormat, playerIds: string[]) => Promise<string | undefined>;
    updateMatchResult: (tournamentId: string, matchId: string, scores: {
        player1Score: number;
        player2Score: number;
        sets?: MatchSet[]
    }) => Promise<void>;
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
        sets?: MatchSet[] | null;
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
            sets: null, // Ensure sets is null or serialized
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
                sets: null, // Ensure sets is null or serialized
            });
        }

        matchIdMatrix.push(currRoundMatches);
    }

    const {error: mErr} = await supabase.from('tournament_matches').insert(
        matchesToInsert.map(match => ({
            ...match,
            sets: match.sets ? JSON.stringify(match.sets) : null,
        }))
    );
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
            winner: m.winner_id,
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
                type TournamentMatchInsertDB = Omit<TournamentMatchInsert, 'sets'>;

                const matchesToInsert: TournamentMatchInsertDB[] = schedule.map((match, index) => ({
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
                const numGroups = Math.min(4, Math.ceil(playerIds.length / 3));
                const groups = generateGroups(playerIds, numGroups);
                const groupMatches = generateGroupMatches(tournamentId, groups);

                const matchesToInsert: TournamentMatchInsert[] = groupMatches.map((match, index) => ({
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
                    group: match.group
                }));

                const {error: mErr} = await supabase.from('tournament_matches').insert(
                    matchesToInsert.map(match => ({
                        ...match,
                        sets: match.sets ? JSON.stringify(match.sets) : null,
                    }))
                );
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

                const {error: mErr} = await supabase.from('tournament_matches').insert(
                    matchesToInsert.map(match => ({
                        ...match,
                        sets: match.sets ? JSON.stringify(match.sets) : null,
                    }))
                );
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
        set({loading: true, error: null});
        console.log('[STORE] set loading: true (updateMatchResult)');
        try {
            // Use a delay to avoid blocking the main thread
            await new Promise(resolve => setTimeout(resolve, 10));

            const currentMatch = get().tournaments.find(t => t.id === tournamentId)
                ?.matches.find(m => m.id === matchId);

            if (!currentMatch) throw new Error(`Match ${matchId} not found in tournament ${tournamentId}`);
            if (currentMatch.status === 'completed') {
                console.warn(`Match ${matchId} is already completed.`);
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
                sets: scores.sets,
            };

            type MatchStatus = "pending" | "completed" | "scheduled" | "bye";

            const {error: updateErr} = await new Promise<{ error?: any }>(resolve => {
                setTimeout(async () => {
                    const serializedData = {
                        ...updateData,
                        sets: updateData.sets ? updateData.sets.map(set => ({...set})) : null,
                        status: updateData.status as MatchStatus
                    };

                    const result = await supabase
                        .from('tournament_matches')
                        .update(serializedData)
                        .eq('id', matchId);
                    resolve(result);
                }, 50);
            });

            if (updateErr) throw updateErr;

            // Dodaj mecz również do ogólnej historii meczów
            try {
                const matchStore = require('./matchStore').useMatchStore.getState();
                await matchStore.addMatch(
                    currentMatch.player1Id,
                    currentMatch.player2Id,
                    scores.player1Score,
                    scores.player2Score,
                    scores.sets || [],
                    tournamentId
                );
                console.log(`[updateMatchResult] Successfully added tournament match to general match history`);
            } catch (error) {
                console.error(`[updateMatchResult] Error adding match to general history:`, error);
            }

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
                        // Update next match with a delay
                        await new Promise(resolve => {
                            setTimeout(async () => {
                                await supabase
                                    .from('tournament_matches')
                                    .update(updateData)
                                    .eq('id', nextMatchId);
                                resolve(null);
                            }, 50);
                        });
                    }
                }
            } else {
                console.log(`[updateMatchResult] No next match - checking if tournament is completed`);
                const tournament = get().tournaments.find(t => t.id === tournamentId);

                if (tournament?.format === TournamentFormat.KNOCKOUT) {
                    console.log(`[updateMatchResult] Tournament is in KNOCKOUT format - setting winner ${winnerId}`);
                    // For KNOCKOUT format, the last match (final) completes the tournament
                    try {
                        await new Promise(resolve => {
                            setTimeout(async () => {
                                await get().setTournamentWinner(tournamentId, winnerId);
                                resolve(null);
                            }, 100);
                        });
                        console.log(`[updateMatchResult] Successfully set winner ${winnerId} for tournament ${tournamentId}`);
                    } catch (error) {
                        console.error(`[updateMatchResult] Error setting winner:`, error);
                    }
                } else if (tournament?.format === TournamentFormat.ROUND_ROBIN) {
                    console.log(`[updateMatchResult] Tournament is in ROUND_ROBIN format - checking if all matches are completed`);
                    // For ROUND_ROBIN format, check if all matches are completed
                    try {
                        // Fetch data with a delay
                        const {data: freshTournament, error: tournamentError} = await new Promise<{
                            data?: any,
                            error?: any
                        }>(resolve => {
                            setTimeout(async () => {
                                const result = await supabase
                                    .from('tournaments')
                                    .select('*, tournament_matches(status)')
                                    .eq('id', tournamentId)
                                    .single();
                                resolve(result);
                            }, 50);
                        });

                        if (tournamentError) {
                            console.error("Error fetching tournament data:", tournamentError);
                            return;
                        }

                        const tournamentMatches = freshTournament?.tournament_matches || [];
                        console.log(`Checking ${tournamentMatches.length} matches in tournament ${tournamentId}`);

                        const allMatchesCompleted = tournamentMatches.every((m: any) => m.status === 'completed');
                        console.log(`Are all matches completed: ${allMatchesCompleted}`);

                        if (allMatchesCompleted && tournamentMatches.length > 0) {
                            console.log(`All matches completed (${tournamentMatches.length}). Selecting winner...`);
                            try {
                                const winnerId = await autoSelectRoundRobinWinner(tournamentId);
                                console.log(`Tournament ${tournamentId} completed. Winner: ${winnerId}`);
                            } catch (error) {
                                console.error("Error selecting winner:", error);
                            }
                        } else {
                            console.log(`Tournament is ongoing. Completed matches: ${tournamentMatches.filter((m: any) => m.status === 'completed').length}/${tournamentMatches.length}`);
                        }
                    } catch (error) {
                        console.error("Error checking tournament status:", error);
                    }
                } else if (tournament?.format === TournamentFormat.GROUP) {
                    // For GROUP format, do not automatically complete the tournament
                    console.log(`[updateMatchResult] Tournament is in GROUP format - not automatically completing`);
                }
            }

            // Always refresh tournament data at the end
            await new Promise(resolve => {
                setTimeout(async () => {
                    await get().fetchTournaments({force: true});
                    resolve(null);
                }, 100);
            });

            console.log('[STORE] set loading: false (finally updateMatchResult)');

        } catch (error: any) {
            console.error("Update Match Result Error:", error);
            set({loading: false, error: error.message || 'Failed to update match'});
            console.log('[STORE] set loading: false (catch updateMatchResult)');
            return;
        } finally {
            // Always reset the loading state only once at the end
            console.log("[updateMatchResult] Finalizing - resetting loading state");
            set({loading: false});
            console.log('[STORE] set loading: false (finally updateMatchResult)');
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

            // Dispatch system notification for tournament won
            try {
                const tournament = get().getTournamentById(tournamentId);
                const playerStore = usePlayerStore.getState();
                const winner = playerStore.getPlayerById(winnerId);
                if (tournament && winner) {
                    await dispatchSystemNotification('tournament_won', {
                        notification_type: 'tournament_won',
                        winnerNickname: winner.nickname,
                        tournamentName: tournament.name,
                        tournamentId: tournament.id,
                    });
                }
            } catch (e) {
                console.warn("Failed to dispatch tournament_won system notification", e);
            }

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

// Add a variable to track the last tournament state
let lastTournamentsState: {
    tournamentId: string;
    isCompleted: boolean;
    hasWinner: boolean;
}[] = [];

export function useTournamentsRealtime() {
    useEffect(() => {
        const handleChanges = () => {
            // Block: do not fetch if loading is already true
            if (useTournamentStore.getState().loading) {
                console.log(`[STORE] Skipping refresh (loading already active)`);
                return;
            }

            // Check if the minimum interval between refreshes has passed
            const now = Date.now();
            const lastFetch = useTournamentStore.getState().lastFetchTimestamp || 0;
            const minInterval = 2000; // Increase the minimum interval to 2 seconds for subscriptions

            if (now - lastFetch < minInterval) {
                console.log(`[STORE] Skipping refresh (too soon, interval: ${now - lastFetch}ms)`);
                return;
            }

            // Check if the tournament state has changed significantly to avoid unnecessary refreshes
            const currentTournaments = useTournamentStore.getState().tournaments;
            const currentState = currentTournaments.map(t => ({
                tournamentId: t.id,
                isCompleted: t.status === 'completed',
                hasWinner: Boolean(t.winner)
            }));

            // Check if the only change is a tournament being completed that already has a winner
            const significantChange = !lastTournamentsState.length || currentState.some((curr, i) => {
                const prev = lastTournamentsState[i];
                // If the tournament was already completed and had a winner, do not refresh
                if (prev && prev.tournamentId === curr.tournamentId &&
                    prev.isCompleted && prev.hasWinner &&
                    curr.isCompleted && curr.hasWinner) {
                    return false;
                }
                return !prev || prev.tournamentId !== curr.tournamentId ||
                    prev.isCompleted !== curr.isCompleted ||
                    prev.hasWinner !== curr.hasWinner;
            });

            lastTournamentsState = currentState;

            if (!significantChange) {
                console.log(`[STORE] Skipping refresh (no significant changes in tournaments)`);
                return;
            }

            console.log(`[STORE] Refreshing data through subscription (interval: ${now - lastFetch}ms)`);
            useTournamentStore.getState().fetchTournaments().catch((e) =>
                console.error("Error fetching tournaments:", e));
        };

        // Listen for changes in the tournaments table
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
