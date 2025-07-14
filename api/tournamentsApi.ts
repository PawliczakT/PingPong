//api/tournamentsApi.ts
import {supabase} from '@/app/lib/supabase';
import {v4 as uuidv4} from 'uuid';
import type {Set as MatchSet} from '@/backend/types';
import {Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/backend/types';
import {dispatchSystemNotification} from '@/backend/server/trpc/services/notificationService';
import {usePlayerStore} from '@/store/playerStore';
import {useMatchStore} from "@/store/matchStore";

export const transformMatchData = (match: any): TournamentMatch => ({
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

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateRoundRobinSchedule(playerIds: string[]): { player1Id: string; player2Id: string }[] {
    const schedule: { player1Id: string; player2Id: string }[] = [];
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            schedule.push({player1Id: playerIds[i], player2Id: playerIds[j]});
        }
    }
    return schedule;
}

function generateGroups(playerIds: string[], numGroups: number): string[][] {
    const shuffledPlayers = shuffleArray([...playerIds]);
    const groups: string[][] = Array.from({length: numGroups}, () => []);
    shuffledPlayers.forEach((playerId, index) => groups[index % numGroups].push(playerId));
    return groups;
}

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
        matchesToInsert.map(match => ({...match, sets: match.sets ? JSON.stringify(match.sets) : null}))
    );
    if (error) throw error;
}

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
            await setTournamentWinner({tournamentId, winnerId: winner.playerId});
            return winner.playerId;
        }
        return null;
    } catch (error) {
        console.error(`Error selecting winner:`, error);
        return null;
    }
}

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

export const fetchTournamentById = async (id: string): Promise<Tournament | null> => {
    if (!id) return null;
    const {data, error} = await supabase
        .from('tournaments')
        .select('*, tournament_participants(player_id), tournament_matches(*)')
        .eq('id', id)
        .single();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
        ...data,
        participants: (data.tournament_participants || []).map(p => p.player_id),
        matches: (data.tournament_matches || []).map(transformMatchData),
    } as Tournament;
};

export const fetchTournaments = async (): Promise<Tournament[]> => {
    const {data: rawTournaments, error} = await supabase
        .from('tournaments')
        .select(`
          id, name, date, format, status, winner_id, created_at, updated_at,
          tournament_participants ( player_id ),
          tournament_matches ( * )
        `)
        .order('date', {ascending: false});

    if (error) throw new Error(error.message);
    if (!rawTournaments) return [];

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
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return processedTournaments;
};

export const createTournament = async (params: {
    name: string,
    date: string,
    format: TournamentFormat,
    playerIds: string[]
}): Promise<Tournament> => {
    const {name, date, format, playerIds} = params;
    let tournamentId: string | undefined;
    try {
        if (playerIds.length < 2) throw new Error('Minimum 2 players required');
        if (format === TournamentFormat.KNOCKOUT && playerIds.length % 4 !== 0) throw new Error('Knockout tournaments require a number of players divisible by 4');

        const finalName = name.trim() || await generateDefaultTournamentName();
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

        const {data: createdTournament} = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();

        return {...createdTournament, participants: playerIds, matches: []} as Tournament;
    } catch (error: any) {
        if (tournamentId) {
            await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
            await supabase.from('tournaments').delete().eq('id', tournamentId);
        }
        throw error;
    }
};

export const generateAndStartTournament = async (params: {
    tournamentId: string,
    format: TournamentFormat,
    playerIds: string[]
}): Promise<void> => {
    const {tournamentId, format, playerIds} = params;
    const {count, error: countError} = await supabase.from('tournament_matches').select('*', {
        count: 'exact',
        head: true
    }).eq('tournament_id', tournamentId);

    if (countError) throw countError;
    if (count && count > 0) throw new Error('Matches for this tournament have already been generated.');
    if (playerIds.length < 2) throw new Error('Not enough participants to start the tournament.');
    if (format === TournamentFormat.KNOCKOUT && playerIds.length % 4 !== 0) {
        throw new Error('Knockout tournaments require a number of players divisible by 4.');
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

    let matchesToInsert: TournamentMatchInsert[] = [];

    if (format === 'ROUND_ROBIN') {
        const schedule = generateRoundRobinSchedule(playerIds);
        matchesToInsert = schedule.map((match, index) => ({
            id: uuidv4(),
            tournament_id: tournamentId,
            round: 1,
            match_number: index + 1,
            player1_id: match.player1Id,
            player2_id: match.player2Id,
            player1_score: null, player2_score: null, winner_id: null,
            status: 'scheduled',
            next_match_id: null,
        }));
    } else if (format === 'GROUP') {
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
            player1_score: null, player2_score: null, winner_id: null,
            status: 'scheduled',
            next_match_id: null,
            group: match.group,
        }));
    } else { // KNOCKOUT
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
                    player1_id: null, player2_id: null, player1_score: null, player2_score: null, winner_id: null,
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
};

export const updateMatchResult = async (params: {
    tournamentId: string,
    matchId: string,
    scores: { player1Score: number, player2Score: number, sets?: MatchSet[] }
}): Promise<void> => {
    const {tournamentId, matchId, scores} = params;

    const {data: matchData, error: matchError} = await supabase
        .from('tournament_matches')
        .select('player1_id, player2_id')
        .eq('id', matchId)
        .single();

    if (matchError || !matchData) throw new Error('Match not found');

    let p1FinalScore = scores.player1Score;
    let p2FinalScore = scores.player2Score;
    if (scores.sets?.length) {
        p1FinalScore = scores.sets.filter(s => s.player1Score > s.player2Score).length;
        p2FinalScore = scores.sets.filter(s => s.player2Score > s.player1Score).length;
    }
    if (p1FinalScore === p2FinalScore) throw new Error('Match score cannot be a draw');

    const winnerId = p1FinalScore > p2FinalScore ? matchData.player1_id : matchData.player2_id;
    const matchStore = useMatchStore.getState();
    const newMatch = await matchStore.addMatch({
        player1Id: matchData.player1_id!,
        player2Id: matchData.player2_id!,
        player1Score: p1FinalScore,
        player2Score: p2FinalScore,
        sets: scores.sets || [],
        tournamentId,
    });

    const {error} = await supabase.rpc('complete_match_and_progress', {
        p_match_id: matchId,
        p_p1_score: p1FinalScore,
        p_p2_score: p2FinalScore,
        p_winner_id: winnerId,
        p_sets: scores.sets,
        p_new_match_log_id: newMatch?.id,
    });

    if (error) {
        console.error("RPC 'complete_match_and_progress' failed:", error);
        throw error;
    }
};

export const setTournamentWinner = async (params: { tournamentId: string, winnerId: string }): Promise<void> => {
    const {tournamentId, winnerId} = params;
    if (!winnerId) return;

    const {error} = await supabase.from('tournaments').update({
        winner_id: winnerId,
        status: TournamentStatus.COMPLETED,
    }).eq('id', tournamentId);

    if (error) throw error;

    const {data: tournament} = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
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
};

export const generateTournamentMatches = async (params: { tournamentId: string }): Promise<void> => {
    const {tournamentId} = params;

    const {
        data: tournament,
        error: tError
    } = await supabase.from('tournaments').select('*, tournament_matches(*)').eq('id', tournamentId).single();
    if (tError || !tournament) throw new Error('Tournament not found');
    if (tournament.format !== TournamentFormat.GROUP) return;

    const groupMatches = tournament.tournament_matches.filter(m => m.round === 1).map(transformMatchData);

    const {
        data: participantsData,
        error: pError
    } = await supabase.from('tournament_participants').select('player_id').eq('tournament_id', tournamentId);
    if (pError) throw pError;

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
};
