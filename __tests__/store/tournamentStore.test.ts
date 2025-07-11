import { act, renderHook } from '@testing-library/react';
import { useTournamentStore, TournamentState } from '@/store/tournamentStore';
import { supabase } from '@/app/lib/supabase';
import { useMatchStore } from '@/store/matchStore';
import { Tournament, TournamentFormat, TournamentMatch, TournamentStatus } from '@/backend/types';

// Mocking external dependencies
jest.mock('@/app/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
    })),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

jest.mock('@/store/matchStore');
jest.mock('@/store/playerStore');
jest.mock('@/backend/server/trpc/services/notificationService', () => ({
    dispatchSystemNotification: jest.fn(),
}));

describe('tournamentStore', () => {
  let store: { current: TournamentState };

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
        useTournamentStore.setState(useTournamentStore.getState().initialState, true);
    });

    (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ data: [], error: null }),
        update: jest.fn().mockResolvedValue({ data: [], error: null }),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
    }));

    const { result } = renderHook(() => useTournamentStore());
    store = result;
    (useMatchStore.getState as jest.Mock).mockReturnValue({ addMatch: jest.fn() });
  });

  it('should create a tournament', async () => {
    const newTournamentData: Tournament = {
      id: 'mock-uuid',
      name: 'Test Tournament',
      date: '2024-01-01',
      format: TournamentFormat.ROUND_ROBIN,
      status: TournamentStatus.UPCOMING,
      winner_id: null,
      participants: [],
      tournament_players: [{ user_id: 'p1', tournament_id: 'mock-uuid', id: 'tp1', created_at: '' }, { user_id: 'p2', tournament_id: 'mock-uuid', id: 'tp2', created_at: '' }],
      tournament_matches: [],
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'tournaments') {
            return {
                insert: jest.fn().mockResolvedValue({ data: [{ id: 'mock-uuid' }], error: null }),
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: newTournamentData, error: null })
            };
        }
        if (table === 'tournament_players') {
            return {
                insert: jest.fn().mockResolvedValue({ error: null })
            };
        }
        return { insert: jest.fn(), select: jest.fn() };
    });

    let tournamentId;
    await act(async () => {
      tournamentId = await store.current.createTournament('Test Tournament', '2024-01-01', TournamentFormat.ROUND_ROBIN, ['p1', 'p2']);
    });

    expect(tournamentId).toBe('mock-uuid');
    expect(store.current.tournaments[0].name).toBe('Test Tournament');
  });

  it('should fetch tournaments', async () => {
    const mockTournaments: Tournament[] = [
      { id: 't1', name: 'Tournament 1', date: '2024-01-01', format: TournamentFormat.KNOCKOUT, status: TournamentStatus.ACTIVE, participants: [], winner_id: null, tournament_matches: [], tournament_players: [] },
      { id: 't2', name: 'Tournament 2', date: '2024-01-02', format: TournamentFormat.ROUND_ROBIN, status: TournamentStatus.COMPLETED, participants: [], winner_id: 'p1', tournament_matches: [], tournament_players: [] },
    ];

    (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTournaments, error: null })
    });

    await act(async () => {
      await store.current.fetchTournaments();
    });

    expect(store.current.tournaments.length).toBe(2);
    expect(store.current.tournaments[0].name).toBe('Tournament 1');
  });

  it('should filter tournaments by status', async () => {
    const tournaments: Tournament[] = [
        { id: 't1', name: 'Upcoming', date: new Date().toISOString(), status: TournamentStatus.PENDING, format: TournamentFormat.KNOCKOUT, participants: [], winner_id: null, tournament_matches: [], tournament_players: [] },
        { id: 't2', name: 'Active', date: new Date().toISOString(), status: TournamentStatus.ACTIVE, format: TournamentFormat.KNOCKOUT, participants: [], winner_id: null, tournament_matches: [], tournament_players: [] },
        { id: 't3', name: 'Completed', date: new Date().toISOString(), status: TournamentStatus.COMPLETED, format: TournamentFormat.KNOCKOUT, participants: [], winner_id: 'p1', tournament_matches: [], tournament_players: [] },
    ];

    act(() => {
        useTournamentStore.setState({ tournaments });
    });

    expect(store.current.getUpcomingTournaments().length).toBe(1);
    expect(store.current.getActiveTournaments().length).toBe(1);
    expect(store.current.getCompletedTournaments().length).toBe(1);
  });

  it('should update match result and advance players in knockout', async () => {
    const tournamentId = 'knockout-tourney';
    const matches: TournamentMatch[] = [
        { id: 'm1', tournament_id: tournamentId, round: 1, player1_id: 'p1', player2_id: 'p2', status: 'scheduled', next_match_id: 'm3', winner_id: null, player1_score: null, player2_score: null, sets: [], match_id: 'match1', match_number: 1, player1_score_sets: null, player2_score_sets: null, group: null },
        { id: 'm2', tournament_id: tournamentId, round: 1, player1_id: 'p3', player2_id: 'p4', status: 'scheduled', next_match_id: 'm3', winner_id: null, player1_score: null, player2_score: null, sets: [], match_id: 'match2', match_number: 2, player1_score_sets: null, player2_score_sets: null, group: null },
        { id: 'm3', tournament_id: tournamentId, round: 2, player1_id: null, player2_id: null, status: 'pending', next_match_id: null, winner_id: null, player1_score: null, player2_score: null, sets: [], match_id: 'match3', match_number: 3, player1_score_sets: null, player2_score_sets: null, group: null },
    ];
    const tournament: Tournament = { id: tournamentId, name: 'Knockout', date: '2024-01-01', format: TournamentFormat.KNOCKOUT, status: TournamentStatus.ACTIVE, winner_id: null, tournament_matches: matches, participants: [], tournament_players: [] };

    act(() => {
        useTournamentStore.setState({ tournaments: [tournament] });
    });

    const updateMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ update: updateMock, eq: jest.fn().mockReturnThis() });

    await act(async () => {
        await store.current.updateMatchResult(tournamentId, 'm1', { player1Score: 2, player2Score: 1, sets: [] });
    });

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock.mock.calls[0][0]).toEqual(expect.objectContaining({ winner_id: 'p1' }));
    expect(updateMock.mock.calls[1][0]).toEqual(expect.objectContaining({ player1_id: 'p1' }));

    const updatedMatch = store.current.getTournamentMatches(tournamentId).find(m => m.id === 'm1');
    expect(updatedMatch.winner_id).toBe('p1');
    const nextMatch = store.current.getTournamentMatches(tournamentId).find(m => m.id === 'm3');
    expect(nextMatch.player1_id).toBe('p1');
  });

  it('should generate round-robin matches', async () => {
    const tournamentId = 'gen-rr-tourney';
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const tournament: Tournament = {
      id: tournamentId,
      name: 'RR Gen',
      date: '2024-01-01',
      format: TournamentFormat.ROUND_ROBIN,
      status: TournamentStatus.UPCOMING,
      winner_id: null,
      tournament_matches: [],
      participants: [],
      tournament_players: playerIds.map(id => ({ user_id: id, tournament_id: tournamentId, id: `tp-${id}`, created_at: '2024-01-01' }))
    };

    act(() => {
        useTournamentStore.setState({ tournaments: [tournament] });
    });

    const insertMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert: insertMock });

    await act(async () => {
        await store.current.generateTournamentMatches(tournamentId);
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertedMatches = insertMock.mock.calls[0][0];
    expect(insertedMatches.length).toBe(6);
  });

  it('should correctly determine the winner in a round-robin tournament', async () => {
    const tournamentId = 'round-robin-tourney';
    const playerIds = ['p1', 'p2', 'p3'];
    const matches: TournamentMatch[] = [
      { id: 'm1', tournament_id: tournamentId, round: 1, player1_id: 'p1', player2_id: 'p2', status: 'completed', winner_id: 'p1', player1_score: 2, player2_score: 1, sets: [], match_id: 'match1', match_number: 1, player1_score_sets: null, player2_score_sets: null, group: null },
      { id: 'm2', tournament_id: tournamentId, round: 1, player1_id: 'p1', player2_id: 'p3', status: 'completed', winner_id: 'p1', player1_score: 2, player2_score: 0, sets: [], match_id: 'match2', match_number: 2, player1_score_sets: null, player2_score_sets: null, group: null },
      { id: 'm3', tournament_id: tournamentId, round: 1, player1_id: 'p2', player2_id: 'p3', status: 'scheduled', winner_id: null, player1_score: null, player2_score: null, sets: [], match_id: 'match3', match_number: 3, player1_score_sets: null, player2_score_sets: null, group: null },
    ];

    const tournament: Tournament = {
      id: tournamentId,
      name: 'Round Robin',
      date: '2024-01-01',
      format: TournamentFormat.ROUND_ROBIN,
      status: TournamentStatus.ACTIVE,
      winner_id: null,
      tournament_matches: matches,
      participants: [],
      tournament_players: playerIds.map(id => ({ user_id: id, tournament_id: tournamentId, id: `tp-${id}`, created_at: '2024-01-01' }))
    };

    act(() => {
      useTournamentStore.setState({ tournaments: [tournament] });
    });

    const finalMatchState: TournamentMatch = { ...matches.find(m => m.id === 'm3'), status: 'completed', winner_id: 'p2', player1_score: 2, player2_score: 1 };
    const completedTournamentState: Tournament = {
        ...tournament,
        status: TournamentStatus.COMPLETED,
        winner_id: 'p1',
        tournament_matches: [ ...matches.filter(m => m.id !== 'm3'), finalMatchState ]
    };

    const tournamentUpdateMock = jest.fn().mockResolvedValue({ error: null });
    const matchUpdateMock = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'tournaments') {
            return {
                update: tournamentUpdateMock,
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: completedTournamentState, error: null })
            };
        }
        if (table === 'tournament_matches') {
            return {
                update: matchUpdateMock,
                eq: jest.fn().mockReturnThis(),
            };
        }
        return {};
    });

    await act(async () => {
      await store.current.updateMatchResult(tournamentId, 'm3', { player1Score: 2, player2Score: 1, sets: [] });
    });

    const finalTournamentState = store.current.getTournamentById(tournamentId);
    expect(finalTournamentState.winner_id).toBe('p1');
    expect(finalTournamentState.status).toBe(TournamentStatus.COMPLETED);
  });
});
