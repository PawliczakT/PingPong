/**
 * @fileoverview Unit tests for tournamentActions.ts
 */
import type { StateCreator, StoreApi } from 'zustand';
import { createTournamentActions } from '@/store/tournament/tournamentActions';
import type {
    FullTournamentStore,
    TournamentStoreState,
    Tournament,
    TournamentMatch,
    MatchSet,
    TournamentFormat,
    TournamentStatus,
    TournamentStoreActions,
} from '@/store/tournament/tournamentTypes';
import * as tournamentLogic from '@/store/tournament/tournamentLogic';
import { initialState } from '@/store/tournament/tournamentState';
import { supabase }sfrom '@/app/lib/supabase'; // Actual import for mocking
import { useMatchStore } from '@/store/matchStore';
import { usePlayerStore } from '@/store/playerStore';
import { dispatchSystemNotification } from '@/backend/server/trpc/services/notificationService';
import { v4 as uuidv4 } from 'uuid';

// Mock an entire module
jest.mock('@/app/lib/supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }), // Default single mock
    },
}));

jest.mock('uuid');
jest.mock('@/store/matchStore');
jest.mock('@/store/playerStore');
jest.mock('@/backend/server/trpc/services/notificationService');
// Mock specific functions from tournamentLogic if they are complex and tested separately
// or if we want to control their output directly in action tests.
// For now, we might let some simpler logic functions run if they don't have external deps.
// However, for generateKnockoutPhase and autoSelectRoundRobinWinner which have side effects, mocking is good.
jest.mock('@/store/tournament/tournamentLogic', () => ({
    ...jest.requireActual('@/store/tournament/tournamentLogic'), // Import and retain default behavior for unmocked functions
    generateKnockoutPhase: jest.fn().mockResolvedValue([]), // Mock ones with side-effects
    autoSelectRoundRobinWinner: jest.fn().mockResolvedValue(null), // Mock ones with side-effects
}));


// Helper to set up a mock store environment for testing actions
const setupActionTestStore = (initialPartialState: Partial<TournamentStoreState> = {}) => {
    const state: TournamentStoreState = {
        ...initialState,
        ...initialPartialState,
    };

    // Using a simple object to collect set calls for assertions
    const setCalls: Partial<TournamentStoreState>[] = [];
    const mockSet = jest.fn((updater) => {
        if (typeof updater === 'function') {
            // Simulate Immer by allowing direct mutation
            const originalStateBeforeUpdate = JSON.parse(JSON.stringify(state)); // Deep clone for current state snapshot
            updater(state); // Apply mutations
            setCalls.push(JSON.parse(JSON.stringify(state))); // Store a snapshot of the new state
        } else {
            Object.assign(state, updater); // Merge for non-function updates
            setCalls.push(JSON.parse(JSON.stringify(updater)));
        }
    }) as unknown as StoreApi<FullTournamentStore>['setState'];

    const mockGet = jest.fn(() => state as FullTournamentStore) as unknown as StoreApi<FullTournamentStore>['getState'];

    // Create actions using the mock set and get
    const actions = createTournamentActions(mockSet, mockGet, {} as any); // Third arg 'store' api is not used by actions here

    return {
        actions,
        mockSet,
        mockGet,
        getState: () => state, // Utility to get current state directly
        getSetCalls: () => setCalls, // Utility to get all snapshots of state after set was called
    };
};


describe('Tournament Actions', () => {
    let store: ReturnType<typeof setupActionTestStore>;

    beforeEach(() => {
        store = setupActionTestStore();
        jest.clearAllMocks(); // Clear all mocks before each test

        // Resetting supabase mocks to default good states for most tests
        (supabase.from('tournaments').select as jest.Mock).mockResolvedValue({ data: [], error: null });
        (supabase.from('tournaments').insert as jest.Mock).mockResolvedValue({ data: [{ id: 'new-tournament-id' }], error: null });
        (supabase.from('tournaments').update as jest.Mock).mockResolvedValue({ error: null });
        (supabase.from('tournaments').delete as jest.Mock).mockResolvedValue({ error: null });
        (supabase.from('tournament_participants').insert as jest.Mock).mockResolvedValue({ error: null });
        (supabase.from('tournament_participants').select as jest.Mock).mockResolvedValue({ data: [], error: null });
        (supabase.from('tournament_matches').insert as jest.Mock).mockResolvedValue({ error: null });
        (supabase.from('tournament_matches').update as jest.Mock).mockResolvedValue({ error: null });
        (supabase.from('tournament_matches').delete as jest.Mock).mockResolvedValue({ error: null });
        (supabase.from('tournaments').single as jest.Mock).mockResolvedValue({ data: null, error: null });


        (uuidv4 as jest.Mock).mockReturnValue('mock-uuid-value');
        (useMatchStore.getState as jest.Mock).mockReturnValue({ addMatch: jest.fn().mockResolvedValue(undefined) });
        (usePlayerStore.getState as jest.Mock).mockReturnValue({ getPlayerById: jest.fn().mockReturnValue({ id: 'p1', nickname: 'Player 1' }) });
        (dispatchSystemNotification as jest.Mock).mockResolvedValue(undefined);
    });

    describe('fetchTournaments', () => {
        it('should fetch tournaments and update state', async () => {
            const mockTournamentData = [{ id: 't1', name: 'Fetched Tournament', matches: [] }];
            (supabase.from('tournaments').select as jest.Mock).mockResolvedValueOnce({ data: mockTournamentData, error: null });

            await store.actions.fetchTournaments();

            expect(store.mockSet).toHaveBeenCalledTimes(3); // loading=true, data, loading=false
            expect(store.getState().tournaments[0].name).toBe('Fetched Tournament');
            expect(store.getState().loading).toBe(false);
            expect(store.getState().lastFetchTimestamp).not.toBeNull();
        });

        it('should handle error during fetch', async () => {
            (supabase.from('tournaments').select as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'Fetch error' } });
            await store.actions.fetchTournaments();
            expect(store.getState().error).toBe('Failed to fetch tournaments: Fetch error');
            expect(store.getState().loading).toBe(false);
        });

        it('should not fetch if loading and not forced', async () => {
            store.getState().loading = true;
            await store.actions.fetchTournaments();
            expect(supabase.from('tournaments').select).not.toHaveBeenCalled();
        });

        it('should not fetch if within FETCH_INTERVAL and not forced', async () => {
            store.getState().lastFetchTimestamp = Date.now();
            await store.actions.fetchTournaments();
            expect(supabase.from('tournaments').select).not.toHaveBeenCalled();
        });

        it('should fetch if forced, even if loading', async () => {
            store.getState().loading = true;
            (supabase.from('tournaments').select as jest.Mock).mockResolvedValueOnce({ data: [], error: null });
            await store.actions.fetchTournaments({ force: true });
            expect(supabase.from('tournaments').select).toHaveBeenCalledTimes(1);
            expect(store.getState().loading).toBe(false);
        });
    });

    describe('createTournament', () => {
        it('should create a tournament and refresh list', async () => {
            const newTournamentId = 'new-tournament-id';
            (supabase.from('tournaments').insert as jest.Mock).mockResolvedValueOnce({ data: [{ id: newTournamentId }], error: null });
            (supabase.from('tournament_participants').insert as jest.Mock).mockResolvedValueOnce({ error: null });
            // Mock fetchTournaments to check if it's called for refresh
             const fetchSpy = jest.spyOn(store.actions, 'fetchTournaments').mockResolvedValue();


            const resultId = await store.actions.createTournament('New Tourney', '2023-01-01', TournamentFormat.KNOCKOUT, ['p1', 'p2']);

            expect(resultId).toBe(newTournamentId);
            expect(supabase.from('tournaments').insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Tourney' }));
            expect(supabase.from('tournament_participants').insert).toHaveBeenCalledWith([{ tournament_id: newTournamentId, player_id: 'p1' }, { tournament_id: newTournamentId, player_id: 'p2' }]);
            expect(fetchSpy).toHaveBeenCalledWith({ force: true });
            expect(store.getState().loading).toBe(false);
            fetchSpy.mockRestore();
        });

        it('should handle error during tournament creation', async () => {
            (supabase.from('tournaments').insert as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });
            const resultId = await store.actions.createTournament('Error Tourney', '2023-01-01', TournamentFormat.KNOCKOUT, ['p1', 'p2']);
            expect(resultId).toBeUndefined();
            expect(store.getState().error).toBe('Insert failed');
            expect(store.getState().loading).toBe(false);
        });

         it('should rollback tournament if participant insertion fails', async () => {
            const newTournamentId = 'new-tournament-id';
            (supabase.from('tournaments').insert as jest.Mock).mockResolvedValueOnce({ data: [{ id: newTournamentId }], error: null });
            (supabase.from('tournament_participants').insert as jest.Mock).mockResolvedValueOnce({ error: { message: 'Participants insert failed'} });
            (supabase.from('tournaments').delete as jest.Mock).mockResolvedValueOnce({ error: null }); // Mock rollback delete

            const resultId = await store.actions.createTournament('Rollback Tourney', '2023-01-01', TournamentFormat.KNOCKOUT, ['p1', 'p2']);

            expect(resultId).toBeUndefined();
            expect(supabase.from('tournaments').delete).toHaveBeenCalledWith(); // Check if delete was called (chained .eq('id', tournamentId) is part of the mock)
            expect((supabase.from('tournaments').delete() as any).eq).toHaveBeenCalledWith('id', newTournamentId);
            expect(store.getState().error).toBe('Participants insert failed');
        });
    });

    // generateAndStartTournament is complex, test main paths
    describe('generateAndStartTournament', () => {
        beforeEach(() => {
             store = setupActionTestStore({
                tournaments: [{ id: 't1', name: 'Test', date: '', format: TournamentFormat.KNOCKOUT, status: TournamentStatus.PENDING, participants:['p1','p2','p3','p4'], matches:[], createdAt:'', updatedAt:'' }]
            });
            (supabase.from('tournament_participants').select as jest.Mock).mockResolvedValue({ data: [{player_id: 'p1'}, {player_id: 'p2'}, {player_id: 'p3'}, {player_id: 'p4'}], error: null });
            (tournamentLogic.generateKnockoutPhase as jest.Mock).mockClear(); // Clear mock from other module
        });

        it('should generate matches for KNOCKOUT and set status to active', async () => {
            (tournamentLogic.generateKnockoutPhase as jest.Mock).mockResolvedValueOnce([{id:'m1-ko'}]); // Simulate it returns generated matches
            const fetchSpy = jest.spyOn(store.actions, 'fetchTournaments').mockResolvedValue();

            await store.actions.generateAndStartTournament('t1');

            expect(tournamentLogic.generateKnockoutPhase).toHaveBeenCalledWith('t1', ['p1', 'p2', 'p3', 'p4'], 1);
            expect(supabase.from('tournaments').update).toHaveBeenCalledWith({ status: TournamentStatus.ACTIVE });
            expect(fetchSpy).toHaveBeenCalledWith({ force: true });
            expect(store.getState().loading).toBe(false);
            fetchSpy.mockRestore();
        });

        it('should generate matches for ROUND_ROBIN and set status to active', async () => {
            store = setupActionTestStore({
                tournaments: [{ id: 'tRR', name: 'RR Test', date: '', format: TournamentFormat.ROUND_ROBIN, status: TournamentStatus.PENDING, participants:['p1','p2','p3'], matches:[], createdAt:'', updatedAt:'' }]
            });
             (supabase.from('tournament_participants').select as jest.Mock).mockResolvedValue({ data: [{player_id: 'p1'}, {player_id: 'p2'}, {player_id: 'p3'}], error: null });
            const fetchSpy = jest.spyOn(store.actions, 'fetchTournaments').mockResolvedValue();

            await store.actions.generateAndStartTournament('tRR');

            expect(supabase.from('tournament_matches').insert).toHaveBeenCalled(); // Check DB insert
            const insertedMatches = (supabase.from('tournament_matches').insert as jest.Mock).mock.calls[0][0];
            expect(insertedMatches.length).toBe(3); // 3 players in RR = 3 matches
            expect(supabase.from('tournaments').update).toHaveBeenCalledWith({ status: TournamentStatus.ACTIVE });
            expect(fetchSpy).toHaveBeenCalledWith({ force: true });
            fetchSpy.mockRestore();
        });
    });

    // updateMatchResult is very complex due to cascading logic
    // Focus on: updating match, adding to history, advancing player (if nextMatchId), calling setTournamentWinner/autoSelect (if final)
    describe('updateMatchResult', () => {
        const tournamentId = 't-update';
        const matchId = 'm-update';
        const player1Id = 'pA';
        const player2Id = 'pB';
        const nextMatchId = 'm-next';

        const initialMatch: TournamentMatch = {
            id: matchId, tournamentId, round: 1, matchNumber: 1, player1Id, player2Id, status: 'scheduled',
            nextMatchId, matchId, sets:[], winner: null, player1Score:0, player2Score:0, group: null,
        };
        const initialTournament: Tournament = {
            id: tournamentId, name: 'Update Test', date: '', format: TournamentFormat.KNOCKOUT,
            status: TournamentStatus.ACTIVE, participants: [player1Id, player2Id, 'pC', 'pD'],
            matches: [
                initialMatch,
                {id: nextMatchId, tournamentId, round: 2, matchNumber:1, player1Id: null, player2Id: 'pD', status:'pending', matchId:nextMatchId} as TournamentMatch
            ],
            createdAt:'', updatedAt:''
        };

        beforeEach(() => {
            store = setupActionTestStore({ tournaments: [initialTournament] });
            (useMatchStore.getState as jest.Mock).mockReturnValue({ addMatch: jest.fn().mockResolvedValue(undefined) }); // Mock addMatch for history
            (supabase.from('tournament_matches').update as jest.Mock).mockClear();
        });

        it('should update match, add to history, and advance winner to next match', async () => {
            const scores = { player1Score: 2, player2Score: 1, sets: [{player1Score:11, player2Score:5}, {player1Score:5,player2Score:11}, {player1Score:11,player2Score:8}] }; // pA wins
            const fetchSpy = jest.spyOn(store.actions, 'fetchTournaments').mockResolvedValue();

            await store.actions.updateMatchResult(tournamentId, matchId, scores);

            expect(supabase.from('tournament_matches').update).toHaveBeenCalledTimes(2); // Once for current match, once for nextMatch
            // Check current match update
            expect((supabase.from('tournament_matches').update as jest.Mock).mock.calls[0][0]).toEqual(
                expect.objectContaining({ winner_id: player1Id, status: 'completed', player1_score: 2, player2_score: 1})
            );
             expect((supabase.from('tournament_matches').update('').eq as jest.Mock).mock.calls[0]).toEqual(['id', matchId]);


            // Check next match update (advancing player1Id)
            expect((supabase.from('tournament_matches').update as jest.Mock).mock.calls[1][0]).toEqual(
                expect.objectContaining({ player1_id: player1Id, status: 'scheduled' })
            );
            expect((supabase.from('tournament_matches').update('').eq as jest.Mock).mock.calls[1]).toEqual(['id', nextMatchId]);


            expect(useMatchStore.getState().addMatch).toHaveBeenCalledWith(player1Id, player2Id, 2, 1, scores.sets, tournamentId);
            expect(fetchSpy).toHaveBeenCalledWith({ force: true });
            expect(store.getState().error).toBeNull();

            fetchSpy.mockRestore();
        });
    });


    // TODO: Add tests for:
    // - generateTournamentMatches (group to knockout transition)
    // - updateTournamentStatus
    // - setTournamentWinner
    // - Error paths for all actions more thoroughly
    // - Specific logic inside updateMatchResult for determining final tournament winner (KNOCKOUT vs ROUND_ROBIN vs GROUP end)
});
