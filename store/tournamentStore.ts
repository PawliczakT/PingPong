// store/tournamentStore.ts
import {create} from 'zustand';
import {supabase} from '@/app/lib/supabase';
import {v4 as uuidv4} from 'uuid';
import type {Set as MatchSet} from '@/backend/types';
import {Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/backend/types';
import type {TournamentWonMetadata} from '@/backend/server/trpc/services/notificationService';
import {dispatchSystemNotification} from '@/backend/server/trpc/services/notificationService';
import {usePlayerStore} from './playerStore';
import {useMatchStore} from "@/store/matchStore";
import {RealtimeChannel, RealtimePostgresChangesPayload} from "@supabase/supabase-js";
import {useEffect} from "react";

export type TournamentStore = {
    handleTournamentUpdate(payload: RealtimePostgresChangesPayload<any>): void;
    handleMatchUpdate(payload: RealtimePostgresChangesPayload<any>): void;
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
    getPlayerTournamentWins: (playerId: string) => number;
};

let tournamentChannel: RealtimeChannel | null = null;

const getTournamentChannel = (): RealtimeChannel => {
    if (!tournamentChannel) {
        tournamentChannel = supabase.channel('tournaments-realtime');
    }
    return tournamentChannel;
};

/**
 * Transforms raw match data from the database into a TournamentMatch object.
 * @param match - Raw match data from Supabase.
 * @returns Transformed TournamentMatch object.
 */
const transformMatchData = (match: any): TournamentMatch => ({
    id: match.id,
    tournamentId: match.tournament_id,
    round: match.round,
    matchNumber: match.match_number,
    matchId: match.match_id,
    player1Id: match.player1_id,
    player2Id: match.player2_id,
    player1Score: match.player1_score,
    player2Score: match.player2_score,
    winner: match.winner_id,
    status: match.status,
    nextMatchId: match.next_match_id,
    sets: match.sets,
    group: match.group,
});

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 * @param array - The array to shuffle.
 * @returns The shuffled array.
 */
function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Generates a round-robin schedule for the given players.
 * @param playerIds - Array of player IDs.
 * @returns Array of match pairs.
 */
function generateRoundRobinSchedule(playerIds: string[]): { player1Id: string; player2Id: string }[] {
    const schedule: { player1Id: string; player2Id: string }[] = [];
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            schedule.push({player1Id: playerIds[i], player2Id: playerIds[j]});
        }
    }
    return schedule;
}

/**
 * Divides players into groups.
 * @param playerIds - Array of player IDs.
 * @param numGroups - Number of groups to create.
 * @returns Array of groups, each containing player IDs.
 */
function generateGroups(playerIds: string[], numGroups: number): string[][] {
    const shuffledPlayers = shuffleArray([...playerIds]);
    const groups: string[][] = Array.from({length: numGroups}, () => []);
    shuffledPlayers.forEach((playerId, index) => groups[index % numGroups].push(playerId));
    return groups;
}

/**
 * Generates matches within groups.
 * @param tournamentId - ID of the tournament.
 * @param groups - Array of groups.
 * @returns Array of group matches.
 */
function generateGroupMatches(tournamentId: string, groups: string[][]): {
    player1Id: string;
    player2Id: string;
    group: number
}[] {
    const matches: { player1Id: string; player2Id: string; group: number }[] = [];
    groups.forEach((group, groupIndex) => {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                matches.push({player1Id: group[i], player2Id: group[j], group: groupIndex + 1});
            }
        }
    });
    return matches;
}

/**
 * Determines top players from each group based on match results.
 * @param groups - Array of groups.
 * @param matches - Array of tournament matches.
 * @returns Array of top player IDs from each group.
 */
function getTopPlayersFromGroups(groups: string[][], matches: TournamentMatch[]): string[] {
    const qualifiers: string[] = [];
    groups.forEach((group, groupIndex) => {
        const groupMatches = matches.filter(m => m.group === groupIndex + 1 && m.status === 'completed');
        const playerStats: Record<string, { played: number; wins: number; points: number; pointsDiff: number }> = {};
        group.forEach(playerId => playerStats[playerId] = {played: 0, wins: 0, points: 0, pointsDiff: 0});
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
            if (match.player1Score > match.player2Score) playerStats[p1].wins++;
            else playerStats[p2].wins++;
        });
        const sortedPlayers = group.sort((a, b) => {
            const statsA = playerStats[a];
            const statsB = playerStats[b];
            if (statsA.wins !== statsB.wins) return statsB.wins - statsA.wins;
            if (statsA.pointsDiff !== statsB.pointsDiff) return statsB.pointsDiff - statsA.pointsDiff;
            return statsB.points - statsA.points;
        });
        if (sortedPlayers.length > 0) qualifiers.push(sortedPlayers[0]);
    });
    return qualifiers;
}

/**
 * Generates the knockout phase matches and inserts them into the database.
 * @param tournamentId - ID of the tournament.
 * @param qualifiedPlayers - Array of qualified player IDs.
 */
async function generateKnockoutPhase(tournamentId: string, qualifiedPlayers: string[]): Promise<void> {
    const numPlayers = qualifiedPlayers.length;
    const numRounds = Math.ceil(Math.log2(numPlayers));
    const nextPowerOf2 = Math.pow(2, numRounds);
    let playersWithByes: (string | null)[] = shuffleArray([...qualifiedPlayers]);
    while (playersWithByes.length < nextPowerOf2) playersWithByes.push(null);

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

    const matchesToInsert: KnockoutMatchInsert[] = [];
    const matchIdMatrix: string[][] = [];
    let firstRoundMatches: string[] = [];
    for (let i = 0; i < playersWithByes.length; i += 2) {
        const matchId = uuidv4();
        firstRoundMatches.push(matchId);
        const p1 = playersWithByes[i];
        const p2 = playersWithByes[i + 1];
        let status: TournamentMatch['status'] = 'pending';
        let winner = null;
        if (p1 && p2) status = 'scheduled';
        else if (p1 && !p2) {
            status = 'completed';
            winner = p1;
        } else if (!p1 && p2) {
            status = 'completed';
            winner = p2;
        }
        matchesToInsert.push({
            id: matchId,
            tournament_id: tournamentId,
            round: 2,
            match_number: i / 2 + 1,
            player1_id: p1,
            player2_id: p2,
            player1_score: winner === p1 ? 1 : null,
            player2_score: winner === p2 ? 1 : null,
            winner_id: winner,
            status,
            next_match_id: null,
            sets: null,
        });
    }
    matchIdMatrix.push(firstRoundMatches);

    for (let round = 3; round <= numRounds + 1; round++) {
        const prevRoundMatches = matchIdMatrix[round - 3];
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
                sets: null,
            });
        }
        matchIdMatrix.push(currRoundMatches);
    }

    const {error} = await supabase.from('tournament_matches').insert(
        matchesToInsert.map(match => ({
            ...match,
            sets: match.sets ? JSON.stringify(match.sets) : null,
        }))
    );
    if (error) throw error;
}

/**
 * Automatically selects the winner of a round-robin tournament based on detailed tie-breaking rules.
 * @param tournamentId - ID of the tournament.
 * @returns The winner's player ID or null if unable to determine.
 */
async function autoSelectRoundRobinWinner(tournamentId: string): Promise<string | null> {
    try {
        const {data: tournamentData, error: tournamentError} = await supabase
            .from('tournaments')
            .select('*, tournament_matches(*)')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournamentData) return null;

        const matches: TournamentMatch[] = tournamentData.tournament_matches?.map(transformMatchData) || [];
        const allMatchesCompleted = matches.every(m => m.status === 'completed');
        if (!allMatchesCompleted || matches.length === 0) return null;

        const playerStats: Record<string, {
            playerId: string;
            mainPoints: number;
            matchesPlayed: number;
            matchesWon: number;
            setsWon: number;
            setsLost: number;
            smallPointsWon: number;
            smallPointsLost: number;
            headToHead: Record<string, number>;
        }> = {};

        const playerIds = new Set<string>();
        matches.forEach(match => {
            if (match.player1Id) playerIds.add(match.player1Id);
            if (match.player2Id) playerIds.add(match.player2Id);
        });

        playerIds.forEach(playerId => {
            playerStats[playerId] = {
                playerId,
                mainPoints: 0,
                matchesPlayed: 0,
                matchesWon: 0,
                setsWon: 0,
                setsLost: 0,
                smallPointsWon: 0,
                smallPointsLost: 0,
                headToHead: {},
            };
        });

        matches.forEach(match => {
            if (match.status !== 'completed' || !match.player1Id || !match.player2Id) return;
            const player1 = playerStats[match.player1Id];
            const player2 = playerStats[match.player2Id];
            player1.matchesPlayed++;
            player2.matchesPlayed++;

            let p1SetsWon = 0;
            let p2SetsWon = 0;
            if (match.sets && Array.isArray(match.sets)) {
                match.sets.forEach(set => {
                    const p1Score = set.player1Score || 0;
                    const p2Score = set.player2Score || 0;
                    player1.smallPointsWon += p1Score;
                    player1.smallPointsLost += p2Score;
                    player2.smallPointsWon += p2Score;
                    player2.smallPointsLost += p1Score;
                    if (p1Score > p2Score) p1SetsWon++;
                    else if (p2Score > p1Score) p2SetsWon++;
                });
            }
            player1.setsWon += p1SetsWon;
            player1.setsLost += p2SetsWon;
            player2.setsWon += p2SetsWon;
            player2.setsLost += p1SetsWon;

            if (match.winner === match.player1Id) {
                player1.mainPoints += 2;
                player1.matchesWon++;
                player2.mainPoints += 1;
                player1.headToHead[match.player2Id] = 1;
                player2.headToHead[match.player1Id] = -1;
            } else if (match.winner === match.player2Id) {
                player2.mainPoints += 2;
                player2.matchesWon++;
                player1.mainPoints += 1;
                player2.headToHead[match.player1Id] = 1;
                player1.headToHead[match.player2Id] = -1;
            }
        });

        const rankedPlayers = Object.values(playerStats).sort((a, b) => {
            if (a.mainPoints !== b.mainPoints) return b.mainPoints - a.mainPoints;
            const aMatchRatio = a.matchesWon / (a.matchesPlayed || 1);
            const bMatchRatio = b.matchesWon / (b.matchesPlayed || 1);
            if (aMatchRatio !== bMatchRatio) return bMatchRatio - aMatchRatio;
            const aSetRatio = a.setsWon / (a.setsWon + a.setsLost || 1);
            const bSetRatio = b.setsWon / (b.setsWon + b.setsLost || 1);
            if (aSetRatio !== bSetRatio) return bSetRatio - aSetRatio;
            const aPointRatio = a.smallPointsWon / (a.smallPointsWon + a.smallPointsLost || 1);
            const bPointRatio = b.smallPointsWon / (b.smallPointsWon + b.smallPointsLost || 1);
            if (aPointRatio !== bPointRatio) return bPointRatio - aPointRatio;
            if (a.headToHead[b.playerId] !== undefined) return a.headToHead[b.playerId] > 0 ? -1 : 1;
            return 0;
        });

        if (rankedPlayers.length > 0) {
            const winner = rankedPlayers[0];
            const {error} = await supabase
                .from('tournaments')
                .update({winner_id: winner.playerId, status: 'completed'})
                .eq('id', tournamentId);

            if (error) return null;

            try {
                const playerStore = usePlayerStore.getState();
                const winnerPlayer = playerStore.getPlayerById(winner.playerId);
                const tournamentStore = useTournamentStore.getState();
                const tournament = tournamentStore.getTournamentById(tournamentId);
                if (winnerPlayer && tournament) {
                    const winnerNickname = winnerPlayer.nickname || 'Unknown Player';
                    const metadata: TournamentWonMetadata = {
                        notification_type: 'tournament_won',
                        winnerNickname,
                        tournamentName: tournament.name,
                        tournamentId: tournament.id,
                    };
                    await dispatchSystemNotification('tournament_won', metadata);
                }
            } catch (e) {
                console.warn("Failed to dispatch tournament_won notification", e);
            }
            return winner.playerId;
        }
        return null;
    } catch (error) {
        console.error(`Error selecting winner:`, error);
        return null;
    }
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
    tournaments: [],
    loading: false,
    error: null,
    lastFetchTimestamp: null,

    /**
     * Handles real-time updates for tournaments.
     * @param payload - The payload from Supabase real-time changes.
     */
    handleTournamentUpdate: (payload) => {
        const {eventType, new: newRecord, old} = payload;
        set(state => {
            let tournaments = [...state.tournaments];
            const index = tournaments.findIndex(t => t.id === (eventType === 'DELETE' ? old.id : newRecord.id));
            if (eventType === 'INSERT' && index === -1) {
                tournaments.push({...newRecord, matches: []});
            } else if (eventType === 'UPDATE' && index !== -1) {
                tournaments[index] = {...tournaments[index], ...newRecord};
            } else if (eventType === 'DELETE' && index !== -1) {
                tournaments = tournaments.filter(t => t.id !== old.id);
            }
            return {tournaments};
        });
    },

    /**
     * Handles real-time updates for tournament matches.
     * @param payload - The payload from Supabase real-time changes.
     */
    handleMatchUpdate: (payload) => {
        const {eventType, new: newRecord, old} = payload;
        set(state => ({
            tournaments: state.tournaments.map(t => {
                if (t.id !== newRecord.tournament_id) return t;
                let matches = [...(t.matches || [])];
                const index = matches.findIndex(m => m.id === (eventType === 'DELETE' ? old.id : newRecord.id));
                if (eventType === 'INSERT' && index === -1) {
                    matches.push(transformMatchData(newRecord));
                } else if (eventType === 'UPDATE' && index !== -1) {
                    matches[index] = transformMatchData(newRecord);
                } else if (eventType === 'DELETE' && index !== -1) {
                    matches = matches.filter(m => m.id !== old.id);
                }
                return {...t, matches};
            }),
        }));
    },

    /**
     * Fetches all tournaments from the database, with optional force refresh.
     * @param options - Optional parameters, including force refresh.
     */
    fetchTournaments: async (options = {}) => {
        const {force = false} = options;
        if (get().loading && !force) return;
        const lastFetch = get().lastFetchTimestamp;
        const now = Date.now();
        const FETCH_INTERVAL = 1500;
        if (lastFetch && now - lastFetch < FETCH_INTERVAL && !force) return;

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

            if (error) throw error;
            if (!rawTournaments) {
                set({tournaments: [], loading: false, lastFetchTimestamp: now});
                return;
            }

            const processedTournaments: Tournament[] = rawTournaments.map(t => ({
                id: t.id,
                name: t.name,
                date: t.date,
                format: t.format as TournamentFormat,
                status: t.status as TournamentStatus,
                participants: (t.tournament_participants || []).map(p => p.player_id),
                matches: (t.tournament_matches || []).map(transformMatchData),
                winner: t.winner_id ?? undefined,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            }));

            processedTournaments.sort((a, b) => {
                const statusOrder = {
                    [TournamentStatus.IN_PROGRESS]: 1,
                    [TournamentStatus.UPCOMING]: 2,
                    [TournamentStatus.COMPLETED]: 3
                };
                if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });

            set({tournaments: processedTournaments, loading: false, lastFetchTimestamp: now});
        } catch (error: any) {
            set({error: error.message || 'Failed to fetch tournaments', loading: false});
        }
    },

    /**
     * Creates a new tournament and adds participants.
     * @param name - Name of the tournament.
     * @param date - Date of the tournament.
     * @param format - Format of the tournament.
     * @param playerIds - Array of participant player IDs.
     * @returns The ID of the created tournament or undefined on failure.
     */
    createTournament: async (name, date, format, playerIds) => {
        set({loading: true, error: null});
        let tournamentId: string | undefined;
        try {
            if (playerIds.length < 2) throw new Error('Minimum 2 players required');
            if (format === TournamentFormat.KNOCKOUT && playerIds.length % 4 !== 0) throw new Error('Knockout tournaments require an even number of players');

            let finalName = name.trim() || await generateDefaultTournamentName();
            const {data, error} = await supabase.from('tournaments').insert({
                name: finalName,
                date,
                format,
                status: 'pending'
            }).select().single();
            if (error) throw error;
            tournamentId = data.id;

            const participants = playerIds.map(pid => ({tournament_id: tournamentId, player_id: pid}));
            const {error: pError} = await supabase.from('tournament_participants').insert(participants);
            if (pError) throw pError;

            await get().fetchTournaments({force: true});
            set({loading: false});
            return tournamentId;
        } catch (error: any) {
            if (tournamentId) {
                await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
                await supabase.from('tournaments').delete().eq('id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to create tournament'});
            return undefined;
        }
    },

    /**
     * Generates matches and starts the tournament.
     * @param tournamentId - ID of the tournament to start.
     */
    generateAndStartTournament: async (tournamentId) => {
        set({loading: true, error: null});
        try {
            const tournament = get().getTournamentById(tournamentId);
            if (!tournament) throw new Error('Tournament not found');
            if (tournament.status !== 'pending') throw new Error('Tournament not in pending state');

            const {count, error: countError} = await supabase.from('tournament_matches').select('*', {
                count: 'exact',
                head: true
            }).eq('tournament_id', tournamentId);
            if (countError) throw countError;
            if (count && count > 0) throw new Error('Matches already generated');

            const {
                data: participantsData,
                error: pError
            } = await supabase.from('tournament_participants').select('player_id').eq('tournament_id', tournamentId);
            if (pError) throw pError;
            const playerIds = participantsData?.map(p => p.player_id) || [];
            if (playerIds.length < 2) throw new Error('Not enough participants');

            if (tournament.format === TournamentFormat.KNOCKOUT && playerIds.length % 4 !== 0) throw new Error('Knockout requires even number of players');

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

            let matchesToInsert: TournamentMatchInsert[] = [];
            if (tournament.format === 'ROUND_ROBIN') {
                const schedule = generateRoundRobinSchedule(playerIds);
                matchesToInsert = schedule.map((match, index) => ({
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
            } else if (tournament.format === 'GROUP') {
                const numGroups = Math.min(4, Math.ceil(playerIds.length / 3));
                const groups = generateGroups(playerIds, numGroups);
                const groupMatches = generateGroupMatches(tournamentId, groups);
                matchesToInsert = groupMatches.map((match, index) => ({
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
                    group: match.group,
                }));
            } else {
                // Knockout format
                const numPlayers = playerIds.length;
                const numRounds = Math.ceil(Math.log2(numPlayers));
                const matchIdMatrix: string[][] = [];
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
                    if (p1 && p2) status = 'scheduled';
                    else if (p1 && !p2) {
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
                        status,
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
            }

            const {error} = await supabase.rpc('start_tournament', {
                p_tournament_id: tournamentId,
                p_matches: matchesToInsert,
            });
            if (error) throw error;

            await get().fetchTournaments({force: true});
            set({loading: false});
        } catch (error: any) {
            set({loading: false, error: error.message || 'Failed to generate and start tournament'});
        }
    },

    /**
     * Generates additional matches for the tournament, e.g., knockout phase after groups.
     * @param tournamentId - ID of the tournament.
     */
    generateTournamentMatches: async (tournamentId) => {
        const tournament = get().getTournamentById(tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        if (tournament.format !== TournamentFormat.GROUP) return;

        set({loading: true, error: null});
        try {
            const groupMatches = get().getTournamentMatches(tournamentId).filter(m => m.round === 1);
            const {
                data: participantsData,
                error
            } = await supabase.from('tournament_participants').select('player_id').eq('tournament_id', tournamentId);
            if (error) throw error;
            const playerIds = participantsData.map(p => p.player_id);

            const groups = Array.from(new Set(groupMatches.map(m => m.group).filter(g => g != null))).map(groupNum => {
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
            await get().fetchTournaments({force: true});
            set({loading: false});
        } catch (error: any) {
            set({loading: false, error: error.message || 'Failed to generate matches'});
        }
    },

    /**
     * Updates the result of a match and propagates changes (e.g., next matches, winner).
     * @param tournamentId - ID of the tournament.
     * @param matchId - ID of the match to update.
     * @param scores - Scores and sets for the match.
     */
    updateMatchResult: async (tournamentId, matchId, scores) => {
        const tournament = get().getTournamentById(tournamentId);
        const match = tournament?.matches.find(m => m.id === matchId);
        if (!tournament || !match) {
            set({error: 'Tournament or match not found'});
            return;
        }

        // Optimistic update for updating flag
        set(state => ({
            tournaments: state.tournaments.map(t => t.id !== tournamentId ? t : {
                ...t,
                matches: t.matches.map(m => m.id !== matchId ? m : {...m, isUpdating: true}),
            }),
        }));

        try {
            let p1FinalScore = scores.player1Score;
            let p2FinalScore = scores.player2Score;
            if (scores.sets?.length) {
                p1FinalScore = scores.sets.filter(s => s.player1Score > s.player2Score).length;
                p2FinalScore = scores.sets.filter(s => s.player2Score > s.player1Score).length;
            }
            if (p1FinalScore === p2FinalScore) throw new Error('Match score cannot be a draw');

            const winnerId = p1FinalScore > p2FinalScore ? match.player1Id : match.player2Id;

            const matchStore = useMatchStore.getState();
            const newMatch = await matchStore.addMatch({
                player1Id: match.player1Id!,
                player2Id: match.player2Id!,
                player1Score: p1FinalScore,
                player2Score: p2FinalScore,
                sets: scores.sets || [],
                tournamentId,
            });

            const updateData = {
                player1_score: p1FinalScore,
                player2_score: p2FinalScore,
                winner_id: winnerId,
                status: 'completed',
                sets: scores.sets,
                match_id: newMatch?.id,
            };

            const {error} = await supabase.from('tournament_matches').update(updateData).eq('id', matchId);
            if (error) throw error;

            if (match.nextMatchId) {
                const nextMatch = tournament.matches.find(m => m.id === match.nextMatchId);
                if (nextMatch) {
                    const nextUpdate: {
                        player1_id?: string;
                        player2_id?: string;
                        status?: TournamentMatch['status']
                    } = {};
                    if (nextMatch.player1Id === null) nextUpdate.player1_id = winnerId!;
                    else if (nextMatch.player2Id === null) nextUpdate.player2_id = winnerId!;
                    if (nextUpdate.player1_id || nextUpdate.player2_id) nextUpdate.status = 'scheduled';
                    if (Object.keys(nextUpdate).length) await supabase.from('tournament_matches').update(nextUpdate).eq('id', match.nextMatchId);
                }
            } else {
                const {data: freshTournament} = await supabase.from('tournaments').select('*, tournament_matches(status)').eq('id', tournamentId).single();
                const allCompleted = freshTournament?.tournament_matches.every((m: any) => m.status === 'completed');
                if (allCompleted) {
                    if (tournament.format === TournamentFormat.KNOCKOUT) await get().setTournamentWinner(tournamentId, winnerId!);
                    else if (tournament.format === TournamentFormat.ROUND_ROBIN) await autoSelectRoundRobinWinner(tournamentId);
                }
            }

            await get().fetchTournaments({force: true});
        } catch (error: any) {
            set({error: error.message || 'Failed to update match'});
        } finally {
            set(state => ({
                tournaments: state.tournaments.map(t => t.id !== tournamentId ? t : {
                    ...t,
                    matches: t.matches.map(m => m.id !== matchId ? m : {...m, isUpdating: false}),
                }),
            }));
        }
    },

    /**
     * Retrieves a tournament by its ID.
     * @param id - Tournament ID.
     * @returns The tournament or undefined if not found.
     */
    getTournamentById: id => get().tournaments.find(t => t.id === id),

    /**
     * Retrieves matches for a specific tournament.
     * @param tournamentId - Tournament ID.
     * @returns Array of tournament matches.
     */
    getTournamentMatches: tournamentId => {
        const tournament = get().getTournamentById(tournamentId);
        return (tournament?.matches || []).map(m => ({
            ...m,
            status: m.status === 'pending_players' ? 'pending' : m.status,
            player1Score: m.player1Score ?? null,
            player2Score: m.player2Score ?? null,
            nextMatchId: m.nextMatchId ?? null,
            matchId: m.matchId ?? m.id ?? null,
        }));
    },

    /**
     * Updates the status of a tournament.
     * @param tournamentId - Tournament ID.
     * @param status - New status.
     */
    updateTournamentStatus: async (tournamentId, status) => {
        set(state => ({
            tournaments: state.tournaments.map(t => t.id === tournamentId ? {...t, status} : t),
        }));
        const {error} = await supabase.from('tournaments').update({status}).eq('id', tournamentId);
        if (error) await get().fetchTournaments();
    },

    /**
     * Sets the winner of a tournament and marks it as completed.
     * @param tournamentId - Tournament ID.
     * @param winnerId - Winner's player ID.
     */
    setTournamentWinner: async (tournamentId, winnerId) => {
        if (!winnerId) return;
        set({loading: true, error: null});
        try {
            set(state => ({
                tournaments: state.tournaments.map(t => t.id !== tournamentId ? t : {
                    ...t,
                    winner: winnerId,
                    status: TournamentStatus.COMPLETED,
                }),
            }));

            const {error} = await supabase.from('tournaments').update({
                winner_id: winnerId,
                status: TournamentStatus.COMPLETED,
            }).eq('id', tournamentId);
            if (error) throw error;

            const tournament = get().getTournamentById(tournamentId);
            const playerStore = usePlayerStore.getState();
            const winner = playerStore.getPlayerById(winnerId);
            if (tournament && winner) {
                const winnerNickname = winner.nickname || 'Unknown Player';
                await dispatchSystemNotification('tournament_won', {
                    notification_type: 'tournament_won',
                    winnerNickname,
                    tournamentName: tournament.name,
                    tournamentId: tournament.id,
                });
            }

            await get().fetchTournaments();
            set({loading: false});
        } catch (error: any) {
            set({error: error.message || 'Failed to set winner', loading: false});
        }
    },

    /**
     * Retrieves upcoming tournaments.
     * @returns Array of pending tournaments.
     */
    getUpcomingTournaments: () => get().tournaments.filter(t => t.status === 'pending'),

    /**
     * Retrieves active tournaments.
     * @returns Array of in-progress tournaments.
     */
    getActiveTournaments: () => get().tournaments.filter(t => t.status === 'active'),

    /**
     * Retrieves completed tournaments.
     * @returns Array of completed tournaments.
     */
    getCompletedTournaments: () => get().tournaments.filter(t => t.status === 'completed'),

    /**
     * Counts the number of tournament wins for a player.
     * @param playerId - Player ID.
     * @returns Number of wins.
     */
    getPlayerTournamentWins: playerId => get().tournaments.filter(t => t.status === TournamentStatus.COMPLETED && t.winner === playerId).length,
}));

/**
 * Hook to subscribe to real-time updates for tournaments and matches.
 */
export function useTournamentsRealtime() {
    useEffect(() => {
        const handleChanges = (payload: RealtimePostgresChangesPayload<any>) => {
            const store = useTournamentStore.getState();
            if (payload.table === 'tournaments') store.handleTournamentUpdate(payload);
            else if (payload.table === 'tournament_matches') store.handleMatchUpdate(payload);
        };

        const channel = getTournamentChannel();
        if (channel && channel.state !== 'joined') {
            channel
                .on('postgres_changes', {event: '*', schema: 'public', table: 'tournaments'}, handleChanges)
                .on('postgres_changes', {event: '*', schema: 'public', table: 'tournament_matches'}, handleChanges)
                .subscribe();
        }
    }, []);
}

/**
 * Generates a default name for a new tournament by finding the next available number.
 * @returns A promise resolving to the default name.
 */
async function generateDefaultTournamentName(): Promise<string> {
    const {data, error} = await supabase.from('tournaments').select('name').ilike('name', 'Tournament %');
    if (error) return 'Tournament 1';
    let maxNumber = 0;
    data.forEach(t => {
        const match = t.name.match(/Tournament (\d+)/);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNumber) maxNumber = num;
        }
    });
    return `Tournament ${maxNumber + 1}`;
}
