import type {RealtimePostgresChangesPayload} from "@supabase/supabase-js";
import type {
    Set as BackendMatchSet,
    Tournament as BackendTournament,
    TournamentFormat as BackendTournamentFormat,
    TournamentMatch as BackendTournamentMatch,
    TournamentStatus as BackendTournamentStatus,
} from '@/backend/types';

export type Tournament = Omit<BackendTournament, 'matches'> & {
    matches: TournamentMatch[];
};

export type TournamentMatch = Omit<BackendTournamentMatch, 'status'> & {
    /** Extended status to cover initial DB value before mapping */
    status: BackendTournamentMatch['status'] | 'pending_players';
    isUpdating?: boolean;
};

export {TournamentFormat} from '@/backend/types';

export {TournamentStatus} from '@/backend/types';

export type MatchSet = BackendMatchSet;

export interface TournamentStoreState {
    tournaments: Tournament[];
    loading: boolean;
    error: string | null;
    lastFetchTimestamp: number | null;
}

export interface TournamentStoreActions {
    /** Handles real-time updates for tournament records. */
    handleTournamentUpdate: (payload: RealtimePostgresChangesPayload<Tournament>) => void;
    /** Handles real-time updates for tournament match records. */
    handleMatchUpdate: (payload: RealtimePostgresChangesPayload<TournamentMatch>) => void;
    /** Fetches all tournaments from the backend. */
    fetchTournaments: (options?: { force?: boolean }) => Promise<void>;
    /** Creates a new tournament. */
    createTournament: (name: string, date: string, format: BackendTournamentFormat, playerIds: string[]) => Promise<string | undefined>;
    /** Generates matches for the knockout phase of a group tournament. */
    generateTournamentMatches: (tournamentId: string) => Promise<void>;
    /** Updates the result of a specific match within a tournament. */
    updateMatchResult: (
        tournamentId: string,
        matchId: string,
        scores: { player1Score: number; player2Score: number; sets?: MatchSet[] }
    ) => Promise<void>;
    /** Updates the status of a tournament (e.g., from 'pending' to 'active'). */
    updateTournamentStatus: (tournamentId: string, status: BackendTournamentStatus) => Promise<void>;
    /** Sets the winner of a tournament and marks it as completed. */
    setTournamentWinner: (tournamentId: string, winnerId: string) => Promise<void>;
    /** Generates the initial matches for a tournament and sets its status to 'active'. */
    generateAndStartTournament: (tournamentId: string) => Promise<void>;
}

export interface TournamentStoreGetters {
    /** Retrieves a specific tournament by its ID. */
    getTournamentById: (id: string) => Tournament | undefined;
    /** Retrieves all matches for a given tournament ID. */
    getTournamentMatches: (tournamentId: string) => TournamentMatch[];
    /** Retrieves all tournaments with a 'pending' or 'upcoming' status. */
    getUpcomingTournaments: () => Tournament[];
    /** Retrieves all tournaments that are currently 'active' or 'in_progress'. */
    getActiveTournaments: () => Tournament[];
    /** Retrieves all tournaments that have been 'completed'. */
    getCompletedTournaments: () => Tournament[];
    /** Calculates the number of tournaments a specific player has won. */
    getPlayerTournamentWins: (playerId: string) => number;
}

export type FullTournamentStore = TournamentStoreState & TournamentStoreActions & TournamentStoreGetters;
