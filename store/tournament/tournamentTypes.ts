/**
 * @fileoverview Shared type definitions for the tournament store.
 * Re-exports core types from backend and defines store-specific state and action types.
 */

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type {
  Tournament as BackendTournament,
  TournamentMatch as BackendTournamentMatch,
  TournamentFormat as BackendTournamentFormat,
  TournamentStatus as BackendTournamentStatus,
  Set as BackendMatchSet,
} from '@/backend/types';

/**
 * Re-export of the main Tournament type from backend.
 * @typedef {BackendTournament} Tournament
 */
export type Tournament = BackendTournament;

/**
 * Re-export of the TournamentMatch type from backend.
 * @typedef {BackendTournamentMatch} TournamentMatch
 */
export type TournamentMatch = BackendTournamentMatch;

/**
 * Re-export of the TournamentFormat enum from backend.
 * @typedef {BackendTournamentFormat} TournamentFormat
 */
export { TournamentFormat } from '@/backend/types';

/**
 * Re-export of the TournamentStatus enum from backend.
 * @typedef {BackendTournamentStatus} TournamentStatus
 */
export { TournamentStatus } from '@/backend/types';

/**
 * Re-export of the MatchSet type from backend.
 * @typedef {BackendMatchSet} MatchSet
 */
export type MatchSet = BackendMatchSet;


/**
 * Represents the state of the tournament store.
 * @property {Tournament[]} tournaments - List of all tournaments.
 * @property {boolean} loading - Indicates if an operation is in progress.
 * @property {string | null} error - Stores error messages, if any.
 * @property {number | null} lastFetchTimestamp - Timestamp of the last successful fetch.
 */
export interface TournamentStoreState {
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  lastFetchTimestamp: number | null;
}

/**
 * Defines the structure for functions that will interact with and modify the tournament state.
 * These are typically asynchronous operations.
 */
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

/**
 * Defines the structure for functions that retrieve or derive data from the tournament state.
 * These are typically synchronous and should be memoized if computationally expensive.
 */
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

/**
 * Represents the complete structure of the tournament store, combining state, actions, and getters.
 */
export type FullTournamentStore = TournamentStoreState & TournamentStoreActions & TournamentStoreGetters;
