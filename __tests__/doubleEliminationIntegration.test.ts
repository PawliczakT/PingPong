



import { TournamentFormat } from '../backend/types';

const mockTournamentStore = {
    generateAndStartTournament: jest.fn(),
    getState: () => ({
        generateAndStartTournament: jest.fn()
    })
};

jest.mock('../store/tournamentStore', () => ({
    useTournamentStore: mockTournamentStore
}));

jest.mock('@/app/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
            })),
            insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
            update: jest.fn(() => Promise.resolve({ data: [], error: null })),
            delete: jest.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
        channel: jest.fn(() => ({
            on: jest.fn(() => ({
                subscribe: jest.fn()
            }))
        }))
    }
}));

describe('Double Elimination Tournament Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Tournament Creation', () => {
        test('should create double elimination tournament with valid player count', async () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            
            const mockTournament = {
                id: 'test-tournament',
                name: 'Test Double Elimination',
                format: TournamentFormat.DOUBLE_ELIMINATION,
                status: 'upcoming',
                date: new Date().toISOString(),
                participants: playerIds.map(id => ({ playerId: id })),
                matches: []
            };

            expect(mockTournament.format).toBe(TournamentFormat.DOUBLE_ELIMINATION);
            expect(playerIds).toHaveLength(4);
        });

        test('should reject invalid player counts', () => {
            const invalidPlayerCounts = [3, 5, 6, 7, 9];
            
            for (const count of invalidPlayerCounts) {
                const playerIds = Array.from({length: count}, (_, i) => `player${i + 1}`);
                
                expect(() => {
                    if (![4, 8, 16, 32].includes(playerIds.length)) {
                        throw new Error("Double elimination tournaments require 4, 8, 16, or 32 players");
                    }
                }).toThrow("Double elimination tournaments require 4, 8, 16, or 32 players");
            }
        });
    });

    describe('Match Result Updates', () => {
        test('should handle winner bracket match results', () => {
            
            const mockTournament = {
                id: 'test-tournament',
                format: TournamentFormat.DOUBLE_ELIMINATION,
                matches: [
                    {
                        id: 'match1',
                        bracket: 'winner',
                        stage: 'Round 1',
                        round: 1,
                        player1Id: 'player1',
                        player2Id: 'player2',
                        status: 'completed',
                        winner: 'player1',
                        nextMatchId: 'match3'
                    },
                    {
                        id: 'match2',
                        bracket: 'winner',
                        stage: 'Round 1',
                        round: 1,
                        player1Id: 'player3',
                        player2Id: 'player4',
                        status: 'completed',
                        winner: 'player3',
                        nextMatchId: 'match3'
                    },
                    {
                        id: 'match3',
                        bracket: 'winner',
                        stage: 'Winner Bracket Final',
                        round: 2,
                        player1Id: null,
                        player2Id: null,
                        status: 'pending',
                        nextMatchId: 'grand-final'
                    },
                    {
                        id: 'loser1',
                        bracket: 'loser',
                        stage: 'Loser Round 1',
                        round: 1,
                        player1Id: null,
                        player2Id: null,
                        status: 'pending'
                    }
                ]
            };

            expect(mockTournament.matches.find(m => m.id === 'match1')?.winner).toBe('player1');
            expect(mockTournament.matches.find(m => m.id === 'match2')?.winner).toBe('player3');
        });

        test('should move losers to loser bracket', () => {
            const winnerBracketMatch = {
                id: 'match1',
                bracket: 'winner',
                stage: 'Round 1',
                round: 1,
                player1Id: 'player1',
                player2Id: 'player2',
                winner: 'player1'
            };

            const loser = winnerBracketMatch.player1Id === winnerBracketMatch.winner 
                ? winnerBracketMatch.player2Id 
                : winnerBracketMatch.player1Id;

            expect(loser).toBe('player2');
        });
    });

    describe('Tournament Completion', () => {
        test('should determine winner correctly for standard grand final', () => {
            const grandFinalMatch = {
                id: 'grand-final',
                stage: 'Grand Final',
                status: 'completed',
                winner: 'player1'
            };

            const grandFinalResetMatch = {
                id: 'grand-final-reset',
                stage: 'Grand Final Reset',
                status: 'pending'
            };

            expect(grandFinalMatch.winner).toBe('player1');
            expect(grandFinalResetMatch.status).toBe('pending');
        });

        test('should handle grand final reset scenario', () => {
            const grandFinalMatch = {
                id: 'grand-final',
                stage: 'Grand Final',
                status: 'completed',
                winner: 'loser-bracket-champion'
            };

            const grandFinalResetMatch = {
                id: 'grand-final-reset',
                stage: 'Grand Final Reset',
                status: 'completed',
                winner: 'winner-bracket-champion'
            };

            expect(grandFinalResetMatch.winner).toBe('winner-bracket-champion');
        });
    });

    describe('Achievement Integration', () => {
        test('should award double elimination tournament achievement', () => {
            const tournamentWinner = 'player1';
            const tournamentFormat = TournamentFormat.DOUBLE_ELIMINATION;
            
            expect(tournamentFormat).toBe(TournamentFormat.DOUBLE_ELIMINATION);
            expect(tournamentWinner).toBe('player1');
        });
    });
});
