import { TournamentFormat, TournamentMatch } from '@/backend/types';
import { generateDoubleEliminationMatches } from '@/store/tournamentStore';

describe('Double Elimination Tournament Logic', () => {
    describe('generateDoubleEliminationMatches', () => {
        it('should generate correct number of matches for 4 players', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const tournamentId = 'tournament1';
            
            const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
            
            expect(matches).toHaveLength(6);
        });

        it('should generate correct number of matches for 8 players', () => {
            const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
            const tournamentId = 'tournament1';
            
            const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
            
            expect(matches).toHaveLength(14);
        });

        it('should create winners bracket matches correctly', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const tournamentId = 'tournament1';
            
            const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
            const winnersMatches = matches.filter(m => m.bracket === 'winners' && m.stage !== 'GRAND-FINAL');
            
            expect(winnersMatches).toHaveLength(2); // 2 first round matches
            
            const winnersRound1 = winnersMatches.filter(m => m.round === 1);
            expect(winnersRound1).toHaveLength(2);
            
            const firstRoundPlayers = winnersRound1.flatMap(m => [m.player1_id, m.player2_id]);
            expect(firstRoundPlayers.sort()).toEqual(playerIds.sort());
        });

        it('should create losers bracket matches correctly', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const tournamentId = 'tournament1';
            
            const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
            const losersMatches = matches.filter(m => m.bracket === 'losers');
            
            expect(losersMatches).toHaveLength(2); // 1 semifinal + 1 final
        });

        it('should create grand final and if game matches', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const tournamentId = 'tournament1';
            
            const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
            
            const grandFinalMatches = matches.filter(m => m.stage === 'GRAND-FINAL');
            expect(grandFinalMatches).toHaveLength(1);
            
            const ifGameMatches = matches.filter(m => m.is_if_game === true);
            expect(ifGameMatches).toHaveLength(1);
        });

        it('should set correct next match IDs for winners bracket progression', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const tournamentId = 'tournament1';
            
            const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
            const winnersMatches = matches.filter(m => m.bracket === 'winners' && m.stage !== 'GRAND-FINAL');
            
            const winnersRound1 = winnersMatches.filter(m => m.round === 1);
            const grandFinalMatch = matches.find(m => m.stage === 'GRAND-FINAL');
            
            winnersRound1.forEach(match => {
                expect(match.next_match_id).toBe(grandFinalMatch?.id);
            });
        });

        it('should assign correct stages for bracket progression', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const tournamentId = 'tournament1';
            
            const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
            
            const winnersMatches = matches.filter(m => m.bracket === 'winners' && m.stage !== 'GRAND-FINAL');
            const losersMatches = matches.filter(m => m.bracket === 'losers');
            
            winnersMatches.forEach(match => {
                expect(match.stage).toMatch(/^WB-R\d+$/); // Winners Bracket Round format
            });
            
            const grandFinalMatch = matches.find(m => m.stage === 'GRAND-FINAL');
            expect(grandFinalMatch?.stage).toBe('GRAND-FINAL');
            
            const regularLosersMatches = losersMatches.filter(m => !m.stage.includes('FINAL'));
            regularLosersMatches.forEach(match => {
                expect(match.stage).toMatch(/^LB-R\d+$/); // Losers Bracket Round format
            });
        });
    });

    describe('Double Elimination Tournament Rules', () => {
        it('should require minimum 4 players', () => {
            const playerIds = ['player1', 'player2', 'player3'];
            const tournamentId = 'tournament1';
            
            expect(() => {
                generateDoubleEliminationMatches(tournamentId, playerIds);
            }).toThrow('Double Elimination tournaments require at least 4 players');
        });

        it('should handle power of 2 player counts correctly', () => {
            const testCases = [4, 8, 16];
            
            testCases.forEach(playerCount => {
                const playerIds = Array.from({ length: playerCount }, (_, i) => `player${i + 1}`);
                const tournamentId = 'tournament1';
                
                const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
                
                expect(matches.length).toBe(2 * playerCount - 2);
            });
        });

        it('should handle non-power of 2 player counts with byes', () => {
            const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
            const tournamentId = 'tournament1';
            
            const matches = generateDoubleEliminationMatches(tournamentId, playerIds);
            
            expect(matches.length).toBeGreaterThan(0);
            
            const byeMatches = matches.filter(m => m.player1_id === null || m.player2_id === null);
            expect(byeMatches.length).toBeGreaterThan(0);
        });
    });
});
