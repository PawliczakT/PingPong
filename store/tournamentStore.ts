/**
 * @fileoverview Main Zustand store for tournament management.
 * Combines state, actions, and getters from modularized files.
 * Uses Immer middleware for easier state mutations.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FullTournamentStore } from './tournament/tournamentTypes';
import { initialState } from './tournament/tournamentState';
import { createTournamentActions } from './tournament/tournamentActions';
import { createTournamentGetters } from './tournament/tournamentGetters';
// The realtime hook is exported separately and should be used in a React component.
export { useTournamentsRealtimeUpdates } from './tournament/tournamentRealtime';

/**
 * Creates the main tournament store using Zustand.
 *
 * The store is structured with:
 * - Initial state defined in `tournamentState.ts`.
 * - Action functions (async operations, state mutations) from `tournamentActions.ts`.
 * - Getter functions (derived state selectors) from `tournamentGetters.ts`.
 * - Immer middleware is applied for simplified immutable state updates.
 *
 * @example
 * const tournaments = useTournamentStore(state => state.tournaments);
 * const fetchTournaments = useTournamentStore(state => state.fetchTournaments);
 * fetchTournaments();
 */
export const useTournamentStore = create<FullTournamentStore>()(
    immer((set, get, store) => ({
        ...initialState,
        ...createTournamentActions(
            set as unknown as StoreApi<FullTournamentStore>['setState'], // Cast needed due to Immer's wrapped set
            get,
            store as unknown as StoreApi<FullTournamentStore> // Cast for store api
        ),
        ...createTournamentGetters(
            set as unknown as StoreApi<FullTournamentStore>['setState'],  // Cast needed
            get,
            store as unknown as StoreApi<FullTournamentStore> // Cast for store api
        ),
        // The realtime update handlers (handleTournamentUpdate, handleMatchUpdate) are now part of
        // tournamentActions.ts, but their primary invocation is via the useTournamentsRealtimeUpdates hook
        // which calls store.setState directly.
        // If these handlers were to be exposed on the store directly for other uses,
        // they would be initialized here as well, similar to actions and getters.
        // For now, they are correctly placed within createTournamentActions.ts
        // and the stubs there satisfy the FullTournamentStore type.
        // The actual realtime logic is in tournamentRealtime.ts's handlers which use setState.
    }))
);

/**
 * Initializes the tournament store by fetching initial data.
 * This can be called once when the application loads.
 * Also, the realtime hook `useTournamentsRealtimeUpdates` should be mounted in a root component.
 */
export const initTournamentStore = () => {
    // Fetch initial tournaments when the store is initialized.
    // This helps populate the store on app startup.
    useTournamentStore.getState().fetchTournaments();

    // Note: The useTournamentsRealtimeUpdates() hook must be called from within a React component
    // to correctly subscribe to realtime updates. For example, in your main App component:
    //
    // import { useTournamentsRealtimeUpdates, useTournamentStore } from '@/store/tournamentStore';
    //
    // function App() {
    //   useTournamentsRealtimeUpdates(useTournamentStore); // Initialize realtime updates
    //   // ... rest of your app
    // }
};

// Example of calling init function (optional, depends on app structure)
// initTournamentStore();
