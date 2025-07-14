import type {TournamentStoreState} from './tournamentTypes';

export const initialState: TournamentStoreState = {
    tournaments: [],
    loading: false,
    error: null,
    lastFetchTimestamp: null,
};

export const getTournamentState = (state: TournamentStoreState): TournamentStoreState => state;
