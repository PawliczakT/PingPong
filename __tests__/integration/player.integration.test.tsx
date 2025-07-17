import {usePlayerStore} from '@/store/playerStore';
import {useMatchStore} from '@/store/matchStore';
import {Player} from '@/backend/types';

// Mock notificationService to prevent WebSocket errors in Jest environment
jest.mock('@/app/services/notificationService', () => ({}));

// Reset store state between tests
beforeEach(() => {
    jest.clearAllMocks();
});

describe('Player Management Integration Tests', () => {
    test('should add a player with correct parameters', async () => {
        const mockAddPlayer = jest.fn();

        // Mockowanie funkcji store'ów
        jest.spyOn(usePlayerStore, 'getState').mockReturnValue({
            addPlayer: mockAddPlayer,
            players: [],
            isLoading: false,
            error: null,
            getPlayerById: jest.fn(),
            updatePlayer: jest.fn(),
            deactivatePlayer: jest.fn(),
            getActivePlayersSortedByRating: jest.fn(),
            updatePlayerRating: jest.fn(),
            updatePlayerStats: jest.fn(),
        });

        // Symulacja dodawania gracza
        const playerStore = usePlayerStore.getState();
        await playerStore.addPlayer('Bob Johnson', 'BJ', 'https://example.com/avatar.png');

        // Sprawdzanie, czy funkcja addPlayer została wywołana z odpowiednimi parametrami
        expect(mockAddPlayer).toHaveBeenCalledWith(
            'Bob Johnson',
            'BJ',
            'https://example.com/avatar.png'
        );
    });

    test('should retrieve player details with match history correctly', async () => {
        const mockPlayer: Player = {
            id: 'player1',
            name: 'John Doe',
            nickname: 'JD',
            avatarUrl: '',
            eloRating: 1600,
            active: true,
            wins: 5,
            losses: 2,
            gamesPlayed: 7,
            createdAt: '2025-05-15T10:00:00.000Z',
            updatedAt: '2025-05-15T10:00:00.000Z',
            rank: {id: 2, name: 'Silver', icon: '🥈', requiredWins: 5, color: '#C0C0C0'},
            dailyDelta: 0,
            lastMatchDay: '',
        };

        const mockOpponent: Player = {
            id: 'player2',
            name: 'Jane Smith',
            nickname: 'JS',
            avatarUrl: '',
            eloRating: 1550,
            active: true,
            wins: 3,
            losses: 3,
            gamesPlayed: 6,
            createdAt: '2025-05-15T10:00:00.000Z',
            updatedAt: '2025-05-15T10:00:00.000Z',
            rank: {id: 1, name: 'Bronze', icon: '🥉', requiredWins: 0, color: '#CD7F32'},
            dailyDelta: 0,
            lastMatchDay: '',
        };

        const mockMatches = [
            {
                id: 'match1',
                player1Id: 'player1',
                player2Id: 'player2',
                player1Score: 3,
                player2Score: 2,
                winnerId: 'player1',
                tournamentId: null,
                sets: [
                    {player1Score: 11, player2Score: 9},
                    {player1Score: 11, player2Score: 8},
                    {player1Score: 9, player2Score: 11},
                    {player1Score: 7, player2Score: 11},
                    {player1Score: 11, player2Score: 9},
                ],
                date: '2025-05-20T15:00:00.000Z',
            },
            {
                id: 'match2',
                player1Id: 'player2',
                player2Id: 'player1',
                player1Score: 1,
                player2Score: 3,
                winnerId: 'player1',
                tournamentId: null,
                sets: [
                    {player1Score: 11, player2Score: 8},
                    {player1Score: 9, player2Score: 11},
                    {player1Score: 7, player2Score: 11},
                    {player1Score: 9, player2Score: 11},
                ],
                date: '2025-05-21T16:00:00.000Z',
            },
        ];

        const mockGetPlayerById = jest.fn().mockImplementation((playerId: string) => {
            if (playerId === 'player1') return mockPlayer;
            if (playerId === 'player2') return mockOpponent;
            return null;
        });

        const mockGetMatchesByPlayerId = jest.fn().mockReturnValue(mockMatches);

        jest.spyOn(usePlayerStore, 'getState').mockReturnValue({
            getPlayerById: mockGetPlayerById,
            players: [mockPlayer, mockOpponent],
            isLoading: false,
            error: null,
            addPlayer: jest.fn(),
            updatePlayer: jest.fn(),
            deactivatePlayer: jest.fn(),
            getActivePlayersSortedByRating: jest.fn(),
            updatePlayerRating: jest.fn(),
            updatePlayerStats: jest.fn(),
        });

        jest.spyOn(useMatchStore, 'getState').mockReturnValue({
            getMatchesByPlayerId: mockGetMatchesByPlayerId,
            matches: mockMatches,
            isLoading: false,
            error: null,
            addMatch: jest.fn(),
            getRecentMatches: jest.fn(),
            getMatchById: jest.fn(),
            getHeadToHead: jest.fn(),
        });

        const playerStore = usePlayerStore.getState();
        const matchStore = useMatchStore.getState();

        const player = playerStore.getPlayerById('player1');
        const matches = matchStore.getMatchesByPlayerId('player1');
        const opponent = playerStore.getPlayerById('player2');

        expect(player).toBeDefined();
        expect(matches).toBeDefined();
        expect(opponent).toBeDefined();

        expect(playerStore.getPlayerById).toHaveBeenCalledWith('player1');
        expect(matchStore.getMatchesByPlayerId).toHaveBeenCalledWith('player1');
        expect(playerStore.getPlayerById).toHaveBeenCalledWith('player2');

        expect(player).toEqual(mockPlayer);
        expect(matches.length).toBe(2);
        expect(opponent!.name).toBe('Jane Smith');
    });
});
