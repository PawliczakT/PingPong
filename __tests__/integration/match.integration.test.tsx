import {useMatchStore} from '@/store/matchStore';
import {usePlayerStore} from '@/store/playerStore';
import {useEloStore} from '@/store/eloStore';
import {useStatsStore} from '@/store/statsStore';
import {useAchievementStore} from '@/store/achievementStore';
import {Player, Set} from '@/backend/types';

// Mock external dependencies
jest.mock('@/app/lib/supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnValue({
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockImplementation(() => ({
                single: jest.fn().mockResolvedValue({
                    data: {
                        id: 'match-id-123',
                        player1_id: 'player1',
                        player2_id: 'player2',
                        player1_score: 3,
                        player2_score: 1,
                        sets: [{player1Score: 11, player2Score: 8}],
                        winner: 'player1',
                        tournament_id: 'tourney-1',
                        date: new Date().toISOString(),
                    },
                    error: null,
                }),
            })),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({data: {}, error: null}),
        }),
    },
}));

jest.mock('@/backend/server/trpc/services/notificationService', () => ({
    dispatchSystemNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/store/notificationStore', () => ({
    sendMatchResultNotification: jest.fn().mockResolvedValue(undefined),
    sendRankingChangeNotification: jest.fn().mockResolvedValue(undefined),
    sendAchievementNotification: jest.fn().mockResolvedValue(undefined),
}));

// Initial state for resetting stores
const initialPlayerState = usePlayerStore.getState();
const initialMatchState = useMatchStore.getState();
const initialEloState = useEloStore.getState();
const initialStatsState = useStatsStore.getState();
const initialAchievementState = useAchievementStore.getState();

const mockPlayers: Player[] = [
    {
        id: 'player1',
        name: 'John Doe',
        nickname: 'Johnny',
        avatarUrl: '',
        eloRating: 1500,
        wins: 10,
        losses: 5,
        gamesPlayed: 15,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rank: {
            name: 'Bronze',
            id: 0,
            icon: '',
            requiredWins: 0,
            color: ''
        },
        dailyDelta: 0,
        lastMatchDay: ''
    },
    {
        id: 'player2',
        name: 'Jane Smith',
        nickname: 'Janie',
        avatarUrl: '',
        eloRating: 1550,
        wins: 12,
        losses: 3,
        gamesPlayed: 15,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rank: {
            name: 'Silver',
            id: 0,
            icon: '',
            requiredWins: 0,
            color: ''
        },
        dailyDelta: 0,
        lastMatchDay: ''
    },
];

describe('Match Management Integration Tests', () => {
    beforeEach(() => {
        // Reset all stores to their initial state before each test
        usePlayerStore.setState(initialPlayerState, true);
        useMatchStore.setState(initialMatchState, true);
        useEloStore.setState(initialEloState, true);
        useStatsStore.setState(initialStatsState, true);
        useAchievementStore.setState(initialAchievementState, true);

        // Clear all mocks
        jest.clearAllMocks();

        // Setup initial data for stores
        usePlayerStore.setState({players: mockPlayers});
        useEloStore.getState().initialize(mockPlayers);
    });

    test('should add a match and correctly update player stats and ELO ratings', async () => {
        // Arrange
        const player1InitialElo = usePlayerStore.getState().getPlayerById('player1')?.eloRating;
        const player2InitialElo = usePlayerStore.getState().getPlayerById('player2')?.eloRating;
        const player1InitialWins = usePlayerStore.getState().getPlayerById('player1')?.wins;

        const matchData = {
            player1Id: 'player1',
            player2Id: 'player2',
            player1Score: 3,
            player2Score: 1,
            sets: [{player1Score: 11, player2Score: 8}] as Set[],
            tournamentId: 'tourney-1',
        };

        // Act
        const newMatch = await useMatchStore.getState().addMatch(matchData);

        // Assert
        // 1. Check if the match was added to the match store
        expect(newMatch).toBeDefined();
        expect(newMatch.id).toBe('match-id-123');

        // 2. Get updated players from the store
        const updatedPlayer1 = usePlayerStore.getState().getPlayerById('player1');
        const updatedPlayer2 = usePlayerStore.getState().getPlayerById('player2');

        // 3. Verify ELO ratings were updated
        expect(updatedPlayer1?.eloRating).toBeGreaterThan(player1InitialElo!);
        expect(updatedPlayer2?.eloRating).toBeLessThan(player2InitialElo!);

        // 4. Verify win/loss stats were updated
        expect(updatedPlayer1?.wins).toBe(player1InitialWins! + 1);

        // 5. Verify other stores were called
        const achievementStore = useAchievementStore.getState();
        const statsStore = useStatsStore.getState();
        const checkAndUpdateAchievementsSpy = jest.spyOn(achievementStore, 'checkAndUpdateAchievements');
        const updatePlayerStreakSpy = jest.spyOn(statsStore, 'updatePlayerStreak');

        // We need to re-run addMatch with spies attached
        usePlayerStore.setState({players: mockPlayers}); // Reset players for re-run
        await useMatchStore.getState().addMatch(matchData);

        expect(checkAndUpdateAchievementsSpy).toHaveBeenCalledWith('player1');
        expect(checkAndUpdateAchievementsSpy).toHaveBeenCalledWith('player2');
        expect(updatePlayerStreakSpy).toHaveBeenCalledWith('player1', true);
        expect(updatePlayerStreakSpy).toHaveBeenCalledWith('player2', false);
    });

    test('should throw an error if a player is not found', async () => {
        // Arrange
        const matchData = {
            player1Id: 'player1',
            player2Id: 'non-existent-player',
            player1Score: 3,
            player2Score: 1,
            sets: [{player1Score: 11, player2Score: 8}] as Set[],
        };

        // Act & Assert
        await expect(useMatchStore.getState().addMatch(matchData)).rejects.toThrow('Player not found');
    });
});
