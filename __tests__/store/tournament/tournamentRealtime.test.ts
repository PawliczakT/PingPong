/**
 * @fileoverview Unit tests for tournamentRealtime.ts
 */
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { StoreApi } from 'zustand';
import { handleTournamentTableUpdate, handleTournamentMatchTableUpdate } from '@/store/tournament/tournamentRealtime';
import type { FullTournamentStore, Tournament, TournamentMatch, TournamentStoreState } from '@/store/tournament/tournamentTypes';
import { TournamentStatus, TournamentFormat } from '@/store/tournament/tournamentTypes';
import { initialState } from '@/store/tournament/tournamentState';
import * as tournamentLogic from '@/store/tournament/tournamentLogic';

// Mock the tournamentLogic.transformMatchData specifically
jest.mock('@/store/tournament/tournamentLogic', () => ({
    ...jest.requireActual('@/store/tournament/tournamentLogic'), // Keep other functions from the module
    transformMatchData: jest.fn((match) => ({ // Mock implementation for transformMatchData
        id: match.id,
        tournamentId: match.tournament_id,
        round: match.round,
        matchNumber: match.match_number,
        matchId: match.match_id || match.id,
        player1Id: match.player1_id,
        player2Id: match.player2_id,
        player1Score: match.player1_score,
        player2Score: match.player2_score,
        winner: match.winner_id,
        status: match.status,
        nextMatchId: match.next_match_id,
        sets: match.sets,
        group: match.group,
    })),
}));


describe('Tournament Realtime Handlers', () => {
    let mockSet: jest.Mock;
    let mockGet: jest.Mock;
    let state: TournamentStoreState;

    beforeEach(() => {
        // Reset state and mocks for each test
        state = JSON.parse(JSON.stringify(initialState)); // Deep clone initial state

        const setCalls: Partial<TournamentStoreState>[] = [];
        mockSet = jest.fn((updater) => {
            if (typeof updater === 'function') {
                updater(state); // Apply mutations directly to our test `state` object
                setCalls.push(JSON.parse(JSON.stringify(state)));
            } else {
                Object.assign(state, updater);
                 setCalls.push(JSON.parse(JSON.stringify(updater)));
            }
        }) as unknown as StoreApi<FullTournamentStore>['setState'];

        mockGet = jest.fn(() => state as FullTournamentStore)  as unknown as StoreApi<FullTournamentStore>['getState'];
        (tournamentLogic.transformMatchData as jest.Mock).mockClear();
    });

    describe('handleTournamentTableUpdate', () => {
        const baseTournament: Tournament = {
            id: 't1', name: 'Realtime Test', date: '2023-05-01', format: TournamentFormat.KNOCKOUT,
            status: TournamentStatus.UPCOMING, participants: [], matches: [], createdAt: '', updatedAt: ''
        };

        it('should insert a new tournament', () => {
            const payload: RealtimePostgresChangesPayload<Tournament> = {
                schema: 'public', table: 'tournaments', commit_timestamp: Date.now().toString(), eventType: 'INSERT',
                new: baseTournament, old: {}, errors: null,
            };
            handleTournamentTableUpdate(payload, mockSet, mockGet);
            expect(state.tournaments).toHaveLength(1);
            expect(state.tournaments[0]).toEqual(expect.objectContaining(baseTournament));
            expect(tournamentLogic.transformMatchData).not.toHaveBeenCalled(); // Should not be called for tournament updates
        });

        it('should update an existing tournament', () => {
            state.tournaments = [baseTournament]; // Pre-populate state
            const updatedTournament = { ...baseTournament, name: 'Updated Realtime Test', status: TournamentStatus.ACTIVE };
            const payload: RealtimePostgresChangesPayload<Tournament> = {
                schema: 'public', table: 'tournaments', commit_timestamp: Date.now().toString(), eventType: 'UPDATE',
                new: updatedTournament, old: baseTournament, errors: null,
            };
            handleTournamentTableUpdate(payload, mockSet, mockGet);
            expect(state.tournaments).toHaveLength(1);
            expect(state.tournaments[0].name).toBe('Updated Realtime Test');
            expect(state.tournaments[0].status).toBe(TournamentStatus.ACTIVE);
        });

        it('should delete an existing tournament', () => {
            state.tournaments = [baseTournament, { ...baseTournament, id: 't2', name: 'Another' }];
            const payload: RealtimePostgresChangesPayload<Tournament> = {
                schema: 'public', table: 'tournaments', commit_timestamp: Date.now().toString(), eventType: 'DELETE',
                new: {}, old: { id: 't1' }, errors: null, // only old.id is strictly needed by the handler for DELETE
            };
            handleTournamentTableUpdate(payload, mockSet, mockGet);
            expect(state.tournaments).toHaveLength(1);
            expect(state.tournaments.find(t => t.id === 't1')).toBeUndefined();
            expect(state.tournaments[0].id).toBe('t2');
        });
    });

    describe('handleTournamentMatchTableUpdate', () => {
        const tournamentId = 't1';
        const initialTournament: Tournament = {
            id: tournamentId, name: 'Match Update Test', date: '2023-06-01', format: TournamentFormat.KNOCKOUT,
            status: TournamentStatus.ACTIVE, participants: [], matches: [], createdAt: '', updatedAt: ''
        };

        const baseRawMatchFromSupabase = { // This is what Supabase sends (snake_case)
            id: 'm1', tournament_id: tournamentId, round: 1, match_number: 1, player1_id: 'p1', player2_id: 'p2', status: 'scheduled',
        };
        const transformedBaseMatch: TournamentMatch = tournamentLogic.transformMatchData(baseRawMatchFromSupabase);


        beforeEach(() => {
            state.tournaments = [JSON.parse(JSON.stringify(initialTournament))]; // Ensure clean tournament for each match test
             // Reset mock calls for transformMatchData before each match test
            (tournamentLogic.transformMatchData as jest.Mock).mockClear();
             // Default mock implementation for transformMatchData for these tests
            (tournamentLogic.transformMatchData as jest.Mock).mockImplementation(match => ({
                id: match.id, tournamentId: match.tournament_id, round: match.round, matchNumber: match.match_number,
                matchId: match.match_id || match.id, player1Id: match.player1_id, player2Id: match.player2_id,
                player1Score: match.player1_score, player2Score: match.player2_score, winner: match.winner_id,
                status: match.status, nextMatchId: match.next_match_id, sets: match.sets, group: match.group,
            }));
        });

        it('should insert a new match into the correct tournament', () => {
            const payload: RealtimePostgresChangesPayload<TournamentMatch> = {
                schema: 'public', table: 'tournament_matches', commit_timestamp: Date.now().toString(), eventType: 'INSERT',
                new: baseRawMatchFromSupabase as any, old: {}, errors: null,
            };
            handleTournamentMatchTableUpdate(payload, mockSet);

            expect(tournamentLogic.transformMatchData).toHaveBeenCalledWith(baseRawMatchFromSupabase);
            expect(state.tournaments[0].matches).toHaveLength(1);
            expect(state.tournaments[0].matches[0]).toEqual(expect.objectContaining(transformedBaseMatch));
        });

        it('should update an existing match', () => {
            // Setup initial match in state
            const initialMatchInState = transformedBaseMatch;
            state.tournaments[0].matches = [initialMatchInState];

            const updatedRawMatchData = { ...baseRawMatchFromSupabase, status: 'completed', winner_id: 'p1' };
            const transformedUpdatedMatch = tournamentLogic.transformMatchData(updatedRawMatchData);

            const payload: RealtimePostgresChangesPayload<TournamentMatch> = {
                schema: 'public', table: 'tournament_matches', commit_timestamp: Date.now().toString(), eventType: 'UPDATE',
                new: updatedRawMatchData as any, old: baseRawMatchFromSupabase as any, errors: null,
            };
            handleTournamentMatchTableUpdate(payload, mockSet);

            expect(tournamentLogic.transformMatchData).toHaveBeenCalledWith(updatedRawMatchData);
            expect(state.tournaments[0].matches).toHaveLength(1);
            expect(state.tournaments[0].matches[0].status).toBe('completed');
            expect(state.tournaments[0].matches[0].winner).toBe('p1');
        });

        it('should delete an existing match', () => {
            const matchToDelete = transformedBaseMatch;
            const anotherMatch = tournamentLogic.transformMatchData({...baseRawMatchFromSupabase, id:'m2'});
            state.tournaments[0].matches = [matchToDelete, anotherMatch];

            const payload: RealtimePostgresChangesPayload<TournamentMatch> = {
                schema: 'public', table: 'tournament_matches', commit_timestamp: Date.now().toString(), eventType: 'DELETE',
                new: {}, old: { id: 'm1', tournament_id: tournamentId } as any, errors: null,
            };
            handleTournamentMatchTableUpdate(payload, mockSet);

            expect(tournamentLogic.transformMatchData).not.toHaveBeenCalled(); // Not called for DELETE's `new` record
            expect(state.tournaments[0].matches).toHaveLength(1);
            expect(state.tournaments[0].matches.find(m => m.id === 'm1')).toBeUndefined();
            expect(state.tournaments[0].matches[0].id).toBe('m2');
        });

        it('should not update if tournamentId is missing from payload', () => {
            const payloadWithoutTournamentId: RealtimePostgresChangesPayload<TournamentMatch> = {
                schema: 'public', table: 'tournament_matches', commit_timestamp: Date.now().toString(), eventType: 'INSERT',
                new: { ...baseRawMatchFromSupabase, tournament_id: undefined } as any, old: {}, errors: null,
            };
            handleTournamentMatchTableUpdate(payloadWithoutTournamentId, mockSet);
            expect(state.tournaments[0].matches).toHaveLength(0); // No change
        });
    });

    // Note: Testing the useTournamentsRealtimeUpdates hook itself would require
    // a React Testing Library setup to simulate component lifecycle and hook usage.
    // Here we've focused on its core handler functions.
});
