// Mock all external dependencies at the TOP of the file
const mockEq = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockSingle = jest.fn();
const mockIlike = jest.fn();

// Create a chainable mock structure for Supabase
const createSupabaseMock = () => {
    const chainMock = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
    };

    // Make each method return the chain
    Object.keys(chainMock).forEach(key => {
        chainMock[key].mockReturnValue(chainMock);
    });

    return chainMock;
};

// Global Supabase mock
const mockFrom = jest.fn(() => createSupabaseMock());

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: mockFrom,
        channel: jest.fn(() => ({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
        })),
    },
}));

// This mock is crucial to prevent the WebSocket error
jest.mock('@/services/notificationService', () => ({
    dispatchSystemNotification: jest.fn(),
}));

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

import {Set as MatchSet, Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/backend/types';
import {useTournamentStore} from '@/store/tournamentStore';

// Mock other stores
const mockGetPlayerState = jest.fn();
const mockGetMatchState = jest.fn();
const mockAddMatch = jest.fn().mockResolvedValue({id: 'mock-match-id'});

jest.mock('@/store/playerStore', () => ({
    usePlayerStore: {
        getState: () => ({
            getPlayerById: jest.fn((id) => ({
                id,
                nickname: `Player ${id}`,
                email: `${id}@test.com`
            }))
        }),
    },
}));

jest.mock('@/store/matchStore', () => ({
    useMatchStore: {
        getState: () => ({
            addMatch: mockAddMatch,
            getMatchesByPlayerId: jest.fn().mockReturnValue([]),
        }),
    },
}));

// Helper functions to create mock tournament and matches
const createMockTournament = (
    id: string,
    status: TournamentStatus,
    participants: string[],
    winner?: string | null,
    name: string = 'Mock Tournament',
    format: TournamentFormat = TournamentFormat.KNOCKOUT,
    matches: TournamentMatch[] = []
): Tournament => ({
    id,
    name,
    date: new Date().toISOString(),
    format,
    status,
    participants,
    winner: winner || undefined,
    matches,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
});

const createMockTournamentMatch = (
    id: string,
    tournamentId: string,
    round: number,
    player1Id: string | null,
    player2Id: string | null,
    nextMatchId?: string | null,
    status: TournamentMatch['status'] = 'pending'
): TournamentMatch => ({
    id,
    tournamentId,
    round,
    player1Id,
    player2Id,
    player1Score: 0,
    player2Score: 0,
    winner: null,
    nextMatchId: nextMatchId || null,
    status,
    matchId: null,
});

const createMockSet = (p1Score: number, p2Score: number): MatchSet => ({
    player1Score: p1Score,
    player2Score: p2Score
});

describe('Tournament Store', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset the tournament store state
        useTournamentStore.setState({
            tournaments: [],
            loading: false,
            error: null,
            lastFetchTimestamp: null,
        });
    });

    describe('createTournament', () => {
        beforeEach(() => {
            // Setup default mock responses
            const supabaseMock = createSupabaseMock();
            supabaseMock.insert.mockImplementation(() => {
                supabaseMock.select.mockResolvedValue({
                    data: { id: 'mock-tournament-id', name: 'Test Tournament' },
                    error: null
                });
                return supabaseMock;
            });

            supabaseMock.ilike.mockResolvedValue({
                data: [],
                error: null
            });

            mockFrom.mockReturnValue(supabaseMock);
        });

        it('should create a new tournament with the specified parameters', async () => {
            const store = useTournamentStore.getState();
            const name = 'Test Tournament';
            const date = new Date().toISOString();
            const format = TournamentFormat.KNOCKOUT;
            const playerIds = ['player1', 'player2', 'player3', 'player4'];

            const tournamentId = await store.createTournament(name, date, format, playerIds);

            expect(tournamentId).toBe('mock-tournament-id');
            expect(mockFrom).toHaveBeenCalledWith('tournaments');
            expect(mockFrom).toHaveBeenCalledWith('tournament_participants');
        });

        it('should generate a tournament name when name is empty', async () => {
            const store = useTournamentStore.getState();
            const supabaseMock = createSupabaseMock();

            // Mock existing tournaments for name generation
            supabaseMock.ilike.mockResolvedValue({
                data: [
                    { name: 'Tournament 1' },
                    { name: 'Tournament 2' },
                    { name: 'Tournament 5' }
                ],
                error: null
            });

            supabaseMock.insert.mockImplementation(() => {
                supabaseMock.select.mockResolvedValue({
                    data: { id: 'mock-tournament-id', name: 'Tournament 6' },
                    error: null
                });
                return supabaseMock;
            });

            mockFrom.mockReturnValue(supabaseMock);

            const result = await store.createTournament('', '2023-01-01', TournamentFormat.KNOCKOUT, ['player1', 'player2', 'player3', 'player4']);

            expect(result).toBe('mock-tournament-id');
            expect(mockFrom).toHaveBeenCalledWith('tournaments');
        });

        it('should handle insufficient players error', async () => {
            const store = useTournamentStore.getState();
            const result = await store.createTournament('Test', '2023-01-01', TournamentFormat.KNOCKOUT, ['player1']);

            expect(result).toBeUndefined();
            expect(store.error).toBe('Minimum 2 players required');
        });

        it('should handle odd number of players for knockout format', async () => {
            const store = useTournamentStore.getState();
            const result = await store.createTournament('Test', '2023-01-01', TournamentFormat.KNOCKOUT, ['p1', 'p2', 'p3']);

            expect(result).toBeUndefined();
            expect(store.error).toBe('Knockout tournaments require an even number of players');
        });
    });

    describe('fetchTournaments', () => {
        it('should fetch and process tournaments correctly', async () => {
            const mockTournamentData = {
                id: 'tournament1',
                name: 'Test Tournament',
                date: '2023-01-01',
                format: 'KNOCKOUT',
                status: 'active',
                winner_id: null,
                created_at: '2023-01-01',
                updated_at: '2023-01-01',
                tournament_participants: [
                    { player_id: 'p1' },
                    { player_id: 'p2' }
                ],
                tournament_matches: [
                    {
                        id: 'match1',
                        tournament_id: 'tournament1',
                        round: 1,
                        player1_id: 'p1',
                        player2_id: 'p2',
                        player1_score: null,
                        player2_score: null,
                        winner_id: null,
                        status: 'scheduled',
                        sets: null
                    }
                ]
            };

            const supabaseMock = createSupabaseMock();
            supabaseMock.select.mockResolvedValue({
                data: [mockTournamentData],
                error: null
            });
            mockFrom.mockReturnValue(supabaseMock);

            await useTournamentStore.getState().fetchTournaments();

            const state = useTournamentStore.getState();
            expect(state.tournaments).toHaveLength(1);
            expect(state.tournaments[0].id).toBe('tournament1');
            expect(state.tournaments[0].participants).toEqual(['p1', 'p2']);
            expect(state.loading).toBe(false);
            expect(state.error).toBeNull();
        });

        it('should handle fetch errors gracefully', async () => {
            const supabaseMock = createSupabaseMock();
            supabaseMock.select.mockResolvedValue({
                data: null,
                error: new Error('Database error')
            });
            mockFrom.mockReturnValue(supabaseMock);

            await useTournamentStore.getState().fetchTournaments();

            const state = useTournamentStore.getState();
            expect(state.tournaments).toEqual([]);
            expect(state.loading).toBe(false);
            expect(state.error).toContain('Failed to fetch tournaments');
        });

        it('should prevent multiple simultaneous fetches', async () => {
            const store = useTournamentStore.getState();
            store.loading = true;

            const supabaseMock = createSupabaseMock();
            mockFrom.mockReturnValue(supabaseMock);

            await store.fetchTournaments();

            expect(supabaseMock.select).not.toHaveBeenCalled();
        });
    });

    describe('updateMatchResult', () => {
        it('should update a tournament match result correctly', async () => {
            const tournamentId = 'tournament1';
            const matchId = 'match1';
            const match = createMockTournamentMatch(
                matchId, tournamentId, 1, 'player1', 'player2', 'nextMatch', 'scheduled'
            );
            const tournament = createMockTournament(
                tournamentId, TournamentStatus.IN_PROGRESS, ['player1', 'player2'], null, 'Test Tournament',
                TournamentFormat.KNOCKOUT, [match]
            );

            useTournamentStore.setState({
                tournaments: [tournament],
            });

            const scores = {
                player1Score: 3,
                player2Score: 1,
                sets: [
                    createMockSet(11, 5),
                    createMockSet(9, 11),
                    createMockSet(11, 7),
                    createMockSet(11, 9)
                ]
            };

            const supabaseMock = createSupabaseMock();
            supabaseMock.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });
            supabaseMock.select.mockResolvedValue({
                data: {
                    tournament_matches: [{ status: 'completed' }]
                },
                error: null
            });
            mockFrom.mockReturnValue(supabaseMock);

            await useTournamentStore.getState().updateMatchResult(tournamentId, matchId, scores);

            expect(mockAddMatch).toHaveBeenCalledWith({
                player1Id: 'player1',
                player2Id: 'player2',
                player1Score: scores.player1Score,
                player2Score: scores.player2Score,
                sets: scores.sets,
                tournamentId,
            });
        });

        it('should advance winner to next match in knockout tournament', async () => {
            const tournamentId = 'tournament1';
            const matchId = 'match1';
            const nextMatchId = 'nextMatch';

            const match = createMockTournamentMatch(
                matchId, tournamentId, 1, 'player1', 'player2', nextMatchId, 'scheduled'
            );
            const nextMatch = createMockTournamentMatch(
                nextMatchId, tournamentId, 2, null, null, null, 'pending'
            );

            const tournament = createMockTournament(
                tournamentId, TournamentStatus.IN_PROGRESS, ['player1', 'player2', 'player3', 'player4'],
                null, 'Knockout Tournament', TournamentFormat.KNOCKOUT, [match, nextMatch]
            );

            useTournamentStore.setState({
                tournaments: [tournament],
            });

            const supabaseMock = createSupabaseMock();
            supabaseMock.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });
            mockFrom.mockReturnValue(supabaseMock);

            await useTournamentStore.getState().updateMatchResult(tournamentId, matchId, {
                player1Score: 3,
                player2Score: 0
            });

            // Verify the next match was updated
            expect(mockFrom).toHaveBeenCalledWith('tournament_matches');
        });
    });

    describe('Tournament Lifecycle', () => {
        it('should complete a full knockout tournament lifecycle', async () => {
            // Create tournament
            const tournamentId = 'knockout-lifecycle';
            const playerIds = ['p1', 'p2', 'p3', 'p4'];

            // Setup matches for a 4-player knockout
            const match1 = createMockTournamentMatch('m1', tournamentId, 1, 'p1', 'p2', 'final', 'scheduled');
            const match2 = createMockTournamentMatch('m2', tournamentId, 1, 'p3', 'p4', 'final', 'scheduled');
            const finalMatch = createMockTournamentMatch('final', tournamentId, 2, null, null, null, 'pending');

            const tournament = createMockTournament(
                tournamentId, TournamentStatus.IN_PROGRESS, playerIds, null,
                'Knockout Lifecycle Test', TournamentFormat.KNOCKOUT, [match1, match2, finalMatch]
            );

            useTournamentStore.setState({
                tournaments: [tournament]
            });

            const store = useTournamentStore.getState();

            // Verify tournament was created
            expect(store.getTournamentById(tournamentId)).toBeDefined();
            expect(store.getTournamentMatches(tournamentId)).toHaveLength(3);
        });
    });

    describe('generateAndStartTournament', () => {
        it('should generate matches for ROUND_ROBIN format', async () => {
            const tournamentId = 'round-robin-test';
            const playerIds = ['p1', 'p2', 'p3', 'p4'];
            const tournament = createMockTournament(
                tournamentId, TournamentStatus.UPCOMING, playerIds, null,
                'Round Robin Test', TournamentFormat.ROUND_ROBIN
            );

            useTournamentStore.setState({
                tournaments: [tournament],
            });

            const supabaseMock = createSupabaseMock();
            supabaseMock.select.mockResolvedValue({
                data: playerIds.map(id => ({ player_id: id })),
                error: null
            });
            supabaseMock.insert.mockResolvedValue({ error: null });
            supabaseMock.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });
            mockFrom.mockReturnValue(supabaseMock);

            await useTournamentStore.getState().generateAndStartTournament(tournamentId);

            // In round robin, each player plays all others once
            // For 4 players: 4 * 3 / 2 = 6 matches
            expect(mockFrom).toHaveBeenCalledWith('tournament_matches');
            expect(supabaseMock.insert).toHaveBeenCalled();
        });

        it('should handle GROUP format with group stage', async () => {
            const tournamentId = 'group-test';
            const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
            const tournament = createMockTournament(
                tournamentId, TournamentStatus.UPCOMING, playerIds, null,
                'Group Stage Test', TournamentFormat.GROUP
            );

            useTournamentStore.setState({
                tournaments: [tournament],
            });

            const supabaseMock = createSupabaseMock();
            supabaseMock.select.mockResolvedValue({
                data: playerIds.map(id => ({ player_id: id })),
                error: null
            });
            supabaseMock.insert.mockResolvedValue({ error: null });
            supabaseMock.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });
            mockFrom.mockReturnValue(supabaseMock);

            await useTournamentStore.getState().generateAndStartTournament(tournamentId);

            expect(mockFrom).toHaveBeenCalledWith('tournament_matches');
            expect(supabaseMock.insert).toHaveBeenCalled();
        });
    });

    describe('setTournamentWinner', () => {
        it('should set tournament winner and dispatch notification', async () => {
            const tournamentId = 'tournament1';
            const winnerId = 'player1';
            const tournament = createMockTournament(
                tournamentId, TournamentStatus.IN_PROGRESS, ['player1', 'player2']
            );

            useTournamentStore.setState({
                tournaments: [tournament],
            });

            const supabaseMock = createSupabaseMock();
            supabaseMock.update.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null })
            });
            mockFrom.mockReturnValue(supabaseMock);

            const { dispatchSystemNotification } = require('@/services/notificationService');

            await useTournamentStore.getState().setTournamentWinner(tournamentId, winnerId);

            expect(mockFrom).toHaveBeenCalledWith('tournaments');
            expect(dispatchSystemNotification).toHaveBeenCalledWith('tournament_won', expect.objectContaining({
                notification_type: 'tournament_won',
                winnerNickname: 'Player player1',
                tournamentName: tournament.name,
                tournamentId: tournament.id,
            }));
        });

        it('should handle missing winner gracefully', async () => {
            const tournamentId = 'tournament1';
            const tournament = createMockTournament(
                tournamentId, TournamentStatus.IN_PROGRESS, ['player1', 'player2']
            );

            useTournamentStore.setState({
                tournaments: [tournament],
            });

            await useTournamentStore.getState().setTournamentWinner(tournamentId, '');

            const state = useTournamentStore.getState();
            expect(state.tournaments[0].winner).toBeUndefined();
        });
    });

    describe('Tournament Queries', () => {
        beforeEach(() => {
            const tournaments = [
                createMockTournament('t1', TournamentStatus.UPCOMING, ['p1', 'p2']),
                createMockTournament('t2', TournamentStatus.IN_PROGRESS, ['p3', 'p4']),
                createMockTournament('t3', TournamentStatus.COMPLETED, ['p5', 'p6'], 'p5'),
                createMockTournament('t4', TournamentStatus.IN_PROGRESS, ['p7', 'p8']),
                createMockTournament('t5', TournamentStatus.COMPLETED, ['p9', 'p10'], 'p10'),
            ];

            useTournamentStore.setState({
                tournaments,
            });
        });

        it('should get tournament by id correctly', () => {
            const tournament = useTournamentStore.getState().getTournamentById('t3');
            expect(tournament).toBeDefined();
            expect(tournament?.id).toBe('t3');
            expect(tournament?.status).toBe(TournamentStatus.COMPLETED);
            expect(tournament?.winner).toBe('p5');
        });

        it('should return undefined for non-existent tournament', () => {
            const tournament = useTournamentStore.getState().getTournamentById('non-existent');
            expect(tournament).toBeUndefined();
        });

        it('should get upcoming tournaments correctly', () => {
            const upcomingTournaments = useTournamentStore.getState().getUpcomingTournaments();
            expect(upcomingTournaments).toHaveLength(1);
            expect(upcomingTournaments[0].id).toBe('t1');
        });

        it('should get active tournaments correctly', () => {
            const activeTournaments = useTournamentStore.getState().getActiveTournaments();
            expect(activeTournaments).toHaveLength(2);
            expect(activeTournaments.map(t => t.id)).toContain('t2');
            expect(activeTournaments.map(t => t.id)).toContain('t4');
        });

        it('should get completed tournaments correctly', () => {
            const completedTournaments = useTournamentStore.getState().getCompletedTournaments();
            expect(completedTournaments).toHaveLength(2);
            expect(completedTournaments.every(t => t.winner !== undefined)).toBe(true);
        });

        it('should count player tournament wins correctly', () => {
            const wins = useTournamentStore.getState().getPlayerTournamentWins('p5');
            expect(wins).toBe(1);

            const noWins = useTournamentStore.getState().getPlayerTournamentWins('p1');
            expect(noWins).toBe(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors during match update', async () => {
            const tournamentId = 'tournament1';
            const matchId = 'match1';
            const tournament = createMockTournament(
                tournamentId, TournamentStatus.IN_PROGRESS, ['p1', 'p2'], null, 'Test',
                TournamentFormat.KNOCKOUT, [createMockTournamentMatch(matchId, tournamentId, 1, 'p1', 'p2')]
            );

            useTournamentStore.setState({
                tournaments: [tournament],
            });

            const supabaseMock = createSupabaseMock();
            supabaseMock.update.mockReturnValue({
                eq: jest.fn().mockRejectedValue(new Error('Database error'))
            });
            mockFrom.mockReturnValue(supabaseMock);

            await useTournamentStore.getState().updateMatchResult(tournamentId, matchId, {
                player1Score: 3,
                player2Score: 1
            });

            const state = useTournamentStore.getState();
            expect(state.error).toContain('Failed to update match');
        });

        it('should handle draw scores error', async () => {
            const tournamentId = 'tournament1';
            const matchId = 'match1';
            const tournament = createMockTournament(
                tournamentId, TournamentStatus.IN_PROGRESS, ['p1', 'p2'], null, 'Test',
                TournamentFormat.KNOCKOUT, [createMockTournamentMatch(matchId, tournamentId, 1, 'p1', 'p2')]
            );

            useTournamentStore.setState({
                tournaments: [tournament],
            });

            await useTournamentStore.getState().updateMatchResult(tournamentId, matchId, {
                player1Score: 2,
                player2Score: 2
            });

            const state = useTournamentStore.getState();
            expect(state.error).toContain('Match score cannot be a draw');
        });
    });

    describe('Realtime Updates', () => {
        it('should handle tournament insert update', () => {
            const newTournament = {
                id: 'new-tournament',
                name: 'New Tournament',
                status: 'pending',
                format: 'KNOCKOUT',
                participants: [],
                matches: []
            };

            useTournamentStore.getState().handleTournamentUpdate({
                eventType: 'INSERT',
                new: newTournament,
                old: null,
                schema: 'public',
                table: 'tournaments'
            });

            const state = useTournamentStore.getState();
            expect(state.tournaments).toHaveLength(1);
            expect(state.tournaments[0].id).toBe('new-tournament');
        });

        it('should handle tournament update', () => {
            const tournament = createMockTournament('t1', TournamentStatus.UPCOMING, ['p1', 'p2']);
            useTournamentStore.setState({ tournaments: [tournament] });

            useTournamentStore.getState().handleTournamentUpdate({
                eventType: 'UPDATE',
                new: { ...tournament, status: 'active' },
                old: tournament,
                schema: 'public',
                table: 'tournaments'
            });

            const state = useTournamentStore.getState();
            expect(state.tournaments[0].status).toBe('active');
        });

        it('should handle match insert in tournament', () => {
            const tournament = createMockTournament('t1', TournamentStatus.IN_PROGRESS, ['p1', 'p2']);
            useTournamentStore.setState({ tournaments: [tournament] });

            const newMatch = {
                id: 'new-match',
                tournament_id: 't1',
                round: 1,
                player1_id: 'p1',
                player2_id: 'p2',
                status: 'scheduled'
            };

            useTournamentStore.getState().handleMatchUpdate({
                eventType: 'INSERT',
                new: newMatch,
                old: null,
                schema: 'public',
                table: 'tournament_matches'
            });

            const state = useTournamentStore.getState();
            expect(state.tournaments[0].matches).toHaveLength(1);
            expect(state.tournaments[0].matches[0].id).toBe('new-match');
        });
    });
});
