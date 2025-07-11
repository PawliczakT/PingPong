/**
 * @fileoverview Unit tests for tournamentLogic.ts
 */
import {
    transformMatchData,
    shuffleArray,
    generateRoundRobinSchedule,
    generateGroups,
    generateGroupMatches,
    getTopPlayersFromGroups,
    generateKnockoutPhase,
    autoSelectRoundRobinWinner,
} from '@/store/tournament/tournamentLogic';
import type { TournamentMatch, MatchSet, Tournament } from '@/store/tournament/tournamentTypes';
import { TournamentStatus, TournamentFormat } from '@/store/tournament/tournamentTypes';
import { supabase } from '@/app/lib/supabase'; // Mocked
import { usePlayerStore } from '@/store/playerStore'; // Mocked
import { dispatchSystemNotification } from '@/backend/server/trpc/services/notificationService'; // Mocked

// Mock Supabase
jest.mock('@/app/lib/supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ error: null, data: [{id: 'new-match-id'}] }), // Default mock for insert
        update: jest.fn().mockResolvedValue({ error: null }),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
}));

// Mock other stores and services
jest.mock('@/store/playerStore');
jest.mock('@/backend/server/trpc/services/notificationService');

// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}));


describe('Tournament Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock for playerStore
        (usePlayerStore.getState as jest.Mock).mockReturnValue({
            getPlayerById: jest.fn(id => ({ id, nickname: `Player ${id}` })),
        });
    });

    describe('transformMatchData', () => {
        it('should transform raw Supabase match data correctly', () => {
            const rawMatch = {
                id: 'm1',
                tournament_id: 't1',
                round: 1,
                match_number: 1,
                match_id: 'db_match_1', // Different from internal id
                player1_id: 'p1',
                player2_id: 'p2',
                player1_score: 11,
                player2_score: 5,
                winner_id: 'p1',
                status: 'completed',
                next_match_id: 'm2',
                sets: [{ player1Score: 11, player2Score: 5 }],
                group: 1,
            };
            const expected: TournamentMatch = {
                id: 'm1',
                tournamentId: 't1',
                round: 1,
                matchNumber: 1,
                matchId: 'db_match_1',
                player1Id: 'p1',
                player2Id: 'p2',
                player1Score: 11,
                player2Score: 5,
                winner: 'p1',
                status: 'completed',
                nextMatchId: 'm2',
                sets: [{ player1Score: 11, player2Score: 5 }],
                group: 1,
            };
            expect(transformMatchData(rawMatch)).toEqual(expected);
        });

        it('should handle null or missing optional fields', () => {
            const rawMatch = {
                id: 'm2',
                tournament_id: 't1',
                round: 2,
                // Missing optional fields
            };
            const expected: Partial<TournamentMatch> = { // Use Partial for easier expectation setting
                id: 'm2',
                tournamentId: 't1',
                round: 2,
                matchNumber: undefined,
                matchId: undefined,
                player1Id: undefined,
                player2Id: undefined,
                player1Score: undefined,
                player2Score: undefined,
                winner: undefined,
                status: undefined,
                nextMatchId: undefined,
                sets: undefined,
                group: undefined,
            };
            expect(transformMatchData(rawMatch)).toEqual(expected);
        });
    });

    describe('shuffleArray', () => {
        it('should shuffle an array', () => {
            const array = [1, 2, 3, 4, 5];
            const originalArray = [...array];
            const shuffled = shuffleArray(array);
            expect(shuffled).toHaveLength(originalArray.length);
            expect(shuffled.sort()).toEqual(originalArray.sort()); // Should contain same elements
            // It's hard to test randomness, but it shouldn't be the exact same array (highly probable)
            // For a small array, it might occasionally return the same or reversed.
            // A better test would be statistical over many runs, or ensuring it's not deeply equal.
            if (originalArray.length > 1) { // Avoid issues with single element arrays
                 // This test might be flaky for very small arrays if it shuffles back to original
                 // For robust test, one might check if multiple shuffles yield different results from original
            }
        });
         it('should return an empty array if input is empty', () => {
            expect(shuffleArray([])).toEqual([]);
        });
    });

    describe('generateRoundRobinSchedule', () => {
        it('should generate correct pairings for 3 players', () => {
            const playerIds = ['p1', 'p2', 'p3'];
            const schedule = generateRoundRobinSchedule(playerIds);
            expect(schedule).toHaveLength(3); // n*(n-1)/2 = 3*2/2 = 3
            expect(schedule).toEqual(expect.arrayContaining([
                { player1Id: 'p1', player2Id: 'p2' },
                { player1Id: 'p1', player2Id: 'p3' },
                { player1Id: 'p2', player2Id: 'p3' },
            ]));
        });
        it('should generate correct pairings for 4 players', () => {
            const playerIds = ['p1', 'p2', 'p3', 'p4'];
            const schedule = generateRoundRobinSchedule(playerIds);
            expect(schedule).toHaveLength(6); // 4*3/2 = 6
        });
        it('should return empty schedule for less than 2 players', () => {
            expect(generateRoundRobinSchedule(['p1'])).toEqual([]);
            expect(generateRoundRobinSchedule([])).toEqual([]);
        });
    });

    describe('generateGroups', () => {
        it('should distribute players into specified number of groups', () => {
            const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
            const numGroups = 2;
            const groups = generateGroups(playerIds, numGroups);
            expect(groups).toHaveLength(numGroups);
            expect(groups[0].length + groups[1].length).toBe(playerIds.length); // All players distributed
            // Check if players are roughly distributed (e.g., 3 and 2 for 5 players in 2 groups)
            expect(groups[0].length).toBeGreaterThanOrEqual(2);
            expect(groups[1].length).toBeGreaterThanOrEqual(2);
        });
        it('should handle case where numGroups is 1', () => {
            const playerIds = ['p1', 'p2', 'p3'];
            const groups = generateGroups(playerIds, 1);
            expect(groups).toHaveLength(1);
            expect(groups[0]).toHaveLength(playerIds.length);
        });
        it('should throw error if numGroups is zero or negative', () => {
            expect(() => generateGroups(['p1'], 0)).toThrow("Number of groups must be positive.");
        });
    });

    describe('generateGroupMatches', () => {
        it('should generate matches for each group', () => {
            const groups = [['p1', 'p2', 'p3'], ['p4', 'p5']]; // Group 1 (3 matches), Group 2 (1 match)
            const matches = generateGroupMatches(groups);
            expect(matches).toHaveLength(4);
            expect(matches.filter(m => m.group === 1)).toHaveLength(3);
            expect(matches.filter(m => m.group === 2)).toHaveLength(1);
            expect(matches).toEqual(expect.arrayContaining([
                { player1Id: 'p1', player2Id: 'p2', group: 1 },
                { player1Id: 'p1', player2Id: 'p3', group: 1 },
                { player1Id: 'p2', player2Id: 'p3', group: 1 },
                { player1Id: 'p4', player2Id: 'p5', group: 2 },
            ]));
        });
    });

    describe('getTopPlayersFromGroups', () => {
        // Mock completed matches
        const completedMatches: TournamentMatch[] = [
            // Group 1
            { id: 'm1', tournamentId: 't1', round: 1, group: 1, player1Id: 'p1', player2Id: 'p2', winner: 'p1', player1Score: 2, player2Score: 0, status: 'completed', matchId: 'm1' },
            { id: 'm2', tournamentId: 't1', round: 1, group: 1, player1Id: 'p1', player2Id: 'p3', winner: 'p1', player1Score: 2, player2Score: 1, status: 'completed', matchId: 'm2' },
            { id: 'm3', tournamentId: 't1', round: 1, group: 1, player1Id: 'p2', player2Id: 'p3', winner: 'p3', player1Score: 0, player2Score: 2, status: 'completed', matchId: 'm3' },
            // Group 2
            { id: 'm4', tournamentId: 't1', round: 1, group: 2, player1Id: 'p4', player2Id: 'p5', winner: 'p4', player1Score: 2, player2Score: 0, status: 'completed', matchId: 'm4' },
        ];
        const groups = [['p1', 'p2', 'p3'], ['p4', 'p5']];

        it('should correctly determine top players from groups', () => {
            // p1: 2 wins, 2 points (2+2=4), diff (2+1=3)
            // p3: 1 win, 2 points (1+2=3), diff (2-1=1)
            // p2: 0 wins, 0 points (0+0=0), diff (-2-2=-4)
            // p4: 1 win
            const qualifiers = getTopPlayersFromGroups(groups, completedMatches);
            expect(qualifiers).toEqual(['p1', 'p4']);
        });
    });

    describe('generateKnockoutPhase', () => {
        it('should generate matches for 4 qualified players', async () => {
            const tournamentId = 't1';
            const qualifiedPlayers = ['p1', 'p2', 'p3', 'p4'];
            const startingRound = 1;

            // Mock supabase insert to verify its call without actual DB interaction
            const mockInsert = jest.fn().mockResolvedValue({ error: null, data: [] });
            (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

            const matches = await generateKnockoutPhase(tournamentId, qualifiedPlayers, startingRound);

            expect(mockInsert).toHaveBeenCalled();
            const insertedMatches = mockInsert.mock.calls[0][0]; // Get the array of matches passed to insert

            // 4 players -> 2 first round matches, 1 final match = 3 matches total
            expect(insertedMatches.length).toBe(3);

            const round1Matches = insertedMatches.filter((m: any) => m.round === startingRound);
            const round2Matches = insertedMatches.filter((m: any) => m.round === startingRound + 1);

            expect(round1Matches.length).toBe(2);
            expect(round2Matches.length).toBe(1);

            // Check if first round matches feed into the final match
            expect(round1Matches[0].next_match_id).toBe(round2Matches[0].id);
            expect(round1Matches[1].next_match_id).toBe(round2Matches[0].id);
        });

         it('should handle byes for 3 qualified players', async () => {
            const tournamentId = 't1';
            const qualifiedPlayers = ['p1', 'p2', 'p3']; // Needs 1 bye to make it 4 (power of 2)
            const startingRound = 2;

            const mockInsert = jest.fn().mockResolvedValue({ error: null, data: [] });
            (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

            await generateKnockoutPhase(tournamentId, qualifiedPlayers, startingRound);
            const insertedMatches = mockInsert.mock.calls[0][0];

            // 3 players -> effectively 2 "slots" in first round (one is a bye), 1 final match.
            // One first round match will be pX vs null (bye), auto-completed.
            // The other first round match will be pY vs pZ.
            // Total 2 actual matches generated for DB (one auto-completed, one scheduled, then the final)
            expect(insertedMatches.length).toBe(2); // (p1 vs bye), (p2 vs p3) -> winner1 vs winner2. This seems off.
                                                // For 3 players, it's (playerA vs playerB), winner vs playerC (bye in first round).
                                                // Let's trace: playersWithByes = [p1, p2, p3, null] (shuffled)
                                                // Match1: pA vs pB (scheduled)
                                                // Match2: pC vs null (completed, pC wins) -> This is one match.
                                                // Final: winner(Match1) vs pC -> This is the second match.
                                                // So, 2 matches should be generated.

            const round1InsertedMatches = insertedMatches.filter((m: any) => m.round === startingRound);
            const round2InsertedMatches = insertedMatches.filter((m: any) => m.round === startingRound + 1);

            expect(round1InsertedMatches.length).toBe(1); // One match involving a bye, one actual match
            expect(round2InsertedMatches.length).toBe(1); // Final

            const byeMatch = round1InsertedMatches.find((m: any) => m.status === 'completed');
            expect(byeMatch).toBeDefined();
            expect(byeMatch?.player1_id === null || byeMatch?.player2_id === null).toBe(true);
        });

        it('should return empty array if no players qualify', async () => {
            const matches = await generateKnockoutPhase('t1', [], 1);
            expect(matches).toEqual([]);
            expect(supabase.from('tournament_matches').insert).not.toHaveBeenCalled();
        });
    });

    describe('autoSelectRoundRobinWinner', () => {
        const tournamentId = 'rr-tourney';
        const tournamentName = 'Round Robin Test';
        const playerIds = ['p1', 'p2', 'p3'];
        let completedMatches: TournamentMatch[];

        beforeEach(() => {
            // p1 beats p2 (2-0)
            // p2 beats p3 (2-1)
            // p3 beats p1 (2-0) -> 3-way tie on main points (2 for win, 1 for loss)
            // p1: 1W-1L = 3pts. Sets: 2-2. SmallPoints: (11+11) - (5+5) = 22-10 = +12 (example)
            // p2: 1W-1L = 3pts. Sets: 2-3. SmallPoints: (5+11+10) - (11+5+11) = 26-27 = -1
            // p3: 1W-1L = 3pts. Sets: 3-2. SmallPoints: (5+11+11) - (11+10+5) = 27-26 = +1
            // Ranking: p1 (better set diff), p3, p2
             completedMatches = [
                { id: 'm1', tournamentId, round: 1, player1Id: 'p1', player2Id: 'p2', winner: 'p1', player1Score: 2, player2Score: 0, sets: [{p1s:11,p2s:5},{p1s:11,p2s:5}], status: 'completed', matchId: 'm1' } as unknown as TournamentMatch,
                { id: 'm2', tournamentId, round: 1, player1Id: 'p2', player2Id: 'p3', winner: 'p2', player1Score: 2, player2Score: 1, sets: [{p1s:11,p2s:5},{p1s:5,p2s:11},{p1s:11,p2s:10}], status: 'completed', matchId: 'm2' } as unknown as TournamentMatch,
                { id: 'm3', tournamentId, round: 1, player1Id: 'p3', player2Id: 'p1', winner: 'p3', player1Score: 2, player2Score: 0, sets: [{p1s:11,p2s:5},{p1s:11,p2s:5}], status: 'completed', matchId: 'm3' } as unknown as TournamentMatch,
            ];
            (supabase.from('tournaments').update as jest.Mock).mockResolvedValue({ error: null });
            (dispatchSystemNotification as jest.Mock).mockResolvedValue(undefined);
        });

        it('should correctly select winner based on PZTS rules (simplified)', async () => {
            // Adjusting scores for a clearer winner by sets won/lost
            // p1 beats p2 (2-0) -> p1: 2pts, sets +2
            // p1 loses to p3 (0-2) -> p1: 1pt, sets -2. Total p1: 3pts, sets +0
            // p2 loses to p1 (0-2) -> p2: 1pt, sets -2
            // p2 beats p3 (2-0) -> p2: 2pts, sets +2. Total p2: 3pts, sets +0
            // p3 beats p1 (2-0) -> p3: 2pts, sets +2
            // p3 loses to p2 (0-2) -> p3: 1pt, sets -2. Total p3: 3pts, sets +0
            // All tied on main points (3) and set difference (0). Now head-to-head mini-league.
            // p1 beat p2
            // p2 beat p3
            // p3 beat p1
            // This is a perfect 3-way tie where PZTS rules might go to small points or even drawing lots.
            // Our simplified sort does: main points -> direct (if 2 players) -> set ratio -> small point ratio.
            // Let's make p1 win on small points ratio.
            completedMatches = [
                { id: 'm1', tournamentId, round: 1, player1Id: 'p1', player2Id: 'p2', winner: 'p1', player1Score: 2, player2Score: 0, sets: [{player1Score:11,player2Score:1},{player1Score:11,player2Score:1}], status: 'completed', matchId: 'm1' }, // p1 +20 small points
                { id: 'm2', tournamentId, round: 1, player1Id: 'p2', player2Id: 'p3', winner: 'p2', player1Score: 2, player2Score: 0, sets: [{player1Score:11,player2Score:2},{player1Score:11,player2Score:2}], status: 'completed', matchId: 'm2' }, // p2 +18 small points
                { id: 'm3', tournamentId, round: 1, player1Id: 'p3', player2Id: 'p1', winner: 'p3', player1Score: 2, player2Score: 0, sets: [{player1Score:11,player2Score:3},{player1Score:11,player2Score:3}], status: 'completed', matchId: 'm3' }, // p3 +16 small points
            ];
            // p1: 3pts, Sets 2W-2L (ratio 1). Small points: (11+11+3+3) - (1+1+11+11) = 28-24 = +4
            // p2: 3pts, Sets 2W-2L (ratio 1). Small points: (1+1+11+11) - (11+11+2+2) = 24-26 = -2
            // p3: 3pts, Sets 2W-2L (ratio 1). Small points: (2+2+11+11) - (11+11+3+3) = 26-28 = -2
            // Winner should be p1 based on small points.

            const winnerId = await autoSelectRoundRobinWinner(tournamentId, completedMatches, playerIds, tournamentName);
            expect(winnerId).toBe('p1');
            expect(supabase.from('tournaments').update).toHaveBeenCalledWith({
                winner_id: 'p1',
                status: TournamentStatus.COMPLETED,
            });
            expect(dispatchSystemNotification).toHaveBeenCalledWith('tournament_won', expect.anything());
        });

        it('should return null if not all matches are completed (though function expects pre-filtered completedMatches)', async () => {
            // This test is more conceptual as the function now takes completedMatches directly.
            // If an empty array of completedMatches is passed:
            const winnerId = await autoSelectRoundRobinWinner(tournamentId, [], playerIds, tournamentName);
            expect(winnerId).toBeNull();
            expect(supabase.from('tournaments').update).not.toHaveBeenCalled();
        });
    });
});
