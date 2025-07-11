/**
 * @fileoverview Defines getters (selectors) for the tournament store.
 * These functions derive data from the store's state.
 * They take the Zustand `get` function as an argument to access the current state.
 */
import type { StateCreator } from 'zustand';
import type {
    TournamentStoreState,
    Tournament,
    TournamentMatch,
    TournamentStatus,
    FullTournamentStore,
    TournamentStoreGetters,
    TournamentStoreActions
} from './tournamentTypes';
import { transformMatchData } from './tournamentLogic'; // In case raw match data needs transformation

/**
 * Creates the getters slice for the tournament store.
 * These functions are selectors that derive data from the current store state.
 *
 * @param set - Zustand's `set` function (not typically used by getters).
 * @param get - Zustand's `get` function to access current state.
 * @param store - The Zustand store api.
 * @returns {TournamentStoreGetters} An object containing all getter functions.
 */
export const createTournamentGetters: StateCreator<
    FullTournamentStore,
    [], // No special middlewares needed for getters usually
    [],
    TournamentStoreGetters
> = (set, get) => ({
    getTournamentById: (id: string): Tournament | undefined => {
        return get().tournaments.find(t => t.id === id);
    },

    getTournamentMatches: (tournamentId: string): TournamentMatch[] => {
        const tournament = get().getTournamentById(tournamentId); // Use existing getter
        if (!tournament || !Array.isArray(tournament.matches)) {
            return [];
        }
        // The matches in the state should already be processed by fetchTournaments or realtime updates.
        // If any ad-hoc transformation were needed, it would go here.
        // The original store had a complex mapping here, but it seems matches are already well-formed in state.
        // The `transformMatchData` in original `getTournamentMatches` was likely for safety/consistency,
        // but if `fetchTournaments` and `handleMatchUpdate` already use it, it might be redundant here.
        // For now, returning them as is, assuming they are correctly typed TournamentMatch objects.
        // Adding a safety map if any object is not fully processed.
        return tournament.matches.map(m => ({
            ...m, // Spread existing properties
            // Ensure all required fields from TournamentMatch are present, applying defaults or transformations if needed
            status: m.status === 'pending_players' ? 'pending' : m.status, // Example of a small adjustment
            player1Score: m.player1Score ?? null,
            player2Score: m.player2Score ?? null,
            nextMatchId: m.nextMatchId ?? null,
            // matchId might be an alias for id, ensure consistency
            matchId: m.matchId ?? m.id,
        })) as TournamentMatch[]; // Cast to ensure type compliance
    },

    getUpcomingTournaments: (): Tournament[] => {
        return get().tournaments.filter(t => t.status === TournamentStatus.UPCOMING || t.status === TournamentStatus.PENDING);
    },

    getActiveTournaments: (): Tournament[] => {
        return get().tournaments.filter(t => t.status === TournamentStatus.ACTIVE);
    },

    getCompletedTournaments: (): Tournament[] => {
        return get().tournaments.filter(t => t.status === TournamentStatus.COMPLETED);
    },

    getPlayerTournamentWins: (playerId: string): number => {
        const completedTournaments = get().getCompletedTournaments(); // Use existing getter
        return completedTournaments.filter(t => t.winner === playerId).length;
    },
});
