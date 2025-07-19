/**
 * Knockout Tournament Strategy
 * Implements single-elimination tournament logic
 */
import {Set as MatchSet, TournamentFormat, TournamentMatch} from '../../backend/types';
import {BaseTournamentStrategy, TournamentMatchInsert} from './BaseTournament';
import {TournamentRepository} from '../repositories/TournamentRepository';

export class KnockoutTournamentStrategy extends BaseTournamentStrategy {
    readonly format = TournamentFormat.KNOCKOUT;

    constructor(private repository: TournamentRepository) {
        super();
    }

    validateConfiguration(playerIds: string[]): { valid: boolean; error?: string } {
        if (playerIds.length < 2) {
            return {valid: false, error: "Minimum 2 players required"};
        }

        if (playerIds.length % 4 !== 0) {
            return {valid: false, error: "Knockout tournaments require a number of players divisible by 4"};
        }

        return {valid: true};
    }

    async generateMatches(tournamentId: string, playerIds: string[]): Promise<TournamentMatchInsert[]> {
        const validation = this.validateConfiguration(playerIds);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const numPlayers = playerIds.length;
        const numRounds = Math.ceil(Math.log2(numPlayers));
        const nextPowerOf2 = Math.pow(2, numRounds);

        let playersWithByes: (string | null)[] = [...playerIds];
        while (playersWithByes.length < nextPowerOf2) {
            playersWithByes.push(null);
        }

        playersWithByes = this.shuffleArray(playersWithByes);

        const matches: TournamentMatchInsert[] = [];
        let matchIdMatrix: string[][] = [];

        const firstRoundMatches: string[] = [];
        for (let i = 0; i < playersWithByes.length; i += 2) {
            const matchId = this.generateMatchId();
            firstRoundMatches.push(matchId);

            const p1 = playersWithByes[i];
            const p2 = playersWithByes[i + 1];
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
                sets: null,
            });
        }
        matchIdMatrix.push(firstRoundMatches);

        for (let round = 2; round <= numRounds; round++) {
            const prevRoundMatches = matchIdMatrix[round - 2];
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
                    round: round,
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

        return matches;
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

        const allMatches = await this.repository.getTournamentMatches(tournamentId);
        const finalMatch = allMatches.find(m => !m.nextMatchId && m.status === 'completed');

        if (finalMatch && finalMatch.winner) {
            await this.repository.setTournamentWinner(tournamentId, finalMatch.winner);
        }
    }

    async determineWinner(tournamentId: string, matches: TournamentMatch[]): Promise<string | null> {
        const finalMatch = matches.find(m => !m.nextMatchId && m.status === 'completed');
        return finalMatch?.winner || null;
    }
}
