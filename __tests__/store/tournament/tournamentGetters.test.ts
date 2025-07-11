/**
 * @fileoverview Unit tests for tournamentGetters.ts
 */
import { createTournamentGetters } from '@/store/tournament/tournamentGetters';
import type { FullTournamentStore, Tournament, TournamentMatch, TournamentStoreState } from '@/store/tournament/tournamentTypes';
import { TournamentStatus, TournamentFormat } from '@/store/tournament/tournamentTypes';
import { initialState } from '@/store/tournament/tournamentState';

// Helper to create a mock state and the `get` function similar to Zustand's
const setupMockStore = (partialState: Partial<TournamentStoreState> = {}): FullTournamentStore => {
    const state: TournamentStoreState = {
        ...initialState,
        ...partialState,
    };

    // Mock the full store structure that getters might expect via `get()`
    // For getters, we primarily need the state and other getters. Actions are not typically called by getters.
    const mockGet = jest.fn(() => store as FullTournamentStore);
    const mockSet = jest.fn(); // `set` is not used by getters but required by StateCreator

    const store = {
        ...state,
        // Initialize getters by calling their creator
        ...(createTournamentGetters(mockSet, mockGet, {} as any) as any),
        // Stub actions to satisfy FullTournamentStore, getters shouldn't call them
        fetchTournaments: jest.fn(),
        createTournament: jest.fn(),
        generateTournamentMatches: jest.fn(),
        updateMatchResult: jest.fn(),
        updateTournamentStatus: jest.fn(),
        setTournamentWinner: jest.fn(),
        generateAndStartTournament: jest.fn(),
        handleTournamentUpdate: jest.fn(),
        handleMatchUpdate: jest.fn(),
    } as FullTournamentStore;

    // Re-assign mockGet to return the fully constructed mock store
    mockGet.mockImplementation(() => store);

    return store;
};


describe('Tournament Getters', () => {
    const mockTournaments: Tournament[] = [
        { id: 't1', name: 'Tournament Alpha', date: '2023-01-01', format: TournamentFormat.KNOCKOUT, status: TournamentStatus.UPCOMING, participants: ['p1', 'p2'], matches: [], createdAt: '2023-01-01', updatedAt: '2023-01-01' },
        { id: 't2', name: 'Tournament Bravo', date: '2023-02-01', format: TournamentFormat.ROUND_ROBIN, status: TournamentStatus.ACTIVE, participants: ['p3', 'p4'], matches: [
            { id: 'm1', tournamentId: 't2', round: 1, matchNumber:1, player1Id: 'p3', player2Id: 'p4', status: 'scheduled', matchId: 'm1' } as TournamentMatch,
        ], createdAt: '2023-02-01', updatedAt: '2023-02-01' },
        { id: 't3', name: 'Tournament Charlie', date: '2023-03-01', format: TournamentFormat.GROUP, status: TournamentStatus.COMPLETED, winner: 'p5', participants: ['p5', 'p6'], matches: [], createdAt: '2023-03-01', updatedAt: '2023-03-01' },
        { id: 't4', name: 'Tournament Delta (Pending)', date: '2023-04-01', format: TournamentFormat.KNOCKOUT, status: TournamentStatus.PENDING, participants: ['p7', 'p8'], matches: [], createdAt: '2023-04-01', updatedAt: '2023-04-01' },
    ];

    describe('getTournamentById', () => {
        it('should return the correct tournament if found', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            const tournament = store.getTournamentById('t2');
            expect(tournament).toBeDefined();
            expect(tournament?.name).toBe('Tournament Bravo');
        });

        it('should return undefined if tournament not found', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            const tournament = store.getTournamentById('nonexistent');
            expect(tournament).toBeUndefined();
        });
    });

    describe('getTournamentMatches', () => {
        it('should return matches for a given tournament ID', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            const matches = store.getTournamentMatches('t2');
            expect(matches).toHaveLength(1);
            expect(matches[0].id).toBe('m1');
        });

        it('should return an empty array if tournament has no matches or tournament not found', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            expect(store.getTournamentMatches('t1')).toEqual([]); // Tournament exists, no matches
            expect(store.getTournamentMatches('nonexistent')).toEqual([]); // Tournament doesn't exist
        });

        it('should apply transformations like pending_players to pending', () => {
            const specificMatches: TournamentMatch[] = [
                 { id: 'm-pending', tournamentId: 't-specific', round: 1, matchNumber:1, player1Id: 'pA', player2Id: 'pB', status: 'pending_players', matchId: 'm-pending' } as TournamentMatch,
            ];
            const specificTournament: Tournament = { id: 't-specific', name: 'Specific', date: '2023-01-01', format: TournamentFormat.KNOCKOUT, status: TournamentStatus.ACTIVE, participants: [], matches: specificMatches, createdAt:'', updatedAt:''};
            const store = setupMockStore({ tournaments: [specificTournament] });
            const matches = store.getTournamentMatches('t-specific');
            expect(matches[0].status).toBe('pending');
        });
    });

    describe('getUpcomingTournaments', () => {
        it('should return upcoming and pending tournaments', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            const upcoming = store.getUpcomingTournaments();
            expect(upcoming).toHaveLength(2);
            expect(upcoming.find(t => t.id === 't1')).toBeDefined(); // Upcoming
            expect(upcoming.find(t => t.id === 't4')).toBeDefined(); // Pending
        });
    });

    describe('getActiveTournaments', () => {
        it('should return only active tournaments', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            const active = store.getActiveTournaments();
            expect(active).toHaveLength(1);
            expect(active[0].id).toBe('t2');
        });
    });

    describe('getCompletedTournaments', () => {
        it('should return only completed tournaments', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            const completed = store.getCompletedTournaments();
            expect(completed).toHaveLength(1);
            expect(completed[0].id).toBe('t3');
        });
    });

    describe('getPlayerTournamentWins', () => {
        it('should return the correct number of wins for a player', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            expect(store.getPlayerTournamentWins('p5')).toBe(1);
            expect(store.getPlayerTournamentWins('p1')).toBe(0);
        });

        it('should return 0 if player has no wins or does not exist', () => {
            const store = setupMockStore({ tournaments: mockTournaments });
            expect(store.getPlayerTournamentWins('nonexistentPlayer')).toBe(0);
        });
    });
});
