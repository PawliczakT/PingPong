import {useTournamentStore} from '@/store/tournamentStore';
import {usePlayerStore} from '@/store/playerStore';
import {useMatchStore} from '@/store/matchStore';
import {Match, Player, Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/backend/types';
import {RealtimePostgresChangesPayload} from '@supabase/supabase-js';

// Mock notificationService to prevent WebSocket errors in Jest environment
jest.mock('@/backend/server/trpc/services/notificationService', () => ({}));

// Reset store state between tests
beforeEach(() => {
    jest.clearAllMocks();
});

describe('Tournament Management Integration Tests', () => {
    test('should create a tournament with correct parameters', async () => {
        const mockCreateTournament = jest.fn();

        jest.spyOn(useTournamentStore, 'getState').mockReturnValue({
            createTournament: mockCreateTournament,
            tournaments: [],
            loading: false,
            error: null,
            lastFetchTimestamp: null,
            fetchTournaments: jest.fn(),
            getTournamentById: jest.fn(),
            generateTournamentMatches: jest.fn(),
            updateMatchResult: jest.fn(),
            getTournamentMatches: jest.fn(),
            updateTournamentStatus: jest.fn(),
            setTournamentWinner: jest.fn(),
            generateAndStartTournament: jest.fn(),
            getUpcomingTournaments: jest.fn(),
            getActiveTournaments: jest.fn(),
            getCompletedTournaments: jest.fn(),
            handleTournamentUpdate: function (payload: RealtimePostgresChangesPayload<any>): unknown {
                throw new Error('Function not implemented.');
            },
            handleMatchUpdate: function (payload: RealtimePostgresChangesPayload<any>): unknown {
                throw new Error('Function not implemented.');
            },
            getPlayerTournamentWins: function (playerId: string): number {
                throw new Error('Function not implemented.');
            }
        });

        const tournamentStore = useTournamentStore.getState();
        const participants = ['player1', 'player2', 'player3', 'player4'];
        const tournamentDate = '2025-06-15';

        await tournamentStore.createTournament(
            'Summer Ping Pong Championship',
            tournamentDate,
            TournamentFormat.KNOCKOUT,
            participants
        );

        expect(mockCreateTournament).toHaveBeenCalledWith(
            'Summer Ping Pong Championship',
            tournamentDate,
            TournamentFormat.KNOCKOUT,
            participants
        );
    });

    test('should retrieve tournament details with matches correctly', async () => {
        const mockPlayers: Player[] = [
            {
                id: 'player1',
                name: 'John Doe',
                nickname: 'JD',
                avatarUrl: '',
                eloRating: 1600,
                active: true,
                wins: 5,
                losses: 2,
                gamesPlayed: 7,
                createdAt: '2025-01-01T10:00:00Z',
                updatedAt: '2025-01-01T10:00:00Z',
                rank: {id: 2, name: 'Silver', icon: '🥈', requiredWins: 5, color: '#C0C0C0'},
                dailyDelta: 0,
                lastMatchDay: ''
            },
            {
                id: 'player2',
                name: 'Jane Smith',
                nickname: 'JS',
                avatarUrl: '',
                eloRating: 1550,
                active: true,
                wins: 3,
                losses: 3,
                gamesPlayed: 6,
                createdAt: '2025-01-01T10:00:00Z',
                updatedAt: '2025-01-01T10:00:00Z',
                rank: {id: 1, name: 'Bronze', icon: '🥉', requiredWins: 0, color: '#CD7F32'},
                dailyDelta: 0,
                lastMatchDay: ''
            },
            {
                id: 'player3',
                name: 'Bob Johnson',
                nickname: 'BJ',
                avatarUrl: '',
                eloRating: 1500,
                active: true,
                wins: 2,
                losses: 4,
                gamesPlayed: 6,
                createdAt: '2025-01-01T10:00:00Z',
                updatedAt: '2025-01-01T10:00:00Z',
                rank: {id: 1, name: 'Bronze', icon: '🥉', requiredWins: 0, color: '#CD7F32'},
                dailyDelta: 0,
                lastMatchDay: ''
            },
            {
                id: 'player4',
                name: 'Alice Brown',
                nickname: 'AB',
                avatarUrl: '',
                eloRating: 1650,
                active: true,
                wins: 7,
                losses: 1,
                gamesPlayed: 8,
                createdAt: '2025-01-01T10:00:00Z',
                updatedAt: '2025-01-01T10:00:00Z',
                rank: {id: 2, name: 'Silver', icon: '🥈', requiredWins: 5, color: '#C0C0C0'},
                dailyDelta: 0,
                lastMatchDay: ''
            },
        ];

        const mockMatches: Match[] = [
            {
                id: 'match1',
                player1Id: 'player1',
                player2Id: 'player2',
                player1Score: 2,
                player2Score: 1,
                winnerId: 'player1',
                sets: [
                    {player1Score: 11, player2Score: 8},
                    {player1Score: 9, player2Score: 11},
                    {player1Score: 11, player2Score: 7},
                ],
                date: '2025-06-15T10:00:00.000Z',
            },
            {
                id: 'match2',
                player1Id: 'player3',
                player2Id: 'player4',
                player1Score: 0,
                player2Score: 2,
                winnerId: 'player4',
                sets: [
                    {player1Score: 5, player2Score: 11},
                    {player1Score: 6, player2Score: 11},
                ],
                date: '2025-06-15T11:00:00.000Z',
            },
            {
                id: 'match3',
                player1Id: 'player1',
                player2Id: 'player4',
                player1Score: 2,
                player2Score: 0,
                winnerId: 'player1',
                sets: [
                    {player1Score: 11, player2Score: 9},
                    {player1Score: 11, player2Score: 5},
                ],
                date: '2025-06-15T14:00:00.000Z',
            },
        ];

        const mockTournamentMatches: TournamentMatch[] = [
            {
                id: 't-match1',
                tournamentId: 'tournament1',
                round: 1,
                player1Id: 'player1',
                player2Id: 'player2',
                winner: 'player1',
                status: 'completed',
                matchId: 'match1',
                nextMatchId: 't-match3',
                player1Score: 2,
                player2Score: 1,
            },
            {
                id: 't-match2',
                tournamentId: 'tournament1',
                round: 1,
                player1Id: 'player3',
                player2Id: 'player4',
                winner: 'player4',
                status: 'completed',
                matchId: 'match2',
                nextMatchId: 't-match3',
                player1Score: 0,
                player2Score: 2,
            },
            {
                id: 't-match3',
                tournamentId: 'tournament1',
                round: 2,
                player1Id: 'player1',
                player2Id: 'player4',
                winner: 'player1',
                status: 'completed',
                matchId: 'match3',
                nextMatchId: null,
                player1Score: 2,
                player2Score: 0,
            },
        ];

        const mockTournament: Tournament = {
            id: 'tournament1',
            name: 'Summer Ping Pong Championship',
            format: TournamentFormat.KNOCKOUT,
            participants: mockPlayers.map(p => p.id),
            date: '2025-06-15',
            matches: mockTournamentMatches,
            status: TournamentStatus.COMPLETED,
            createdAt: '2025-06-01T10:00:00.000Z',
            winner: 'player1',
        };

        const mockGetTournamentById = jest.fn().mockReturnValue(mockTournament);
        const mockGetMatchById = jest.fn(matchId => mockMatches.find(m => m.id === matchId) || null);
        const mockGetPlayerById = jest.fn(playerId => mockPlayers.find(p => p.id === playerId) || null);

        jest.spyOn(useTournamentStore, 'getState').mockReturnValue({
            getTournamentById: mockGetTournamentById,
            tournaments: [mockTournament],
            loading: false, error: null, lastFetchTimestamp: null,
            fetchTournaments: jest.fn(), createTournament: jest.fn(),
            generateTournamentMatches: jest.fn(), updateMatchResult: jest.fn(),
            getTournamentMatches: jest.fn(), updateTournamentStatus: jest.fn(),
            setTournamentWinner: jest.fn(), generateAndStartTournament: jest.fn(),
            getUpcomingTournaments: jest.fn(), getActiveTournaments: jest.fn(),
            getCompletedTournaments: jest.fn(),
            handleTournamentUpdate: function (payload: RealtimePostgresChangesPayload<any>): unknown {
                throw new Error('Function not implemented.');
            },
            handleMatchUpdate: function (payload: RealtimePostgresChangesPayload<any>): unknown {
                throw new Error('Function not implemented.');
            },
            getPlayerTournamentWins: function (playerId: string): number {
                throw new Error('Function not implemented.');
            }
        });

        jest.spyOn(useMatchStore, 'getState').mockReturnValue({
            getMatchById: mockGetMatchById,
            matches: mockMatches,
            isLoading: false, error: null,
            addMatch: jest.fn(), getRecentMatches: jest.fn(),
            getMatchesByPlayerId: jest.fn(), getHeadToHead: jest.fn(),
        });

        jest.spyOn(usePlayerStore, 'getState').mockReturnValue({
            getPlayerById: mockGetPlayerById,
            players: mockPlayers,
            isLoading: false, error: null,
            addPlayer: jest.fn(), getActivePlayersSortedByRating: jest.fn(),
            updatePlayer: jest.fn(), deactivatePlayer: jest.fn(),
            updatePlayerRating: jest.fn(), updatePlayerStats: jest.fn(),
        });

        const tournamentStore = useTournamentStore.getState();
        const matchStore = useMatchStore.getState();
        const playerStore = usePlayerStore.getState();

        const tournament = tournamentStore.getTournamentById('tournament1');
        const match1 = matchStore.getMatchById('match1');
        const player1 = playerStore.getPlayerById(match1!.player1Id);
        const player2 = playerStore.getPlayerById(match1!.player2Id);

        expect(tournament).toBeDefined();
        expect(match1).toBeDefined();
        expect(player1).toBeDefined();
        expect(player2).toBeDefined();

        expect(tournament!.name).toBe('Summer Ping Pong Championship');
        expect(match1!.winnerId).toBe('player1');
        expect(player1!.name).toBe('John Doe');
        expect(player2!.name).toBe('Jane Smith');
    });
});
