/**
 * Tournament Helper Utilities
 * Common utility functions for tournament operations
 */
import {Set as MatchSet, Tournament, TournamentFormat, TournamentMatch} from '../../backend/types';

export class TournamentHelper {
    /**
     * Generate automatic tournament name
     */
    static async generateTournamentName(format?: TournamentFormat): Promise<string> {
        try {
            const {supabase} = require('../../app/lib/supabase');

            const {data: existingTournaments, error} = await supabase
                .from('tournaments')
                .select('name')
                .ilike('name', 'Tournament %');

            if (error) {
                return "Tournament 1";
            }

            let maxNumber = 0;
            existingTournaments?.forEach((t: { name: string }) => {
                const match = t.name.match(/Tournament (\d+)/);
                if (match && match[1]) {
                    const num = parseInt(match[1]);
                    if (!isNaN(num) && num > maxNumber) {
                        maxNumber = num;
                    }
                }
            });

            const baseName = `Tournament ${maxNumber + 1}`;
            return format ? `${baseName} (${format})` : baseName;
        } catch (error) {
            console.error('Error generating tournament name:', error);
            return "Tournament 1";
        }
    }

    /**
     * Calculate tournament duration estimate
     */
    static estimateTournamentDuration(format: TournamentFormat, playerCount: number): {
        estimatedMatches: number;
        estimatedDurationMinutes: number;
        estimatedRounds: number;
    } {
        const AVERAGE_MATCH_DURATION = 15; // minutes

        let estimatedMatches = 0;
        let estimatedRounds = 0;

        switch (format) {
            case TournamentFormat.KNOCKOUT:
                estimatedMatches = playerCount - 1;
                estimatedRounds = Math.ceil(Math.log2(playerCount));
                break;
            case TournamentFormat.ROUND_ROBIN:
                estimatedMatches = (playerCount * (playerCount - 1)) / 2;
                estimatedRounds = 1;
                break;
            case TournamentFormat.DOUBLE_ELIMINATION:
                estimatedMatches = (playerCount * 2) - 2;
                estimatedRounds = Math.ceil(Math.log2(playerCount)) * 2;
                break;
            case TournamentFormat.GROUP:
                const groupCount = Math.min(4, Math.ceil(playerCount / 3));
                const playersPerGroup = Math.ceil(playerCount / groupCount);
                const groupMatches = groupCount * ((playersPerGroup * (playersPerGroup - 1)) / 2);
                const knockoutMatches = groupCount - 1;
                estimatedMatches = groupMatches + knockoutMatches;
                estimatedRounds = 2;
                break;
        }

        return {
            estimatedMatches,
            estimatedDurationMinutes: estimatedMatches * AVERAGE_MATCH_DURATION,
            estimatedRounds
        };
    }

    /**
     * Get tournament progress percentage
     */
    static calculateTournamentProgress(tournament: Tournament): number {
        if (!tournament.matches || tournament.matches.length === 0) {
            return 0;
        }

        const completedMatches = tournament.matches.filter(m => m.status === 'completed').length;
        return Math.round((completedMatches / tournament.matches.length) * 100);
    }

    /**
     * Get next matches to be played
     */
    static getNextMatches(tournament: Tournament, limit: number = 5): TournamentMatch[] {
        if (!tournament.matches) return [];

        return tournament.matches
            .filter(m => m.status === 'scheduled')
            .sort((a, b) => {
                if (a.round !== b.round) return a.round - b.round;
                return (a.matchNumber || 0) - (b.matchNumber || 0);
            })
            .slice(0, limit);
    }

    /**
     * Get tournament standings/rankings
     */
    static getTournamentStandings(tournament: Tournament): Array<{
        playerId: string;
        wins: number;
        losses: number;
        setsWon: number;
        setsLost: number;
        pointsWon: number;
        pointsLost: number;
        winRate: number;
    }> {
        if (!tournament.matches) return [];

        const playerStats = new Map<string, {
            wins: number;
            losses: number;
            setsWon: number;
            setsLost: number;
            pointsWon: number;
            pointsLost: number;
        }>();

        tournament.participants.forEach(playerId => {
            playerStats.set(playerId, {
                wins: 0,
                losses: 0,
                setsWon: 0,
                setsLost: 0,
                pointsWon: 0,
                pointsLost: 0
            });
        });

        tournament.matches
            .filter(m => m.status === 'completed' && m.player1Id && m.player2Id)
            .forEach(match => {
                const p1Stats = playerStats.get(match.player1Id!);
                const p2Stats = playerStats.get(match.player2Id!);

                if (!p1Stats || !p2Stats) return;

                if (match.winner === match.player1Id) {
                    p1Stats.wins++;
                    p2Stats.losses++;
                } else if (match.winner === match.player2Id) {
                    p2Stats.wins++;
                    p1Stats.losses++;
                }

                if (match.sets && Array.isArray(match.sets)) {
                    match.sets.forEach((set: MatchSet) => {
                        p1Stats.pointsWon += set.player1Score;
                        p1Stats.pointsLost += set.player2Score;
                        p2Stats.pointsWon += set.player2Score;
                        p2Stats.pointsLost += set.player1Score;

                        if (set.player1Score > set.player2Score) {
                            p1Stats.setsWon++;
                            p2Stats.setsLost++;
                        } else if (set.player2Score > set.player1Score) {
                            p2Stats.setsWon++;
                            p1Stats.setsLost++;
                        }
                    });
                }
            });

        return Array.from(playerStats.entries()).map(([playerId, stats]) => ({
            playerId,
            ...stats,
            winRate: stats.wins + stats.losses > 0 ? stats.wins / (stats.wins + stats.losses) : 0
        })).sort((a, b) => {
            if (a.wins !== b.wins) return b.wins - a.wins;
            if (a.winRate !== b.winRate) return b.winRate - a.winRate;
            return b.setsWon - a.setsWon;
        });
    }

    /**
     * Validate match result
     */
    static validateMatchResult(scores: {
        player1Score: number;
        player2Score: number;
        sets?: MatchSet[];
    }): { valid: boolean; error?: string } {
        if (scores.player1Score === scores.player2Score) {
            return {valid: false, error: 'Scores cannot be equal'};
        }

        if (scores.player1Score < 0 || scores.player2Score < 0) {
            return {valid: false, error: 'Scores cannot be negative'};
        }

        if (scores.sets) {
            const totalP1Sets = scores.sets.reduce((sum, set) =>
                sum + (set.player1Score > set.player2Score ? 1 : 0), 0);
            const totalP2Sets = scores.sets.reduce((sum, set) =>
                sum + (set.player2Score > set.player1Score ? 1 : 0), 0);

            if (totalP1Sets !== scores.player1Score || totalP2Sets !== scores.player2Score) {
                return {valid: false, error: 'Set scores do not match match scores'};
            }

            for (const set of scores.sets) {
                if (set.player1Score < 0 || set.player2Score < 0) {
                    return {valid: false, error: 'Set scores cannot be negative'};
                }
                if (set.player1Score === set.player2Score) {
                    return {valid: false, error: 'Set scores cannot be equal'};
                }
            }
        }

        return {valid: true};
    }

    /**
     * Format tournament bracket for display
     */
    static formatBracket(matches: TournamentMatch[]): {
        rounds: Array<{
            round: number;
            matches: TournamentMatch[];
        }>;
        maxRound: number;
    } {
        const rounds = new Map<number, TournamentMatch[]>();
        let maxRound = 0;

        matches.forEach(match => {
            if (!rounds.has(match.round)) {
                rounds.set(match.round, []);
            }
            rounds.get(match.round)!.push(match);
            maxRound = Math.max(maxRound, match.round);
        });

        const sortedRounds = Array.from(rounds.entries())
            .sort(([a], [b]) => a - b)
            .map(([round, roundMatches]) => ({
                round,
                matches: roundMatches.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))
            }));

        return {
            rounds: sortedRounds,
            maxRound
        };
    }

    /**
     * Check if tournament can be started
     */
    static canStartTournament(tournament: Tournament): { canStart: boolean; reason?: string } {
        if (tournament.status !== 'pending') {
            return {canStart: false, reason: 'Tournament is not in pending state'};
        }

        if (!tournament.participants || tournament.participants.length < 2) {
            return {canStart: false, reason: 'Tournament needs at least 2 participants'};
        }

        switch (tournament.format) {
            case TournamentFormat.KNOCKOUT:
            case TournamentFormat.DOUBLE_ELIMINATION:
                if (tournament.participants.length % 4 !== 0) {
                    return {
                        canStart: false,
                        reason: `${tournament.format} tournaments require a number of players divisible by 4`
                    };
                }
                break;
            case TournamentFormat.GROUP:
                if (tournament.participants.length < 6) {
                    return {canStart: false, reason: 'Group tournaments require at least 6 players'};
                }
                break;
        }

        return {canStart: true};
    }

    /**
     * Get tournament type display name
     */
    static getFormatDisplayName(format: TournamentFormat): string {
        switch (format) {
            case TournamentFormat.KNOCKOUT:
                return 'Single Elimination';
            case TournamentFormat.DOUBLE_ELIMINATION:
                return 'Double Elimination';
            case TournamentFormat.ROUND_ROBIN:
                return 'Round Robin';
            case TournamentFormat.GROUP:
                return 'Group Stage + Knockout';
            default:
                return format;
        }
    }
}
