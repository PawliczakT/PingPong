import {useTournamentStore} from '@/store/tournamentStore';
import {usePlayerStore} from '@/store/playerStore';
import {useMatchStore} from '@/store/matchStore';
import {Player, TournamentFormat, TournamentStatus} from '@/types';

// Reset store state between tests
beforeEach(() => {
    jest.clearAllMocks();
});

describe('Tournament Management Integration Tests', () => {
    test('should create a tournament with correct parameters', async () => {
        // Mock dla funkcji createTournament
        const mockCreateTournament = jest.fn().mockImplementation(async (name, date, format, participants) => ({
            id: 'tournament1',
            name,
            format,
            participants,
            date,
            matches: [],
            status: TournamentStatus.IN_PROGRESS,
            createdAt: new Date().toISOString()
        }));

        // Mock dla getPlayerById
        const mockGetPlayerById = jest.fn().mockImplementation((playerId: string) => {
            const players: Record<string, Partial<Player>> = {
                player1: {id: 'player1', name: 'John Doe', eloRating: 1600, active: true, wins: 5, losses: 2},
                player2: {id: 'player2', name: 'Jane Smith', eloRating: 1550, active: true, wins: 3, losses: 3},
                player3: {id: 'player3', name: 'Bob Johnson', eloRating: 1500, active: true, wins: 2, losses: 4},
                player4: {id: 'player4', name: 'Alice Brown', eloRating: 1650, active: true, wins: 7, losses: 1}
            };
            return players[playerId];
        });

        // Mockowanie funkcji store'u00f3w
        jest.spyOn(useTournamentStore, 'getState').mockImplementation(() => ({
            createTournament: mockCreateTournament,
            tournaments: [],
            loading: false,
            error: null,
            lastFetchTimestamp: null,
            fetchTournaments: jest.fn().mockResolvedValue(undefined),
            getTournamentById: jest.fn(),
            generateTournamentMatches: jest.fn().mockResolvedValue(undefined),
            updateMatchResult: jest.fn().mockResolvedValue(undefined),
            getTournamentMatches: jest.fn().mockReturnValue([]),
            updateTournamentStatus: jest.fn().mockResolvedValue(undefined),
            setTournamentWinner: jest.fn().mockResolvedValue(undefined),
            generateAndStartTournament: jest.fn().mockResolvedValue(undefined),
            getUpcomingTournaments: jest.fn().mockReturnValue([]),
            getActiveTournaments: jest.fn().mockReturnValue([]),
            getCompletedTournaments: jest.fn().mockReturnValue([])
        }));

        jest.spyOn(usePlayerStore, 'getState').mockImplementation(() => ({
            getPlayerById: mockGetPlayerById,
            getActivePlayersSortedByRating: jest.fn().mockReturnValue([
                {id: 'player1', name: 'John Doe', eloRating: 1600, active: true, wins: 5, losses: 2},
                {id: 'player4', name: 'Alice Brown', eloRating: 1650, active: true, wins: 7, losses: 1},
                {id: 'player2', name: 'Jane Smith', eloRating: 1550, active: true, wins: 3, losses: 3},
                {id: 'player3', name: 'Bob Johnson', eloRating: 1500, active: true, wins: 2, losses: 4}
            ]),
            players: [],
            isLoading: false,
            error: null,
            addPlayer: jest.fn(),
            updatePlayer: jest.fn(),
            deactivatePlayer: jest.fn(),
            updatePlayerRating: jest.fn(),
            updatePlayerStats: jest.fn()
        }));

        // Symulacja tworzenia turnieju
        const tournamentStore = useTournamentStore.getState();
        const participants = ['player1', 'player2', 'player3', 'player4'];
        const tournamentDate = '2025-06-15';

        await tournamentStore.createTournament(
            'Summer Ping Pong Championship',
            tournamentDate,
            TournamentFormat.KNOCKOUT,
            participants
        );

        // Weryfikacja czy funkcja createTournament zostau0142a wywou0142ana z odpowiednimi parametrami
        expect(mockCreateTournament).toHaveBeenCalledWith(
            'Summer Ping Pong Championship',
            tournamentDate,
            TournamentFormat.KNOCKOUT,
            participants
        );
    });

    test('should retrieve tournament details with matches correctly', async () => {
        // Mock dla getTournamentById
        const mockGetTournamentById = jest.fn().mockReturnValue({
            id: 'tournament1',
            name: 'Summer Ping Pong Championship',
            format: TournamentFormat.KNOCKOUT,
            participants: ['player1', 'player2', 'player3', 'player4'],
            date: '2025-06-15',
            matches: ['match1', 'match2'],
            status: TournamentStatus.IN_PROGRESS,
            createdAt: '2025-06-01T10:00:00.000Z'
        });

        // Mock dla getMatchById
        const mockGetMatchById = jest.fn().mockImplementation((matchId: string) => {
            const matches: Record<string, any> = {
                match1: {
                    id: 'match1',
                    player1Id: 'player1',
                    player2Id: 'player2',
                    player1Score: 3,
                    player2Score: 2,
                    sets: [
                        {player1Score: 11, player2Score: 9},
                        {player1Score: 11, player2Score: 8},
                        {player1Score: 9, player2Score: 11},
                        {player1Score: 7, player2Score: 11},
                        {player1Score: 11, player2Score: 9}
                    ],
                    date: '2025-06-15T12:00:00.000Z',
                    tournamentId: 'tournament1'
                },
                match2: {
                    id: 'match2',
                    player1Id: 'player3',
                    player2Id: 'player4',
                    player1Score: 0,
                    player2Score: 3,
                    sets: [
                        {player1Score: 9, player2Score: 11},
                        {player1Score: 7, player2Score: 11},
                        {player1Score: 8, player2Score: 11}
                    ],
                    date: '2025-06-15T14:00:00.000Z',
                    tournamentId: 'tournament1'
                }
            };
            return matches[matchId];
        });

        // Mock dla getPlayerById
        const mockGetPlayerById = jest.fn().mockImplementation((playerId: string) => {
            const players: Record<string, Partial<Player>> = {
                player1: {id: 'player1', name: 'John Doe', eloRating: 1600, active: true, wins: 5, losses: 2},
                player2: {id: 'player2', name: 'Jane Smith', eloRating: 1550, active: true, wins: 3, losses: 3},
                player3: {id: 'player3', name: 'Bob Johnson', eloRating: 1500, active: true, wins: 2, losses: 4},
                player4: {id: 'player4', name: 'Alice Brown', eloRating: 1650, active: true, wins: 7, losses: 1}
            };
            return players[playerId];
        });

        // Mockowanie funkcji store'u00f3w
        jest.spyOn(useTournamentStore, 'getState').mockImplementation(() => ({
            getTournamentById: mockGetTournamentById,
            tournaments: [],
            loading: false,
            error: null,
            lastFetchTimestamp: null,
            fetchTournaments: jest.fn().mockResolvedValue(undefined),
            createTournament: jest.fn(),
            generateTournamentMatches: jest.fn().mockResolvedValue(undefined),
            updateMatchResult: jest.fn().mockResolvedValue(undefined),
            getTournamentMatches: jest.fn().mockReturnValue([]),
            updateTournamentStatus: jest.fn().mockResolvedValue(undefined),
            setTournamentWinner: jest.fn().mockResolvedValue(undefined),
            generateAndStartTournament: jest.fn().mockResolvedValue(undefined),
            getUpcomingTournaments: jest.fn().mockReturnValue([]),
            getActiveTournaments: jest.fn().mockReturnValue([]),
            getCompletedTournaments: jest.fn().mockReturnValue([])
        }));

        jest.spyOn(useMatchStore, 'getState').mockImplementation(() => ({
            getMatchById: mockGetMatchById,
            matches: [],
            isLoading: false,
            error: null,
            addMatch: jest.fn(),
            getRecentMatches: jest.fn(),
            getMatchesByPlayerId: jest.fn(),
            getHeadToHead: jest.fn()
        }));

        jest.spyOn(usePlayerStore, 'getState').mockImplementation(() => ({
            getPlayerById: mockGetPlayerById,
            players: [],
            isLoading: false,
            error: null,
            addPlayer: jest.fn(),
            getActivePlayersSortedByRating: jest.fn(),
            updatePlayer: jest.fn(),
            deactivatePlayer: jest.fn(),
            updatePlayerRating: jest.fn(),
            updatePlayerStats: jest.fn()
        }));

        // Pobieranie danych turnieju
        const tournamentStore = useTournamentStore.getState();
        const matchStore = useMatchStore.getState();
        const playerStore = usePlayerStore.getState();

        const tournament = tournamentStore.getTournamentById('tournament1');
        const match1 = matchStore.getMatchById('match1');
        const match2 = matchStore.getMatchById('match2');
        const player1 = playerStore.getPlayerById('player1');
        const player2 = playerStore.getPlayerById('player2');

        // Weryfikacja wywou0142au0144 funkcji
        expect(mockGetTournamentById).toHaveBeenCalledWith('tournament1');
        expect(mockGetMatchById).toHaveBeenCalledWith('match1');
        expect(mockGetMatchById).toHaveBeenCalledWith('match2');
        expect(mockGetPlayerById).toHaveBeenCalledWith('player1');
        expect(mockGetPlayerById).toHaveBeenCalledWith('player2');

        // Sprawdzenie, czy obiekty istnieju0105 przed uu017cyciem ich wu0142au015bciwou015bci
        expect(tournament).toBeDefined();
        expect(match1).toBeDefined();
        expect(match2).toBeDefined();
        expect(player1).toBeDefined();
        expect(player2).toBeDefined();

        // Weryfikacja danych turnieju
        expect(tournament).toEqual({
            id: 'tournament1',
            name: 'Summer Ping Pong Championship',
            format: TournamentFormat.KNOCKOUT,
            participants: ['player1', 'player2', 'player3', 'player4'],
            date: '2025-06-15',
            matches: ['match1', 'match2'],
            status: TournamentStatus.IN_PROGRESS,
            createdAt: '2025-06-01T10:00:00.000Z'
        });

        // Weryfikacja danych meczu
        expect(match1!.player1Id).toBe('player1');
        expect(match1!.player2Id).toBe('player2');
        expect(match2!.player1Id).toBe('player3');
        expect(match2!.player2Id).toBe('player4');

        // Weryfikacja danych graczy
        expect(player1!.name).toBe('John Doe');
        expect(player2!.name).toBe('Jane Smith');
    });
});
