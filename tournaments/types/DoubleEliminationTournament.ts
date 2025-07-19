/**
 * Double Elimination Tournament Strategy
 * Implements double-elimination tournament logic with winners/losers brackets
 */
import {Set as MatchSet, TournamentFormat, TournamentMatch} from '../../backend/types';
import {BaseTournamentStrategy, TournamentMatchInsert} from './BaseTournament';
import {TournamentRepository} from '../repositories/TournamentRepository';

export class DoubleEliminationTournamentStrategy extends BaseTournamentStrategy {
    readonly format = TournamentFormat.DOUBLE_ELIMINATION;

    constructor(private repository: TournamentRepository) {
        super();
    }

    validateConfiguration(playerIds: string[]): { valid: boolean; error?: string } {
        if (playerIds.length < 2) {
            return {valid: false, error: "Minimum 2 players required"};
        }

        if (playerIds.length % 4 !== 0) {
            return {valid: false, error: "Double elimination tournaments require a number of players divisible by 4"};
        }

        return {valid: true};
    }

    async generateMatches(tournamentId: string, playerIds: string[]): Promise<TournamentMatchInsert[]> {
        const validation = this.validateConfiguration(playerIds);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const result = this.generateDoubleEliminationBracket(tournamentId, playerIds);
        return result.matches;
    }

    private generateDoubleEliminationBracket(tournamentId: string, playerIds: string[]): {
        matches: TournamentMatchInsert[];
        matchIdMatrix: { winners: string[][]; losers: string[][]; final: string[] };
    } {
        const numPlayers = playerIds.length;
        const numRounds = Math.ceil(Math.log2(numPlayers));

        const matches: TournamentMatchInsert[] = [];
        const matchIdMatrix = {
            winners: [] as string[][],
            losers: [] as string[][],
            final: [] as string[]
        };

        let shuffledPlayers: (string | null)[] = this.shuffleArray([...playerIds]);
        if (shuffledPlayers.length % 2 !== 0) shuffledPlayers.push(null);

        this.generateWinnersBracket(tournamentId, shuffledPlayers, matches, matchIdMatrix, numRounds);

        this.generateLosersBracket(tournamentId, matches, matchIdMatrix, numRounds);

        this.generateGrandFinal(tournamentId, matches, matchIdMatrix, numRounds);

        return {matches, matchIdMatrix};
    }

    private generateWinnersBracket(
        tournamentId: string,
        shuffledPlayers: (string | null)[],
        matches: TournamentMatchInsert[],
        matchIdMatrix: { winners: string[][]; losers: string[][]; final: string[] },
        numRounds: number
    ): void {
        const winnersRound1: string[] = [];
        for (let i = 0; i < shuffledPlayers.length; i += 2) {
            const matchId = this.generateMatchId();
            winnersRound1.push(matchId);

            const p1 = shuffledPlayers[i];
            const p2 = shuffledPlayers[i + 1];
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

            matches.push({
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
                stage: null,
                bracket: 'winners',
                sets: null,
            });
        }
        matchIdMatrix.winners.push(winnersRound1);

        for (let round = 2; round <= numRounds; round++) {
            const prevRoundMatches = matchIdMatrix.winners[round - 2];
            const currRoundMatches: string[] = [];

            for (let i = 0; i < prevRoundMatches.length; i += 2) {
                const matchId = this.generateMatchId();
                currRoundMatches.push(matchId);

                const match1 = matches.find(m => m.id === prevRoundMatches[i]);
                if (match1) match1.next_match_id = matchId;

                if (i + 1 < prevRoundMatches.length) {
                    const match2 = matches.find(m => m.id === prevRoundMatches[i + 1]);
                    if (match2) match2.next_match_id = matchId;
                }

                matches.push({
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
                    stage: null,
                    bracket: 'winners',
                    sets: null,
                });
            }

            matchIdMatrix.winners.push(currRoundMatches);
        }
    }

    private generateLosersBracket(
        tournamentId: string,
        matches: TournamentMatchInsert[],
        matchIdMatrix: { winners: string[][]; losers: string[][]; final: string[] },
        numRounds: number
    ): void {
        const losersRoundsCount = numRounds;

        const losersRound1Matches = [];
        const losersFromWinnersR1 = matchIdMatrix.winners[0].length;
        const losersRound1Count = Math.floor(losersFromWinnersR1 / 2);

        for (let i = 0; i < losersRound1Count; i++) {
            const matchId = this.generateMatchId();
            losersRound1Matches.push(matchId);

            const winnersMatch1 = matches.find(m => m.id === matchIdMatrix.winners[0][i * 2]);
            const winnersMatch2 = matches.find(m => m.id === matchIdMatrix.winners[0][i * 2 + 1]);

            if (winnersMatch1) winnersMatch1.stage = `loser_next:${matchId}`;
            if (winnersMatch2) winnersMatch2.stage = `loser_next:${matchId}`;

            matches.push({
                id: matchId,
                tournament_id: tournamentId,
                round: 1,
                match_number: i + 1,
                player1_id: null,
                player2_id: null,
                player1_score: null,
                player2_score: null,
                winner_id: null,
                status: 'pending',
                next_match_id: null,
                stage: null,
                bracket: 'losers',
                sets: null,
            });
        }

        matchIdMatrix.losers.push(losersRound1Matches);

        let currentLosersRound = 2;
        let previousLosersRoundMatches = losersRound1Matches;

        while (currentLosersRound <= losersRoundsCount) {
            const losersRoundMatches = [];

            if (currentLosersRound === losersRoundsCount) {
                const matchId = this.generateMatchId();
                losersRoundMatches.push(matchId);

                if (previousLosersRoundMatches.length > 0) {
                    const prevLoserMatch = matches.find(m => m.id === previousLosersRoundMatches[0]);
                    if (prevLoserMatch) prevLoserMatch.next_match_id = matchId;
                }

                const winnersFinalMatch = matches.find(m => m.id === matchIdMatrix.winners[numRounds - 1][0]);
                if (winnersFinalMatch) winnersFinalMatch.stage = `loser_next:${matchId}`;

                matches.push({
                    id: matchId,
                    tournament_id: tournamentId,
                    round: currentLosersRound,
                    match_number: 1,
                    player1_id: null,
                    player2_id: null,
                    player1_score: null,
                    player2_score: null,
                    winner_id: null,
                    status: 'pending',
                    next_match_id: null,
                    stage: null,
                    bracket: 'losers',
                    sets: null,
                });
            } else {
                const losersFromWinnersRound = matchIdMatrix.winners[currentLosersRound - 1].length;
                const totalPlayers = previousLosersRoundMatches.length + losersFromWinnersRound;
                const matchCount = Math.floor(totalPlayers / 2);

                for (let i = 0; i < matchCount; i++) {
                    const matchId = this.generateMatchId();
                    losersRoundMatches.push(matchId);

                    if (i < previousLosersRoundMatches.length) {
                        const prevLoserMatch = matches.find(m => m.id === previousLosersRoundMatches[i]);
                        if (prevLoserMatch) prevLoserMatch.next_match_id = matchId;
                    }

                    if (i < losersFromWinnersRound) {
                        const winnersMatch = matches.find(m => m.id === matchIdMatrix.winners[currentLosersRound - 1][i]);
                        if (winnersMatch) winnersMatch.stage = `loser_next:${matchId}`;
                    }

                    matches.push({
                        id: matchId,
                        tournament_id: tournamentId,
                        round: currentLosersRound,
                        match_number: i + 1,
                        player1_id: null,
                        player2_id: null,
                        player1_score: null,
                        player2_score: null,
                        winner_id: null,
                        status: 'pending',
                        next_match_id: null,
                        stage: null,
                        bracket: 'losers',
                        sets: null,
                    });
                }
            }

            matchIdMatrix.losers.push(losersRoundMatches);
            previousLosersRoundMatches = losersRoundMatches;
            currentLosersRound++;
        }
    }

    private generateGrandFinal(
        tournamentId: string,
        matches: TournamentMatchInsert[],
        matchIdMatrix: { winners: string[][]; losers: string[][]; final: string[] },
        numRounds: number
    ): void {
        const finalMatchId = this.generateMatchId();

        if (matchIdMatrix.winners[numRounds - 1].length > 0) {
            const winnersFinalMatch = matches.find(m => m.id === matchIdMatrix.winners[numRounds - 1][0]);
            if (winnersFinalMatch) winnersFinalMatch.next_match_id = finalMatchId;
        }

        const finalLosersMatch = matches.find(m => m.id === matchIdMatrix.losers[matchIdMatrix.losers.length - 1][0]);
        if (finalLosersMatch) finalLosersMatch.next_match_id = finalMatchId;

        matches.push({
            id: finalMatchId,
            tournament_id: tournamentId,
            round: numRounds + 1,
            match_number: 1,
            player1_id: null,
            player2_id: null,
            player1_score: null,
            player2_score: null,
            winner_id: null,
            status: 'pending',
            next_match_id: null,
            stage: null,
            bracket: 'final',
            sets: null,
        });

        matchIdMatrix.final = [finalMatchId];
    }

    async updateMatchResult(
        tournamentId: string,
        matchId: string,
        scores: { player1Score: number; player2Score: number; sets?: MatchSet[] }
    ): Promise<void> {
        if (scores.player1Score === scores.player2Score) {
            throw new Error('Scores cannot be equal');
        }

        const matchData = await this.repository.getMatchById(matchId);
        if (!matchData) {
            throw new Error('Match not found');
        }

        const winnerId = scores.player1Score > scores.player2Score
            ? matchData.player1_id
            : matchData.player2_id;

        const loserId = scores.player1Score < scores.player2Score
            ? matchData.player1_id
            : matchData.player2_id;

        await this.repository.updateMatch(matchId, {
            player1_score: scores.player1Score,
            player2_score: scores.player2Score,
            winner_id: winnerId,
            status: 'completed',
            sets: scores.sets ? JSON.stringify(scores.sets) : null
        });

        if (matchData.next_match_id && winnerId) {
            await this.repository.advancePlayerToNextMatch(matchData.next_match_id, winnerId);
        }

        if (matchData.stage && matchData.stage.startsWith('loser_next:') && loserId) {
            const loserMatchId = matchData.stage.split(':')[1];
            await this.repository.advancePlayerToNextMatch(loserMatchId, loserId);
        }

        if (matchData.bracket === 'final') {
            await this.handleGrandFinalResult(tournamentId, matchData, winnerId, loserId);
        }
    }

    private async handleGrandFinalResult(
        tournamentId: string,
        matchData: any,
        winnerId: string,
        loserId: string
    ): Promise<void> {
        const winnerFromWinnersBracket = matchData.player1_id;
        const winnerFromLosersBracket = matchData.player2_id;

        if (winnerId === winnerFromLosersBracket) {
            const trueFinalId = this.generateMatchId();
            await this.repository.createMatch({
                id: trueFinalId,
                tournament_id: tournamentId,
                round: matchData.round + 1,
                match_number: 1,
                player1_id: winnerFromWinnersBracket,
                player2_id: winnerFromLosersBracket,
                player1_score: null,
                player2_score: null,
                winner_id: null,
                status: 'scheduled',
                next_match_id: null,
                stage: 'true_final',
                bracket: 'final',
                sets: null
            });
        } else {
            await this.repository.setTournamentWinner(tournamentId, winnerId);
        }
    }

    async determineWinner(tournamentId: string, matches: TournamentMatch[]): Promise<string | null> {
        const grandFinal = matches.find(m => m.bracket === 'final' && m.status === 'completed');
        if (grandFinal && grandFinal.winner) {
            const trueFinal = matches.find(m => m.stage === 'true_final' && m.status === 'completed');
            return trueFinal ? trueFinal.winner : grandFinal.winner;
        }

        return null;
    }
}
