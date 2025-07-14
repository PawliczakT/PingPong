import {useTournamentStore} from '@/store/tournamentStore';
import {Tournament, TournamentFormat, TournamentStatus} from '@/backend/types';
import {supabase} from '@/app/lib/supabase';
import {usePlayerStore} from '@/store/playerStore';
import {dispatchSystemNotification} from '@/backend/server/trpc/services/notificationService';

// Mock Supabase client once globally for all tests
jest.mock('@/app/lib/supabase', () => {
    // Helpers to create query builders for different tables
    const createTournamentBuilder = () => ({
        insert: jest.fn(() => ({
            // insert().select().single()
            select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({data: {id: 'tournament1'}, error: null})),
            })),
        })),
        update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({error: null})),
        })),
        delete: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({error: null})),
        })),
        select: jest.fn(() => ({
            order: jest.fn(() => ({data: [], error: null})),
        })),
    });

    const createGenericBuilder = () => ({
        insert: jest.fn(() => Promise.resolve({error: null})),
        update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({error: null})),
        })),
        delete: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({error: null})),
        })),
        select: jest.fn(() => ({order: jest.fn(() => ({data: [], error: null}))})),
    });

    const fromMock = jest.fn((table: string) => {
        if (table === 'tournaments') return createTournamentBuilder();
        return createGenericBuilder();
    });

    const supabase = {
        from: fromMock,
        channel: jest.fn(() => ({on: jest.fn().mockReturnThis(), subscribe: jest.fn()})),
        removeChannel: jest.fn(),
    };

    return {supabase};
});

// Mock playerStore so we can stub getPlayerById in specific tests
jest.mock('@/store/playerStore', () => ({
    usePlayerStore: {
        getState: jest.fn(),
    },
}));

// Mock notification service (no-op)
jest.mock('@/backend/server/trpc/services/notificationService', () => ({
    dispatchSystemNotification: jest.fn(),
}));

// --------------------
// Helper utilities
// --------------------

/** Convenience helper for resetting the Zustand store between tests */
const resetTournamentStoreState = () => {
    useTournamentStore.setState({
        tournaments: [],
        loading: false,
        error: null,
        lastFetchTimestamp: null,
    });
};

// --------------------
// Test Suite
// --------------------

describe('useTournamentStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetTournamentStoreState();
    });

    // ---------------------------------------------------------------------
    // createTournament
    // ---------------------------------------------------------------------
    describe('createTournament', () => {
        it('creates a knockout tournament when provided valid input', async () => {
            const store = useTournamentStore.getState();
            // Prevent actual fetchTournaments logic (it triggers extra Supabase calls we don’t need here)
            jest.spyOn(store, 'fetchTournaments').mockResolvedValue();

            const players = ['p1', 'p2', 'p3', 'p4'];
            const newId = await store.createTournament('Test Cup', '2025-07-15', TournamentFormat.KNOCKOUT, players);

            // Returns generated id
            expect(newId).toBeDefined();
            // Supabase insert into tournaments
            expect(supabase.from).toHaveBeenCalledWith('tournaments');
            // Supabase insert into participants
            expect(supabase.from).toHaveBeenCalledWith('tournament_participants');
            // No error set in store
            expect(useTournamentStore.getState().error).toBeNull();
        });

        it('rejects creation when fewer than 2 players are supplied', async () => {
            const store = useTournamentStore.getState();
            jest.spyOn(store, 'fetchTournaments').mockResolvedValue();

            const result = await store.createTournament('Too Small', '2025-07-15', TournamentFormat.ROUND_ROBIN, ['p1']);

            expect(result).toBeUndefined();
            expect(useTournamentStore.getState().error).not.toBeNull();
            // Supabase shouldn’t be called because validation failed early
            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('rejects knockout tournaments with an odd number of players', async () => {
            const store = useTournamentStore.getState();
            jest.spyOn(store, 'fetchTournaments').mockResolvedValue();

            const result = await store.createTournament('Odd KO', '2025-07-15', TournamentFormat.KNOCKOUT, ['p1', 'p2', 'p3']);

            expect(result).toBeUndefined();
            expect(useTournamentStore.getState().error).not.toBeNull();
        });
    });

    // ---------------------------------------------------------------------
    // updateTournamentStatus
    // ---------------------------------------------------------------------
    describe('updateTournamentStatus', () => {
        it('updates tournament status in store and via Supabase', async () => {
            const initial: Tournament = {
                id: 't1',
                name: 'Initial Tournament',
                date: '2025-07-15',
                format: TournamentFormat.KNOCKOUT,
                status: TournamentStatus.UPCOMING,
                participants: [],
                matches: [],
            };
            useTournamentStore.setState({tournaments: [initial]});

            await useTournamentStore.getState().updateTournamentStatus('t1', TournamentStatus.IN_PROGRESS);

            const updated = useTournamentStore.getState().getTournamentById('t1');
            expect(updated?.status).toBe(TournamentStatus.IN_PROGRESS);
            // Verify Supabase update call
            expect(supabase.from).toHaveBeenCalledWith('tournaments');
        });
    });

    // ---------------------------------------------------------------------
    // setTournamentWinner
    // ---------------------------------------------------------------------
    describe('setTournamentWinner', () => {
        it('sets winner, marks tournament completed and dispatches notification', async () => {
            const tournament: Tournament = {
                id: 't2',
                name: 'Winner Takes All',
                date: '2025-07-15',
                format: TournamentFormat.KNOCKOUT,
                status: TournamentStatus.IN_PROGRESS,
                participants: ['player1', 'player2'],
                matches: [],
            };
            useTournamentStore.setState({tournaments: [tournament]});

            // Stub fetchTournaments (called internally)
            jest.spyOn(useTournamentStore.getState(), 'fetchTournaments').mockResolvedValue();

            // Stub playerStore so nickname lookup succeeds
            (usePlayerStore.getState as jest.Mock).mockReturnValue({
                getPlayerById: () => ({
                    id: 'player1',
                    nickname: 'Champ',
                    name: 'Champion',
                    eloRating: 1500,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    active: true,
                    createdAt: '',
                    updatedAt: '',
                }),
            });

            await useTournamentStore.getState().setTournamentWinner('t2', 'player1');

            const updated = useTournamentStore.getState().getTournamentById('t2');
            expect(updated?.winner).toBe('player1');
            expect(updated?.status).toBe(TournamentStatus.COMPLETED);
            expect(dispatchSystemNotification).toHaveBeenCalledTimes(1);
            expect(supabase.from).toHaveBeenCalledWith('tournaments');
        });
    });

    // ---------------------------------------------------------------------
    // Selector functions
    // ---------------------------------------------------------------------
    describe('selectors', () => {
        it('correctly filters tournaments by status and counts wins', () => {
            const tournaments: Tournament[] = [
                {
                    id: 'u1',
                    name: 'Upcoming',
                    date: '',
                    format: TournamentFormat.KNOCKOUT,
                    status: TournamentStatus.UPCOMING,
                    participants: [],
                    matches: [],
                },
                {
                    id: 'a1',
                    name: 'Active',
                    date: '',
                    format: TournamentFormat.KNOCKOUT,
                    status: TournamentStatus.IN_PROGRESS,
                    participants: [],
                    matches: [],
                },
                {
                    id: 'c1',
                    name: 'Completed 1',
                    date: '',
                    format: TournamentFormat.ROUND_ROBIN,
                    status: TournamentStatus.COMPLETED,
                    participants: [],
                    matches: [],
                    winner: 'player1',
                },
                {
                    id: 'c2',
                    name: 'Completed 2',
                    date: '',
                    format: TournamentFormat.KNOCKOUT,
                    status: TournamentStatus.COMPLETED,
                    participants: [],
                    matches: [],
                    winner: 'player1',
                },
            ];
            useTournamentStore.setState({tournaments});

            const state = useTournamentStore.getState();
            expect(state.getUpcomingTournaments().length).toBe(1);
            expect(state.getActiveTournaments().length).toBe(1);
            expect(state.getCompletedTournaments().length).toBe(2);
            expect(state.getPlayerTournamentWins('player1')).toBe(2);
        });
    });
});
