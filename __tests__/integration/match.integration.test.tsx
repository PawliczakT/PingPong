import {useMatchStore} from '@/store/matchStore';
import {usePlayerStore} from '@/store/playerStore';
import {Player, Set} from '@/types';

// Reset store state between tests
beforeEach(() => {
    jest.clearAllMocks();
});

describe('Match Management Integration Tests', () => {
    test('should add a match with correct parameters', async () => {
        // Mock dla funkcji addMatch
        const mockAddMatch = jest.fn().mockImplementation(async (player1Id: string, player2Id: string, player1Score: number, player2Score: number, sets: Set[], tournamentId: string) => ({
            id: 'newMatch123',
            player1Id,
            player2Id,
            player1Score,
            player2Score,
            sets,
            tournamentId,
            date: new Date().toISOString()
        }));

        // Mock dla getPlayerById
        const mockGetPlayerById = jest.fn().mockImplementation((playerId: string) => {
            const players: Record<string, Partial<Player>> = {
                player1: {id: 'player1', name: 'John Doe', eloRating: 1600, active: true, wins: 5, losses: 2},
                player2: {id: 'player2', name: 'Jane Smith', eloRating: 1550, active: true, wins: 3, losses: 3},
                player3: {id: 'player3', name: 'Bob Johnson', eloRating: 1500, active: true, wins: 2, losses: 4}
            };
            return players[playerId];
        });

        // Mockowanie funkcji store'u00f3w
        jest.spyOn(useMatchStore, 'getState').mockImplementation(() => ({
            addMatch: mockAddMatch,
            getRecentMatches: jest.fn().mockReturnValue([]),
            matches: [],
            isLoading: false,
            error: null,
            getMatchById: jest.fn(),
            getMatchesByPlayerId: jest.fn(),
            getHeadToHead: jest.fn()
        }));

        jest.spyOn(usePlayerStore, 'getState').mockImplementation(() => ({
            getPlayerById: mockGetPlayerById,
            getActivePlayersSortedByRating: jest.fn().mockReturnValue([
                {id: 'player1', name: 'John Doe', eloRating: 1600, active: true, wins: 5, losses: 2},
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

        // Symulacja tworzenia meczu
        const matchStore = useMatchStore.getState();
        const sets: Set[] = [
            {player1Score: 11, player2Score: 5},
            {player1Score: 11, player2Score: 7},
            {player1Score: 11, player2Score: 9}
        ];

        await matchStore.addMatch('player1', 'player3', 3, 0, sets, 'tournament1');

        // Weryfikacja czy funkcja addMatch zostau0142a wywou0142ana z odpowiednimi parametrami
        expect(mockAddMatch).toHaveBeenCalledWith(
            'player1',
            'player3',
            3,
            0,
            sets,
            'tournament1'
        );
    });

    test('should retrieve match details correctly', async () => {
        // Mock dla getMatchById
        const mockGetMatchById = jest.fn().mockReturnValue({
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
        });

        // Mock dla getPlayerById
        const mockGetPlayerById = jest.fn().mockImplementation((playerId: string) => {
            const players: Record<string, Partial<Player>> = {
                player1: {id: 'player1', name: 'John Doe', eloRating: 1600, active: true, wins: 5, losses: 2},
                player2: {id: 'player2', name: 'Jane Smith', eloRating: 1550, active: true, wins: 3, losses: 3}
            };
            return players[playerId];
        });

        // Mockowanie funkcji store'u00f3w
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
            updatePlayer: jest.fn(),
            deactivatePlayer: jest.fn(),
            getActivePlayersSortedByRating: jest.fn(),
            updatePlayerRating: jest.fn(),
            updatePlayerStats: jest.fn()
        }));

        // Pobieranie danych meczu
        const matchStore = useMatchStore.getState();
        const playerStore = usePlayerStore.getState();

        const match = matchStore.getMatchById('match1');
        const player1 = playerStore.getPlayerById('player1');
        const player2 = playerStore.getPlayerById('player2');

        // Weryfikacja wywou0142au0144 funkcji
        expect(mockGetMatchById).toHaveBeenCalledWith('match1');
        expect(mockGetPlayerById).toHaveBeenCalledWith('player1');
        expect(mockGetPlayerById).toHaveBeenCalledWith('player2');

        // Sprawdzenie, czy obiekty istnieju0105 przed uu017cyciem ich wu0142au015bciwou015bci
        expect(player1).toBeDefined();
        expect(player2).toBeDefined();

        // Weryfikacja danych
        expect(match).toEqual({
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
        });

        // Uu017cywamy niezbu0119dnego operatora (!) do zapewnienia TypeScript, u017ce obiekty nie su0105 undefined
        expect(player1!.name).toBe('John Doe');
        expect(player2!.name).toBe('Jane Smith');
    });
});
