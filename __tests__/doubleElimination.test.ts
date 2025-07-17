



const generateDoubleEliminationBracket = (playerIds: string[], tournamentId: string) => {
    const numPlayers = playerIds.length;
    if (![4, 8, 16, 32].includes(numPlayers)) {
        throw new Error("Double elimination tournaments require 4, 8, 16, or 32 players");
    }

    const matches: any[] = [];
    const winnerBracketRounds = Math.ceil(Math.log2(numPlayers));
    const loserBracketRounds = (winnerBracketRounds - 1) * 2;
    
    for (let round = 1; round <= winnerBracketRounds; round++) {
        const matchesInRound = Math.pow(2, winnerBracketRounds - round);
        for (let i = 0; i < matchesInRound; i++) {
            matches.push({
                id: `winner-r${round}-m${i}`,
                tournament_id: tournamentId,
                round,
                bracket: 'winner',
                stage: round === winnerBracketRounds ? 'Winner Bracket Final' : `Winner Round ${round}`,
                player1_id: round === 1 ? playerIds[i * 2] : null,
                player2_id: round === 1 ? playerIds[i * 2 + 1] : null,
                status: round === 1 ? 'scheduled' : 'pending'
            });
        }
    }
    
    for (let round = 1; round <= loserBracketRounds; round++) {
        const matchesInRound = round === loserBracketRounds ? 1 : Math.pow(2, Math.floor((loserBracketRounds - round) / 2));
        for (let i = 0; i < matchesInRound; i++) {
            matches.push({
                id: `loser-r${round}-m${i}`,
                tournament_id: tournamentId,
                round,
                bracket: 'loser',
                stage: round === loserBracketRounds ? 'Loser Bracket Final' : `Loser Round ${round}`,
                player1_id: null,
                player2_id: null,
                status: 'pending'
            });
        }
    }
    
    matches.push({
        id: 'grand-final',
        tournament_id: tournamentId,
        round: winnerBracketRounds + loserBracketRounds + 1,
        bracket: 'winner',
        stage: 'Grand Final',
        player1_id: null,
        player2_id: null,
        status: 'pending'
    });
    
    matches.push({
        id: 'grand-final-reset',
        tournament_id: tournamentId,
        round: winnerBracketRounds + loserBracketRounds + 2,
        bracket: 'winner',
        stage: 'Grand Final Reset',
        player1_id: null,
        player2_id: null,
        status: 'pending',
        is_if_game: true
    });
    
    return matches;
};

describe('Double Elimination Tournament', () => {
    const mockTournamentId = 'test-tournament-id';

    describe('Bracket Generation', () => {
        test('should generate correct bracket for 4 players', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const winnerMatches = matches.filter(m => m.bracket === 'winner' && !m.is_if_game);
            const loserMatches = matches.filter(m => m.bracket === 'loser');
            const grandFinalMatches = matches.filter(m => m.stage === 'Grand Final' || m.stage === 'Grand Final Reset');
            
            expect(winnerMatches).toHaveLength(3);
            expect(loserMatches).toHaveLength(2);
            expect(grandFinalMatches).toHaveLength(2);
            
            const firstRoundMatches = winnerMatches.filter(m => m.round === 1);
            expect(firstRoundMatches).toHaveLength(2);
            expect(firstRoundMatches.every(m => m.player1_id && m.player2_id)).toBe(true);
        });

        test('should generate correct bracket for 8 players', () => {
            const playerIds = Array.from({length: 8}, (_, i) => `player${i + 1}`);
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const winnerMatches = matches.filter(m => m.bracket === 'winner' && !m.is_if_game);
            const loserMatches = matches.filter(m => m.bracket === 'loser');
            
            expect(winnerMatches).toHaveLength(7);
            expect(loserMatches).toHaveLength(6);
            
            const firstRoundMatches = winnerMatches.filter(m => m.round === 1);
            expect(firstRoundMatches).toHaveLength(4);
        });

        test('should throw error for invalid player count', () => {
            const invalidPlayerCounts = [3, 5, 6, 7, 9, 15, 17, 33];
            
            invalidPlayerCounts.forEach(count => {
                const playerIds = Array.from({length: count}, (_, i) => `player${i + 1}`);
                expect(() => generateDoubleEliminationBracket(playerIds, mockTournamentId))
                    .toThrow("Double elimination tournaments require 4, 8, 16, or 32 players");
            });
        });

        test('should set correct bracket and stage information', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const winnerBracketFinal = matches.find(m => m.stage === 'Winner Bracket Final');
            const loserBracketFinal = matches.find(m => m.stage === 'Loser Bracket Final');
            const grandFinal = matches.find(m => m.stage === 'Grand Final');
            const grandFinalReset = matches.find(m => m.stage === 'Grand Final Reset');
            
            expect(winnerBracketFinal).toBeDefined();
            expect(winnerBracketFinal?.bracket).toBe('winner');
            expect(loserBracketFinal).toBeDefined();
            expect(loserBracketFinal?.bracket).toBe('loser');
            expect(grandFinal).toBeDefined();
            expect(grandFinalReset).toBeDefined();
            expect(grandFinalReset?.is_if_game).toBe(true);
        });

        test('should link matches correctly with next_match_id', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const winnerBracketFinal = matches.find(m => m.stage === 'Winner Bracket Final');
            const loserBracketFinal = matches.find(m => m.stage === 'Loser Bracket Final');
            const grandFinal = matches.find(m => m.stage === 'Grand Final');
            
            expect(winnerBracketFinal?.next_match_id).toBe(grandFinal?.id);
            expect(loserBracketFinal?.next_match_id).toBe(grandFinal?.id);
        });
    });

    describe('Match Advancement Logic', () => {
        test('should handle winner bracket advancement', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const firstRoundMatches = matches.filter(m => m.round === 1 && m.bracket === 'winner');
            expect(firstRoundMatches).toHaveLength(2);
            
            firstRoundMatches.forEach(match => {
                expect(match.next_match_id).toBeDefined();
                const nextMatch = matches.find(m => m.id === match.next_match_id);
                expect(nextMatch?.round).toBe(2);
                expect(nextMatch?.bracket).toBe('winner');
            });
        });

        test('should create proper loser bracket structure', () => {
            const playerIds = Array.from({length: 8}, (_, i) => `player${i + 1}`);
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const loserMatches = matches.filter(m => m.bracket === 'loser');
            const loserRounds = Math.max(...loserMatches.map(m => m.round));
            
            expect(loserRounds).toBe(6);
            
            const loserBracketFinal = matches.find(m => m.stage === 'Loser Bracket Final');
            expect(loserBracketFinal?.round).toBe(loserRounds);
        });
    });

    describe('Tournament Validation', () => {
        test('should validate minimum players for double elimination', () => {
            const validPlayerCounts = [4, 8, 16, 32];
            
            validPlayerCounts.forEach(count => {
                const playerIds = Array.from({length: count}, (_, i) => `player${i + 1}`);
                expect(() => generateDoubleEliminationBracket(playerIds, mockTournamentId))
                    .not.toThrow();
            });
        });

        test('should ensure all matches have proper tournament_id', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            matches.forEach(match => {
                expect(match.tournament_id).toBe(mockTournamentId);
            });
        });

        test('should set initial match statuses correctly', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const firstRoundMatches = matches.filter(m => m.round === 1);
            firstRoundMatches.forEach(match => {
                expect(match.status).toBe('scheduled');
                expect(match.player1_id).toBeDefined();
                expect(match.player2_id).toBeDefined();
            });
            
            const laterMatches = matches.filter(m => m.round > 1);
            laterMatches.forEach(match => {
                if (match.stage !== 'Grand Final Reset') {
                    expect(match.status).toBe('pending');
                    expect(match.player1_id).toBeNull();
                    expect(match.player2_id).toBeNull();
                }
            });
        });
    });

    describe('Grand Final Logic', () => {
        test('should create grand final and reset match', () => {
            const playerIds = ['player1', 'player2', 'player3', 'player4'];
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const grandFinal = matches.find(m => m.stage === 'Grand Final');
            const grandFinalReset = matches.find(m => m.stage === 'Grand Final Reset');
            
            expect(grandFinal).toBeDefined();
            expect(grandFinalReset).toBeDefined();
            expect(grandFinalReset?.is_if_game).toBe(true);
            expect(grandFinalReset?.status).toBe('pending');
        });

        test('should place grand final matches in correct rounds', () => {
            const playerIds = Array.from({length: 8}, (_, i) => `player${i + 1}`);
            const matches = generateDoubleEliminationBracket(playerIds, mockTournamentId);
            
            const winnerMatches = matches.filter(m => m.bracket === 'winner' && !m.is_if_game);
            const loserMatches = matches.filter(m => m.bracket === 'loser');
            const grandFinal = matches.find(m => m.stage === 'Grand Final');
            const grandFinalReset = matches.find(m => m.stage === 'Grand Final Reset');
            
            const maxWinnerRound = Math.max(...winnerMatches.map(m => m.round));
            const maxLoserRound = Math.max(...loserMatches.map(m => m.round));
            
            expect(grandFinal?.round).toBe(maxWinnerRound + maxLoserRound + 1);
            expect(grandFinalReset?.round).toBe(maxWinnerRound + maxLoserRound + 2);
        });
    });
});
