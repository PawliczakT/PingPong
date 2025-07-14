import {supabase} from '@/app/lib/supabase';
import {v4 as uuidv4} from 'uuid';
import type {MatchSet, TournamentMatch} from './tournamentTypes';
import {TournamentStatus} from '@/backend/types';
import {usePlayerStore} from '../playerStore';
import type {TournamentWonMetadata} from '@/backend/server/trpc/services/notificationService';
import {dispatchSystemNotification} from '@/backend/server/trpc/services/notificationService';

export const transformMatchData = (match: any): TournamentMatch => {
    return {
        id: match.id,
        tournamentId: match.tournament_id,
        round: match.round,
        matchNumber: match.match_number,
        matchId: match.match_id, // Ensure this field is handled if it's different from id
        player1Id: match.player1_id,
        player2Id: match.player2_id,
        player1Score: match.player1_score,
        player2Score: match.player2_score,
        winner: match.winner_id, // Supabase uses winner_id
        status: match.status,
        nextMatchId: match.next_match_id,
        sets: match.sets, // Assuming sets are correctly formatted or null
        group: match.group,
        // Properties like 'winner' (if it's a derived field client-side),
        // 'roundName', 'startTime', 'isUpdating' were in the original processing logic
        // but might be better handled in the state or UI layer if not directly from DB.
        // For now, sticking to direct DB fields.
    };
};

export function shuffleArray<T>(array: T[]): T[] {
    let currentIndex = array.length, randomIndex;
    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

export function generateRoundRobinSchedule(playerIds: string[]): { player1Id: string, player2Id: string }[] {
    const schedule: { player1Id: string, player2Id: string }[] = [];
    if (playerIds.length < 2) return schedule;
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            schedule.push({player1Id: playerIds[i], player2Id: playerIds[j]});
        }
    }
    return schedule;
}

export function generateGroups(playerIds: string[], numGroups: number): string[][] {
    if (numGroups <= 0) throw new Error("Number of groups must be positive.");
    const shuffledPlayers = shuffleArray([...playerIds]);
    const groups: string[][] = Array.from({length: numGroups}, () => []);

    shuffledPlayers.forEach((playerId, index) => {
        const groupIndex = index % numGroups;
        groups[groupIndex].push(playerId);
    });

    return groups;
}

export function generateGroupMatches(groups: string[][]): { player1Id: string, player2Id: string, group: number }[] {
    const matches: { player1Id: string, player2Id: string, group: number }[] = [];

    groups.forEach((group, groupIndex) => {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                matches.push({
                    player1Id: group[i],
                    player2Id: group[j],
                    group: groupIndex + 1 // 1-indexed group number
                });
            }
        }
    });
    return matches;
}

export function getTopPlayersFromGroups(groups: string[][], completedGroupMatches: TournamentMatch[]): string[] {
    const qualifiers: string[] = [];

    groups.forEach((group, groupIndex) => {
        const groupNumber = groupIndex + 1; // 1-indexed group number
        const currentGroupMatches = completedGroupMatches.filter(m => m.group === groupNumber && m.status === 'completed');
        const playerStats: Record<string, { played: number, wins: number, points: number, pointsDiff: number }> = {};

        group.forEach(playerId => {
            playerStats[playerId] = {played: 0, wins: 0, points: 0, pointsDiff: 0};
        });

        currentGroupMatches.forEach(match => {
            if (!match.player1Id || !match.player2Id || match.player1Score === null || match.player2Score === null) return;

            const p1 = match.player1Id;
            const p2 = match.player2Id;

            // Ensure players from the match are part of the current group's stats
            if (playerStats[p1]) {
                playerStats[p1].played++;
                playerStats[p1].points += match.player1Score;
                playerStats[p1].pointsDiff += match.player1Score - match.player2Score;
                if (match.winner === p1) playerStats[p1].wins++;
            }
            if (playerStats[p2]) {
                playerStats[p2].played++;
                playerStats[p2].points += match.player2Score;
                playerStats[p2].pointsDiff += match.player2Score - match.player1Score;
                if (match.winner === p2) playerStats[p2].wins++;
            }
        });

        const sortedPlayersInGroup = group.sort((a, b) => {
            const statsA = playerStats[a];
            const statsB = playerStats[b];

            if (statsA.wins !== statsB.wins) return statsB.wins - statsA.wins;
            if (statsA.pointsDiff !== statsB.pointsDiff) return statsB.pointsDiff - statsA.pointsDiff;
            if (statsA.points !== statsB.points) return statsB.points - statsA.points;
            return 0; // Keep original order if all else is equal, or implement further tie-breaking
        });

        if (sortedPlayersInGroup.length > 0) {
            qualifiers.push(sortedPlayersInGroup[0]); // Qualify the top player from each group
        }
    });

    return qualifiers;
}

type KnockoutMatchInsert = {
    id: string;
    tournament_id: string;
    round: number; // Round in the knockout phase (e.g., 2 for first knockout round after group stage)
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

export async function generateKnockoutPhase(
    tournamentId: string,
    qualifiedPlayers: string[],
    startingRound: number
): Promise<TournamentMatch[]> {
    if (qualifiedPlayers.length < 2 && qualifiedPlayers.length !== 0) { // Allow 0 for no qualifiers / error case
        // If only one player qualifies, they are the winner of this phase (potentially the tournament)
        // This case should ideally be handled by the calling logic (e.g. auto-awarding win)
        // or this function should return the single player as a "winner" of this phase.
        // For now, we'll assume this means no matches can be generated.
        console.warn("Not enough qualified players to generate a knockout phase with matches.");
        return [];
    }
    if (qualifiedPlayers.length === 0) {
        console.warn("No players qualified for the knockout phase.");
        return [];
    }


    const numPlayers = qualifiedPlayers.length;
    const numRoundsForPhase = numPlayers > 1 ? Math.ceil(Math.log2(numPlayers)) : 0;
    const nextPowerOf2 = numPlayers > 1 ? Math.pow(2, numRoundsForPhase) : numPlayers;

    let playersWithByes: (string | null)[] = [...qualifiedPlayers];

    // Add byes if necessary
    while (playersWithByes.length < nextPowerOf2 && playersWithByes.length > 0) {
        playersWithByes.push(null); // null represents a bye
    }

    playersWithByes = shuffleArray(playersWithByes);

    const matchesToInsert: KnockoutMatchInsert[] = [];
    let matchIdMatrix: string[][] = []; // Stores IDs of matches in each round

    // First round of the knockout phase
    const currentRoundMatchesIds: string[] = [];
    if (numPlayers > 1) {
        for (let i = 0; i < playersWithByes.length; i += 2) {
            const matchId = uuidv4();
            currentRoundMatchesIds.push(matchId);

            const p1 = playersWithByes[i];
            const p2 = playersWithByes[i + 1];
            let status: TournamentMatch['status'] = 'pending';
            let winnerId = null;
            let p1Score = null;
            let p2Score = null;

            if (p1 && p2) {
                status = 'scheduled';
            } else if (p1 && !p2) { // Player 1 gets a bye
                status = 'completed'; // Or 'bye' if you have such a status
                winnerId = p1;
                p1Score = 1; // Indicate win by bye
                p2Score = 0;
            } else if (!p1 && p2) { // Player 2 gets a bye (should not happen with current bye logic)
                status = 'completed';
                winnerId = p2;
                p1Score = 0;
                p2Score = 1;
            }
            // If both p1 and p2 are null, it's an empty match slot, status remains 'pending'

            matchesToInsert.push({
                id: matchId,
                tournament_id: tournamentId,
                round: startingRound,
                match_number: i / 2 + 1,
                player1_id: p1,
                player2_id: p2,
                player1_score: p1Score,
                player2_score: p2Score,
                winner_id: winnerId,
                status: status,
                next_match_id: null, // Will be set later
                sets: null,
            });
        }
        matchIdMatrix.push(currentRoundMatchesIds);
    }


    // Subsequent rounds of the knockout phase
    for (let r = 1; r < numRoundsForPhase; r++) {
        const prevRoundMatchIds = matchIdMatrix[r - 1];
        const nextRoundMatchIds: string[] = [];
        for (let i = 0; i < prevRoundMatchIds.length; i += 2) {
            const matchId = uuidv4();
            nextRoundMatchIds.push(matchId);

            // Link previous round matches to this new match
            const match1FromPrevRound = matchesToInsert.find(m => m.id === prevRoundMatchIds[i]);
            if (match1FromPrevRound) match1FromPrevRound.next_match_id = matchId;

            if (i + 1 < prevRoundMatchIds.length) {
                const match2FromPrevRound = matchesToInsert.find(m => m.id === prevRoundMatchIds[i + 1]);
                if (match2FromPrevRound) match2FromPrevRound.next_match_id = matchId;
            }

            matchesToInsert.push({
                id: matchId,
                tournament_id: tournamentId,
                round: startingRound + r,
                match_number: i / 2 + 1,
                player1_id: null, // Winners from previous round will populate this
                player2_id: null,
                player1_score: null,
                player2_score: null,
                winner_id: null,
                status: 'pending', // Pending winners from previous round
                next_match_id: null, // Null for final match, or set in next iteration
                sets: null,
            });
        }
        matchIdMatrix.push(nextRoundMatchIds);
    }

    if (matchesToInsert.length > 0) {
        const {error: dbError} = await supabase.from('tournament_matches').insert(
            matchesToInsert.map(m => ({
                ...m,
                sets: m.sets ? JSON.stringify(m.sets) : null, // Ensure sets are stringified
            }))
        );
        if (dbError) {
            console.error('Error inserting knockout matches:', dbError);
            throw dbError;
        }
    }

    // Transform to TournamentMatch[] before returning
    return matchesToInsert.map(transformMatchData);
}

export async function autoSelectRoundRobinWinner(
    tournamentId: string,
    completedMatches: TournamentMatch[],
    allPlayerIdsInTournament: string[],
    tournamentName: string
): Promise<string | null> {
    if (completedMatches.length === 0 || allPlayerIdsInTournament.length < 2) {
        console.warn("Not enough matches or players to determine a round-robin winner for tournament:", tournamentId);
        return null;
    }

    const playerStats: Record<string, {
        playerId: string;
        mainPoints: number; // 2 for win, 1 for loss (as per PZTS)
        matchesPlayed: number;
        matchesWon: number;
        setsWon: number;
        setsLost: number;
        smallPointsWon: number;
        smallPointsLost: number;
        headToHead: Record<string, number>; // 1 for win against opponent, -1 for loss
    }> = {};

    allPlayerIdsInTournament.forEach(playerId => {
        playerStats[playerId] = {
            playerId,
            mainPoints: 0,
            matchesPlayed: 0,
            matchesWon: 0,
            setsWon: 0,
            setsLost: 0,
            smallPointsWon: 0,
            smallPointsLost: 0,
            headToHead: {}
        };
    });

    completedMatches.forEach(match => {
        if (match.status !== 'completed' || !match.player1Id || !match.player2Id || !match.winner) return;

        const p1Id = match.player1Id;
        const p2Id = match.player2Id;

        // Ensure stats objects exist for both players
        if (!playerStats[p1Id]) playerStats[p1Id] = {
            playerId: p1Id,
            mainPoints: 0,
            matchesPlayed: 0,
            matchesWon: 0,
            setsWon: 0,
            setsLost: 0,
            smallPointsWon: 0,
            smallPointsLost: 0,
            headToHead: {}
        };
        if (!playerStats[p2Id]) playerStats[p2Id] = {
            playerId: p2Id,
            mainPoints: 0,
            matchesPlayed: 0,
            matchesWon: 0,
            setsWon: 0,
            setsLost: 0,
            smallPointsWon: 0,
            smallPointsLost: 0,
            headToHead: {}
        };


        const player1Stats = playerStats[p1Id];
        const player2Stats = playerStats[p2Id];

        player1Stats.matchesPlayed++;
        player2Stats.matchesPlayed++;

        let p1Sets = 0;
        let p2Sets = 0;

        if (match.sets && Array.isArray(match.sets)) {
            match.sets.forEach((set: MatchSet) => {
                const s1 = set.player1Score || 0;
                const s2 = set.player2Score || 0;
                player1Stats.smallPointsWon += s1;
                player1Stats.smallPointsLost += s2;
                player2Stats.smallPointsWon += s2;
                player2Stats.smallPointsLost += s1;
                if (s1 > s2) p1Sets++;
                else if (s2 > s1) p2Sets++;
            });
        } else { // Fallback if sets details are not available, use overall match score for sets
            if (match.player1Score !== null && match.player2Score !== null) {
                p1Sets = match.player1Score; // Assuming playerXScore is total sets won
                p2Sets = match.player2Score;
                // If playerXScore is small points, this logic needs adjustment
                // For now, assuming it represents sets won in the match
                player1Stats.smallPointsWon += match.player1Score; // Placeholder if actual small points aren't available
                player2Stats.smallPointsWon += match.player2Score;
            }
        }


        player1Stats.setsWon += p1Sets;
        player1Stats.setsLost += p2Sets;
        player2Stats.setsWon += p2Sets;
        player2Stats.setsLost += p1Sets;

        if (match.winner === p1Id) {
            player1Stats.mainPoints += 2;
            player1Stats.matchesWon++;
            player2Stats.mainPoints += 1; // PZTS: 1 point for a loss
            player1Stats.headToHead[p2Id] = 1; // p1 won against p2
            player2Stats.headToHead[p1Id] = -1; // p2 lost against p1
        } else if (match.winner === p2Id) {
            player2Stats.mainPoints += 2;
            player2Stats.matchesWon++;
            player1Stats.mainPoints += 1; // PZTS: 1 point for a loss
            player2Stats.headToHead[p1Id] = 1; // p2 won against p1
            player1Stats.headToHead[p2Id] = -1; // p1 lost against p2
        }
    });

    const rankedPlayers = Object.values(playerStats).sort((a, b) => {
        // 1. Main points
        if (a.mainPoints !== b.mainPoints) return b.mainPoints - a.mainPoints;

        // Tie-breaking for players with the same mainPoints
        const tiedPlayers = [a, b]; // In a full sort, this would be a sub-group
        // For direct comparison a vs b:
        // 2. Result of direct match (if only two players are tied)
        // This rule is more complex with >2 tied players (mini-league)
        // Simplified for a-b comparison:
        if (a.headToHead[b.playerId] !== undefined) {
            if (a.headToHead[b.playerId] > 0) return -1; // a won against b
            if (a.headToHead[b.playerId] < 0) return 1;  // b won against a
        }

        // 3. Sets ratio (Sets Won / Sets Lost) - higher is better
        // Avoid division by zero if Sets Lost is 0. A player with 0 sets lost is ranked higher.
        const aSetRatio = a.setsLost === 0 ? (a.setsWon > 0 ? Infinity : 0) : a.setsWon / a.setsLost;
        const bSetRatio = b.setsLost === 0 ? (b.setsWon > 0 ? Infinity : 0) : b.setsWon / b.setsLost;
        if (aSetRatio !== bSetRatio) return bSetRatio - aSetRatio;

        // 4. Small points ratio (Small Points Won / Small Points Lost) - higher is better
        const aSmallPointsRatio = a.smallPointsLost === 0 ? (a.smallPointsWon > 0 ? Infinity : 0) : a.smallPointsWon / a.smallPointsLost;
        const bSmallPointsRatio = b.smallPointsLost === 0 ? (b.smallPointsWon > 0 ? Infinity : 0) : b.smallPointsWon / b.smallPointsLost;
        if (aSmallPointsRatio !== bSmallPointsRatio) return bSmallPointsRatio - aSmallPointsRatio;

        return 0; // Further tie-breaking (e.g., draw lots) if needed
    });

    if (rankedPlayers.length > 0) {
        const winner = rankedPlayers[0];
        try {
            const {error} = await supabase
                .from('tournaments')
                .update({winner_id: winner.playerId, status: TournamentStatus.COMPLETED})
                .eq('id', tournamentId);

            if (error) {
                console.error(`Error updating tournament winner for ${tournamentId}:`, error);
                throw error; // Re-throw to be caught by action
            }

            // Dispatch notification
            const playerStore = usePlayerStore.getState();
            const winnerPlayer = playerStore.getPlayerById(winner.playerId);
            if (winnerPlayer) {
                const metadata: TournamentWonMetadata = {
                    notification_type: 'tournament_won',
                    winnerNickname: winnerPlayer.nickname || 'Unknown Player',
                    tournamentName: tournamentName, // Ensure tournament name is passed or fetched
                    tournamentId: tournamentId,
                };
                await dispatchSystemNotification('tournament_won', metadata);
            }
            return winner.playerId;
        } catch (e) {
            console.error('Failed in final stage of autoSelectRoundRobinWinner:', e);
            throw e; // Re-throw to be caught by action
        }
    }
    return null;
}
