/**
 * Base tournament strategy interface
 * Implements the Strategy Pattern for different tournament types
 */
import {Set as MatchSet, TournamentFormat, TournamentMatch} from '@/backend/types';

export interface ITournamentStrategy {
    readonly format: TournamentFormat;

    /**
     * Generate matches for the tournament
     */
    generateMatches(tournamentId: string, playerIds: string[]): Promise<TournamentMatchInsert[]>;

    /**
     * Update match result and handle progression logic
     */
    updateMatchResult(
        tournamentId: string,
        matchId: string,
        scores: { player1Score: number; player2Score: number; sets?: MatchSet[] }
    ): Promise<void>;

    /**
     * Determine tournament winner
     */
    determineWinner(tournamentId: string, matches: TournamentMatch[]): Promise<string | null>;

    /**
     * Validate tournament configuration
     */
    validateConfiguration(playerIds: string[]): { valid: boolean; error?: string };
}

export interface TournamentMatchInsert {
    id: string;
    tournament_id: string;
    round: number;
    match_number: number;
    player1_id: string | null;
    player2_id: string | null;
    player1_score: number | null;
    player2_score: number | null;
    winner_id: string | null;
    status: TournamentMatch['status'];
    next_match_id: string | null;
    stage?: string | null;
    bracket?: 'winners' | 'losers' | 'final' | null;
    group?: number | null;
    sets?: MatchSet[] | null;
}

/**
 * Abstract base class for tournament strategies
 */
export abstract class BaseTournamentStrategy implements ITournamentStrategy {
    abstract readonly format: TournamentFormat;

    abstract generateMatches(tournamentId: string, playerIds: string[]): Promise<TournamentMatchInsert[]>;

    abstract updateMatchResult(
        tournamentId: string,
        matchId: string,
        scores: { player1Score: number; player2Score: number; sets?: MatchSet[] }
    ): Promise<void>;

    abstract determineWinner(tournamentId: string, matches: TournamentMatch[]): Promise<string | null>;

    abstract validateConfiguration(playerIds: string[]): { valid: boolean; error?: string };

    /**
     * Utility method to shuffle array
     */
    protected shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        let currentIndex = shuffled.length, randomIndex;

        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [shuffled[currentIndex], shuffled[randomIndex]] = [
                shuffled[randomIndex], shuffled[currentIndex]
            ];
        }

        return shuffled;
    }

    /**
     * Generate unique match ID
     */
    protected generateMatchId(): string {
        return crypto.randomUUID();
    }
}
