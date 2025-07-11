/**
 * @fileoverview Tests for the main tournament Zustand store.
 * Focuses on initial state, basic integration of modules, and selector correctness.
 * Detailed action/logic tests are in their respective module test files.
 */
import { useTournamentStore } from '@/store/tournamentStore';
import { initialState } from '@/store/tournament/tournamentState';
import { TournamentStatus, TournamentFormat } from '@/store/tournament/tournamentTypes';
import type { Tournament } from '@/store/tournament/tournamentTypes';

// Mock external dependencies used by actions/logic if they were to be called directly here.
// However, for this top-level test, we mostly verify state and selectors.
jest.mock('@/app/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    channel: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  },
}));

jest.mock('@/store/playerStore', () => ({
  usePlayerStore: {
    getState: jest.fn(() => ({
      getPlayerById: jest.fn(id => ({ id, nickname: `Player ${id}` })),
      // Add other playerStore mocks if needed by any tested utility
    })),
  },
}));

jest.mock('@/store/matchStore', () => ({
  useMatchStore: {
    getState: jest.fn(() => ({
      addMatch: jest.fn().mockResolvedValue({ id: 'mock-global-match-id' }),
      // Add other matchStore mocks
    })),
  },
}));

jest.mock('@/backend/server/trpc/services/notificationService', () => ({
    dispatchSystemNotification: jest.fn().mockResolvedValue(undefined),
}));


// Helper to reset store state before each test
const resetStore = () => {
  useTournamentStore.setState(initialState, true); // Replace state with initial
};

describe('Main Tournament Store (useTournamentStore)', () => {
  beforeEach(() => {
    resetStore();
    // Clear all mocks if other tests might have set them up
    jest.clearAllMocks();
  });

  it('should initialize with the correct initial state', () => {
    const state = useTournamentStore.getState();
    expect(state.tournaments).toEqual(initialState.tournaments);
    expect(state.loading).toEqual(initialState.loading);
    expect(state.error).toEqual(initialState.error);
    expect(state.lastFetchTimestamp).toEqual(initialState.lastFetchTimestamp);
  });

  it('should have all actions and getters defined from modules', () => {
    const state = useTournamentStore.getState();
    // Check for a few key actions and getters
    expect(typeof state.fetchTournaments).toBe('function');
    expect(typeof state.createTournament).toBe('function');
    expect(typeof state.getTournamentById).toBe('function');
    expect(typeof state.getActiveTournaments).toBe('function');
    // ... etc. for other important interface methods
  });

  describe('Selectors / Getters Integration', () => {
    const mockTournaments: Tournament[] = [
      { id: 't1', name: 'Upcoming Tourney', date: '2024-01-01', format: TournamentFormat.KNOCKOUT, status: TournamentStatus.UPCOMING, participants: ['p1', 'p2'], matches: [], createdAt: '', updatedAt: '' },
      { id: 't2', name: 'Active Tourney', date: '2024-01-02', format: TournamentFormat.ROUND_ROBIN, status: TournamentStatus.ACTIVE, participants: ['p3', 'p4'], matches: [], createdAt: '', updatedAt: '' },
      { id: 't3', name: 'Completed Tourney', date: '2024-01-03', format: TournamentFormat.GROUP, status: TournamentStatus.COMPLETED, winner: 'p5', participants: ['p5', 'p6'], matches: [], createdAt: '', updatedAt: '' },
      { id: 't4', name: 'Pending Tourney', date: '2024-01-04', format: TournamentFormat.KNOCKOUT, status: TournamentStatus.PENDING, participants: ['p1', 'p2'], matches: [], createdAt: '', updatedAt: '' },
    ];

    beforeEach(() => {
      // Seed the store with mock tournaments for getter tests
      useTournamentStore.setState({ tournaments: mockTournaments, loading: false, error: null, lastFetchTimestamp: Date.now() });
    });

    it('getTournamentById should retrieve the correct tournament', () => {
      const tournament = useTournamentStore.getState().getTournamentById('t2');
      expect(tournament).toBeDefined();
      expect(tournament?.name).toBe('Active Tourney');
    });

    it('getUpcomingTournaments should retrieve upcoming and pending tournaments', () => {
      const upcoming = useTournamentStore.getState().getUpcomingTournaments();
      expect(upcoming.length).toBe(2);
      expect(upcoming.some(t => t.id === 't1')).toBe(true); // UPCOMING
      expect(upcoming.some(t => t.id === 't4')).toBe(true); // PENDING
    });

    it('getActiveTournaments should retrieve active tournaments', () => {
      const active = useTournamentStore.getState().getActiveTournaments();
      expect(active.length).toBe(1);
      expect(active[0].id).toBe('t2');
    });

    it('getCompletedTournaments should retrieve completed tournaments', () => {
      const completed = useTournamentStore.getState().getCompletedTournaments();
      expect(completed.length).toBe(1);
      expect(completed[0].id).toBe('t3');
    });

    it('getPlayerTournamentWins should correctly count wins', () => {
      const wins = useTournamentStore.getState().getPlayerTournamentWins('p5');
      expect(wins).toBe(1);
      const winsP1 = useTournamentStore.getState().getPlayerTournamentWins('p1');
      expect(winsP1).toBe(0);
    });
  });

  // A very high-level test for an action could be done here,
  // but detailed testing of actions (including mocking Supabase responses)
  // should be in `tournamentActions.test.ts`.
  // This is just to ensure the action is wired up.
  describe('Actions Integration (Basic Check)', () => {
    it('fetchTournaments should attempt to set loading state (more detailed tests in actions test file)', async () => {
      // Mock supabase.from().select() for this specific call if not covered by global mock
      const mockSelect = jest.fn().mockResolvedValue({ data: [], error: null });
      (useTournamentStore.getState() as any)._supabase // Accessing potential internal for override if needed
        = { from: jest.fn().mockReturnThis(), select: mockSelect }; // Simplified mock path

      // Call the action
      // No direct await here as we are checking initial optimistic state update
      useTournamentStore.getState().fetchTournaments();

      // Check optimistic loading state (if fetch is quick, this might be flaky)
      // This kind of test is better in tournamentActions.test.ts with controlled async behavior.
      // For now, we assume it sets loading to true at some point.
      // A more robust test here would be to check if the mock for supabase was called.
      // This is primarily demonstrating that the action is callable.
      expect(useTournamentStore.getState().loading).toBe(true); // Check initial optimistic update

      // To properly test the outcome, you'd await and then check final state:
      // await promiseFromAction;
      // expect(useTournamentStore.getState().loading).toBe(false);
    });
  });

});
