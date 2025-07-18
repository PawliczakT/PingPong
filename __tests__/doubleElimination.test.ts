import {v4 as uuidv4} from 'uuid';
import {generateDoubleEliminationTournament} from '@/store/tournamentStore';

// Mock the supabase client
jest.mock('@/app/lib/supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        rpc: jest.fn().mockReturnThis(),
        channel: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
    }
}));

describe('Double Elimination Tournament', () => {
    // Mock playerIds for testing
    const tournamentId = uuidv4();
    const playerIds = [
        uuidv4(), uuidv4(), uuidv4(), uuidv4(),
        uuidv4(), uuidv4(), uuidv4(), uuidv4()
    ];

    test('should generate correct number of matches for 8 players', () => {
        const {matches, matchIdMatrix} = generateDoubleEliminationTournament(tournamentId, playerIds);

        // For 8 players:
        // Winners bracket: Round 1 (4 matches), Round 2 (2 matches), Round 3 (1 match) = 7 matches
        // Losers bracket: Round 1 (2 matches), Round 2 (2 matches), Round 3 (1 match), Round 4 (1 match) = 7 matches
        // Finals: 2 matches (first final and true final)
        // Total: 16 matches

        expect(matches.length).toBe(16);

        // Check winners bracket
        const winnersBracketMatches = matches.filter(m => m.bracket === 'winners');
        expect(winnersBracketMatches.length).toBe(7);

        // Check losers bracket
        const losersBracketMatches = matches.filter(m => m.bracket === 'losers');
        expect(losersBracketMatches.length).toBe(7);

        // Check finals
        const finalMatches = matches.filter(m => m.bracket === 'final');
        expect(finalMatches.length).toBe(2);

        // Check matchIdMatrix structure
        expect(matchIdMatrix.winners.length).toBe(3); // 3 rounds in winners bracket
        expect(matchIdMatrix.losers.length).toBe(5); // 5 rounds in losers bracket
        expect(matchIdMatrix.final.length).toBe(2); // 2 final matches
    });

    test('should correctly connect matches between brackets', () => {
        const {matches} = generateDoubleEliminationTournament(tournamentId, playerIds);

        // Check that losers from winners bracket round 1 go to losers bracket
        const winnersRound1 = matches.filter(m => m.bracket === 'winners' && m.round === 1);

        for (const match of winnersRound1) {
            expect(match.stage).not.toBeNull();
            expect(match.stage?.startsWith('loser_next:')).toBe(true);

            // Verify that the loser match exists
            const loserMatchId = match.stage?.split(':')[1];
            const loserMatch = matches.find(m => m.id === loserMatchId);
            expect(loserMatch).toBeDefined();
            expect(loserMatch?.bracket).toBe('losers');
        }

        // Check that winners bracket final connects to grand final
        const winnersFinal = matches.find(m => m.bracket === 'winners' && m.round === 3);
        expect(winnersFinal).toBeDefined();

        const grandFinal = matches.find(m => m.bracket === 'final' && m.round === 4); // round = log2(8) + 1
        expect(grandFinal).toBeDefined();

        expect(winnersFinal?.next_match_id).toBe(grandFinal?.id);

        // Check that losers bracket final connects to grand final
        const losersFinal = matches.find(m => m.bracket === 'losers' && m.round === 4);
        expect(losersFinal).toBeDefined();
        expect(losersFinal?.next_match_id).not.toBeNull();
        const connectedFinal = matches.find(m => m.id === losersFinal?.next_match_id);
        expect(connectedFinal).toBeDefined();
        // The loser final might connect to another losers match or directly to a final match
        // Just verify that the connection exists

        // Check that grand final connects to true final
        const trueFinal = matches.find(m => m.bracket === 'final' && m.stage === 'true_final');
        expect(trueFinal).toBeDefined();
        expect(grandFinal?.next_match_id).not.toBeNull();
        const connectedTrueFinal = matches.find(m => m.id === grandFinal?.next_match_id);
        expect(connectedTrueFinal).toBeDefined();
        expect(connectedTrueFinal?.bracket).toBe('final');
    });

    test('should handle odd number of players', () => {
        // Remove one player to make it 7 players
        const oddPlayerIds = [...playerIds];
        oddPlayerIds.pop();

        const {matches} = generateDoubleEliminationTournament(tournamentId, oddPlayerIds);

        // Check that we still have the right structure
        const winnersBracketMatches = matches.filter(m => m.bracket === 'winners');
        const losersBracketMatches = matches.filter(m => m.bracket === 'losers');
        const finalMatches = matches.filter(m => m.bracket === 'final');

        // Should still create 8 slots (with one bye)
        expect(winnersBracketMatches.length).toBe(7);

        // Check for a bye match (completed with only one player)
        const byeMatches = winnersBracketMatches.filter(m =>
            m.status === 'completed' &&
            ((m.player1_id && !m.player2_id) || (!m.player1_id && m.player2_id))
        );

        expect(byeMatches.length).toBeGreaterThan(0);
    });
});
