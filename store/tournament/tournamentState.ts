/**
 * @fileoverview Defines the state structure and initial state for the tournament store.
 */

import type { TournamentStoreState } from './tournamentTypes';

/**
 * The initial state for the tournament store.
 * @property {Tournament[]} tournaments - Initially empty list of tournaments.
 * @property {boolean} loading - Set to false, as no operation is in progress initially.
 * @property {string | null} error - No errors initially.
 * @property {number | null} lastFetchTimestamp - No fetch has occurred yet.
 */
export const initialState: TournamentStoreState = {
  tournaments: [],
  loading: false,
  error: null,
  lastFetchTimestamp: null,
};

/**
 * Selector to get the current tournament state.
 * This is a placeholder and will be used by Zustand's `get` function.
 * In a more complex scenario with multiple state slices, this might select a specific part of the global state.
 * For now, it assumes the state passed to it is the TournamentStoreState itself.
 *
 * @param {TournamentStoreState} state - The current tournament store state.
 * @returns {TournamentStoreState} The tournament store state.
 */
export const getTournamentState = (state: TournamentStoreState): TournamentStoreState => state;
