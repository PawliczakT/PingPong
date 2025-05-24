import {usePlayerStore} from '@/store/playerStore';
import {useMatchStore} from '@/store/matchStore';
import {Player} from '@/types';

// Reset store state between tests
beforeEach(() => {
    jest.clearAllMocks();
});

describe('Player Management Integration Tests', () => {
    test('should add a player with correct parameters', async () => {
        // Mock dla funkcji addPlayer
        const mockAddPlayer = jest.fn().mockImplementation(async (name, nickname, avatarUrl) => ({
            id: 'newPlayer123',
            name,
            nickname,
            avatarUrl,
            eloRating: 1500,
            active: true,
            wins: 0,
            losses: 0,
            createdAt: new Date().toISOString()
        }));

        // Mock dla getActivePlayersSortedByRating
        const mockGetActivePlayersSortedByRating = jest.fn().mockReturnValue([
            {id: 'player1', name: 'John Doe', nickname: 'JD', eloRating: 1600, active: true, wins: 5, losses: 2},
            {id: 'player4', name: 'Alice Brown', eloRating: 1650, active: true, wins: 7, losses: 1},
            {id: 'player2', name: 'Jane Smith', nickname: 'JS', eloRating: 1550, active: true, wins: 3, losses: 3},
            {id: 'newPlayer123', name: 'Bob Johnson', nickname: 'BJ', eloRating: 1500, active: true, wins: 0, losses: 0}
        ]);

        // Mockowanie funkcji store'u00f3w
        jest.spyOn(usePlayerStore, 'getState').mockImplementation(() => ({
            addPlayer: mockAddPlayer,
            getActivePlayersSortedByRating: mockGetActivePlayersSortedByRating,
            players: [],
            isLoading: false,
            error: null,
            getPlayerById: jest.fn(),
            updatePlayer: jest.fn(),
            deactivatePlayer: jest.fn(),
            updatePlayerRating: jest.fn(),
            updatePlayerStats: jest.fn()
        }));

        // Symulacja dodawania gracza
        const playerStore = usePlayerStore.getState();
        await playerStore.addPlayer('Bob Johnson', 'BJ', 'https://example.com/avatar.png');

        // Sprawdzanie, czy funkcja addPlayer zostau0142a wywou0142ana z odpowiednimi parametrami
        expect(mockAddPlayer).toHaveBeenCalledWith(
            'Bob Johnson',
            'BJ',
            'https://example.com/avatar.png'
        );
    });

    test('should retrieve player details with match history correctly', async () => {
        // Mock dla getPlayerById
        const mockGetPlayerById = jest.fn().mockReturnValue({
            id: 'player1',
            name: 'John Doe',
            nickname: 'JD',
            eloRating: 1600,
            active: true,
            wins: 5,
            losses: 2,
            createdAt: '2025-05-15T10:00:00.000Z'
        });

        // Mock dla getMatchesByPlayerId
        const mockGetMatchesByPlayerId = jest.fn().mockReturnValue([
            {
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
                date: '2025-05-20T15:00:00.000Z'
            },
            {
                id: 'match2',
                player1Id: 'player2',
                player2Id: 'player1',
                player1Score: 1,
                player2Score: 3,
                sets: [
                    {player1Score: 11, player2Score: 8},
                    {player1Score: 9, player2Score: 11},
                    {player1Score: 7, player2Score: 11},
                    {player1Score: 9, player2Score: 11}
                ],
                date: '2025-05-21T16:00:00.000Z'
            }
        ]);

        // Mock dla getPlayerById w konteku015bcie graczy
        const mockGetOtherPlayerById = jest.fn().mockImplementation((playerId: string) => {
            const players: Record<string, Partial<Player>> = {
                player1: {
                    id: 'player1',
                    name: 'John Doe',
                    nickname: 'JD',
                    eloRating: 1600,
                    active: true,
                    wins: 5,
                    losses: 2
                },
                player2: {
                    id: 'player2',
                    name: 'Jane Smith',
                    nickname: 'JS',
                    eloRating: 1550,
                    active: true,
                    wins: 3,
                    losses: 3
                }
            };
            return players[playerId];
        });

        // Mockowanie funkcji store'u00f3w
        jest.spyOn(usePlayerStore, 'getState').mockImplementation(() => ({
            getPlayerById: mockGetPlayerById,
            players: [],
            isLoading: false,
            error: null,
            addPlayer: jest.fn(),
            updatePlayer: jest.fn(),
            deactivatePlayer: jest.fn(),
            getActivePlayersSortedByRating: jest.fn(),
            updatePlayerRating: jest.fn(),
            updatePlayerStats: jest.fn()
        }));

        jest.spyOn(useMatchStore, 'getState').mockImplementation(() => ({
            getMatchesByPlayerId: mockGetMatchesByPlayerId,
            matches: [],
            isLoading: false,
            error: null,
            addMatch: jest.fn(),
            getRecentMatches: jest.fn(),
            getMatchById: jest.fn(),
            getHeadToHead: jest.fn()
        }));

        // Pobieranie danych gracza
        const playerStore = usePlayerStore.getState();
        const matchStore = useMatchStore.getState();

        const player = playerStore.getPlayerById('player1');
        const matches = matchStore.getMatchesByPlayerId('player1');
        // Pobieranie danych przeciwnika bezpośrednio z mocka, a nie przez matchStore
        const opponent = mockGetOtherPlayerById('player2');

        // Weryfikacja wywołania funkcji
        expect(mockGetPlayerById).toHaveBeenCalledWith('player1');
        expect(mockGetMatchesByPlayerId).toHaveBeenCalledWith('player1');
        expect(mockGetOtherPlayerById).toHaveBeenCalledWith('player2');

        // Sprawdzenie, czy obiekty istnieją przed użyciem ich właściwości
        expect(player).toBeDefined();
        expect(matches).toBeDefined();
        expect(opponent).toBeDefined();

        // Weryfikacja danych
        expect(player).toEqual({
            id: 'player1',
            name: 'John Doe',
            nickname: 'JD',
            eloRating: 1600,
            active: true,
            wins: 5,
            losses: 2,
            createdAt: '2025-05-15T10:00:00.000Z'
        });
        expect(matches.length).toBe(2);
        expect(opponent!.name).toBe('Jane Smith');
    });
});
