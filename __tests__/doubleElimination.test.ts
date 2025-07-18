import {v4 as uuidv4} from 'uuid';
import {generateDoubleEliminationTournament} from '@/store/tournamentStore';

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
    const tournamentId = uuidv4();
    const playerIds = [
        uuidv4(), uuidv4(), uuidv4(), uuidv4(),
        uuidv4(), uuidv4(), uuidv4(), uuidv4()
    ];

    test('should generate correct number of matches for 8 players', () => {
        const {matches, matchIdMatrix} = generateDoubleEliminationTournament(tournamentId, playerIds);

        expect(matches.length).toBe(13);

        const winnersBracketMatches = matches.filter(m => m.bracket === 'winners');
        expect(winnersBracketMatches.length).toBe(7);

        const losersBracketMatches = matches.filter(m => m.bracket === 'losers');
        expect(losersBracketMatches.length).toBe(5);

        const finalMatches = matches.filter(m => m.bracket === 'final');
        expect(finalMatches.length).toBe(1);

        expect(matchIdMatrix.winners.length).toBe(3); // 3 rounds in winners bracket
        expect(matchIdMatrix.losers.length).toBe(3); // 3 rounds in losers bracket
        expect(matchIdMatrix.final.length).toBe(1); // 1 grand final match
    });

    test('should generate correct number of matches for 4 players', () => {
        const fourPlayerIds = [uuidv4(), uuidv4(), uuidv4(), uuidv4()];
        const {matches, matchIdMatrix} = generateDoubleEliminationTournament(tournamentId, fourPlayerIds);

        expect(matches.length).toBe(6);

        const winnersBracketMatches = matches.filter(m => m.bracket === 'winners');
        expect(winnersBracketMatches.length).toBe(3);

        const losersBracketMatches = matches.filter(m => m.bracket === 'losers');
        expect(losersBracketMatches.length).toBe(2);

        const finalMatches = matches.filter(m => m.bracket === 'final');
        expect(finalMatches.length).toBe(1);

        expect(matchIdMatrix.winners.length).toBe(2); // 2 rounds in winners bracket
        expect(matchIdMatrix.losers.length).toBe(2); // 2 rounds in losers bracket
        expect(matchIdMatrix.final.length).toBe(1); // 1 grand final match
    });

    test('should correctly connect matches between brackets', () => {
        const {matches} = generateDoubleEliminationTournament(tournamentId, playerIds);

        const winnersRound1 = matches.filter(m => m.bracket === 'winners' && m.round === 1);

        for (const match of winnersRound1) {
            expect(match.stage).not.toBeNull();
            expect(match.stage?.startsWith('loser_next:')).toBe(true);

            const loserMatchId = match.stage?.split(':')[1];
            const loserMatch = matches.find(m => m.id === loserMatchId);
            expect(loserMatch).toBeDefined();
            expect(loserMatch?.bracket).toBe('losers');
        }

        const winnersFinal = matches.find(m => m.bracket === 'winners' && m.round === 3);
        expect(winnersFinal).toBeDefined();

        const grandFinal = matches.find(m => m.bracket === 'final');
        expect(grandFinal).toBeDefined();

        expect(winnersFinal?.next_match_id).toBe(grandFinal?.id);

        const losersFinal = matches.find(m => m.bracket === 'losers' && m.round === 3);
        expect(losersFinal).toBeDefined();
        expect(losersFinal?.next_match_id).toBe(grandFinal?.id);

        expect(grandFinal?.next_match_id).toBeNull();
    });

    test('should handle odd number of players', () => {
        const oddPlayerIds = [...playerIds];
        oddPlayerIds.pop();

        const {matches} = generateDoubleEliminationTournament(tournamentId, oddPlayerIds);

        const winnersBracketMatches = matches.filter(m => m.bracket === 'winners');
        const losersBracketMatches = matches.filter(m => m.bracket === 'losers');
        const finalMatches = matches.filter(m => m.bracket === 'final');

        expect(winnersBracketMatches.length).toBe(7);

        const byeMatches = winnersBracketMatches.filter(m =>
            m.status === 'completed' &&
            ((m.player1_id && !m.player2_id) || (!m.player1_id && m.player2_id))
        );

        expect(byeMatches.length).toBeGreaterThan(0);
    });

    test('should properly set up losers bracket rounds', () => {
        const {matches} = generateDoubleEliminationTournament(tournamentId, playerIds);

        const losersBracketMatches = matches.filter(m => m.bracket === 'losers');

        const losersRound1 = losersBracketMatches.filter(m => m.round === 1);
        const losersRound2 = losersBracketMatches.filter(m => m.round === 2);
        const losersRound3 = losersBracketMatches.filter(m => m.round === 3);

        expect(losersRound1.length).toBe(2);
        expect(losersRound2.length).toBe(2);
        expect(losersRound3.length).toBe(1);

        for (const match of losersRound1) {
            expect(match.next_match_id).not.toBeNull();
            const nextMatch = matches.find(m => m.id === match.next_match_id);
            expect(nextMatch?.bracket).toBe('losers');
            expect(nextMatch?.round).toBe(2);
        }

        const round2MatchesWithNext = losersRound2.filter(m => m.next_match_id !== null);
        expect(round2MatchesWithNext.length).toBeGreaterThan(0);
        const losersFinal = losersRound3[0];
        expect(losersFinal.next_match_id).not.toBeNull();
        const grandFinal = matches.find(m => m.id === losersFinal.next_match_id);
        expect(grandFinal?.bracket).toBe('final');
    });

    test('should have correct final match structure', () => {
        const {matches} = generateDoubleEliminationTournament(tournamentId, playerIds);

        const finalMatches = matches.filter(m => m.bracket === 'final');

        expect(finalMatches.length).toBe(1);

        const grandFinal = finalMatches[0];
        expect(grandFinal.stage).not.toBe('true_final');
        expect(grandFinal.round).toBe(4); // round = winners bracket rounds + 1

        expect(grandFinal.next_match_id).toBeNull();
    });
});
