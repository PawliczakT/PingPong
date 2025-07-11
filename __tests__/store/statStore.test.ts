import {useStatsStore} from '@/store/statsStore';
import {usePlayerStore} from '@/store/playerStore';
import {Player} from '@/backend/types';

// Mock dependencies
jest.mock('@/store/playerStore', () => ({
    usePlayerStore: {
        getState: jest.fn(),
    },
}));

jest.mock('zustand', () => {
    const original = jest.requireActual('zustand');
    return {
        ...original,
        create: (fn: any) => original.create(fn), // Use actual create for the store itself
        persist: (fn: any) => fn, // Mock persist to simplify
    };
});

jest.mock('zustand/middleware', () => ({
    createJSONStorage: jest.fn(() => ({
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    })),
    persist: (fn: any, _options: any) => fn, // Mock persist middleware
}));


jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

// Helper to reset store state before each test
const resetStatsStoreState = () => {
    useStatsStore.setState({
        rankingHistory: [],
        streaks: {},
        isLoading: false,
        error: null,
    });
};

describe('useStatsStore', () => {
    let mockPlayers: Player[];

    beforeEach(() => {
        // Reset mocks and store state
        jest.clearAllMocks();
        resetStatsStoreState();

        // Default mock for playerStore
        (usePlayerStore.getState as jest.Mock).mockReturnValue({
            players: [],
            getPlayerById: jest.fn(id => mockPlayers.find(p => p.id === id)),
        });
    });

    describe('getTopWinRate', () => {
        it('should return an empty array if there are no players', () => {
            mockPlayers = [];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getTopWinRate(5);
            expect(result).toEqual([]);
        });

        it('should return players with 0% win rate if they have no matches or undefined wins/losses', () => {
            mockPlayers = [
                {
                    id: '1', name: 'Player A', eloRating: 1000, active: true, wins: 0, losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                },
                {
                    id: '2', name: 'Player B', eloRating: 1000, active: true, wins: undefined, losses: undefined,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                },
                {
                    id: '3', name: 'Player C', eloRating: 1000, active: true, wins: 0, losses: 5,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 0% win rate, 5 games
                {
                    id: '4', name: 'Player D', eloRating: 1000, active: true, wins: undefined, losses: 3,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 0% win rate, < 5 games
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getTopWinRate(5);
            // Only player C should be returned as they have >= 5 games. Player A, B, D have < 5 games.
            // Player C has 0 wins / 5 games = 0%
            expect(result).toEqual([
                expect.objectContaining({id: '3', stats: expect.objectContaining({winRate: 0})}),
            ]);
        });

        it('should correctly calculate win rates for players with mixed wins/losses', () => {
            mockPlayers = [
                {
                    id: '1', name: 'Player A', eloRating: 1000, active: true, wins: 5, losses: 5,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 50%
                {
                    id: '2', name: 'Player B', eloRating: 1000, active: true, wins: 8, losses: 2,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 80%
                {
                    id: '3', name: 'Player C', eloRating: 1000, active: true, wins: 2, losses: 8,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 20%
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getTopWinRate(3);
            expect(result[0]).toMatchObject({id: '2', stats: {winRate: 80}});
            expect(result[1]).toMatchObject({id: '1', stats: {winRate: 50}});
            expect(result[2]).toMatchObject({id: '3', stats: {winRate: 20}});
        });

        it('should handle players where stats object is initially undefined', () => {
            mockPlayers = [
                {id: '1', name: 'Player A', eloRating: 1000, active: true, wins: 6, losses: 4} as Player, // 60%
            ];
            // Ensure stats is undefined
            delete mockPlayers[0].stats;
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});

            const result = useStatsStore.getState().getTopWinRate(1);
            expect(result[0]).toBeDefined();
            expect(result[0].stats).toBeDefined();
            expect(result[0].stats.winRate).toBe(60);
        });

        it('should respect the limit parameter', () => {
            mockPlayers = [
                {
                    id: '1', name: 'Player A', eloRating: 1000, active: true, wins: 10, losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 100%
                {
                    id: '2', name: 'Player B', eloRating: 1000, active: true, wins: 8, losses: 2,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                },  // 80%
                {
                    id: '3', name: 'Player C', eloRating: 1000, active: true, wins: 6, losses: 4,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                },  // 60%
                {
                    id: '4', name: 'Player D', eloRating: 1000, active: true, wins: 4, losses: 6,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                },  // 40%
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getTopWinRate(2);
            expect(result.length).toBe(2);
            expect(result[0].id).toBe('1');
            expect(result[1].id).toBe('2');
        });

        it('should filter out players with fewer than 5 total games', () => {
            mockPlayers = [
                {
                    id: '1', name: 'Player A', eloRating: 1000, active: true, wins: 2, losses: 2,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 4 games, 50%
                {
                    id: '2', name: 'Player B', eloRating: 1000, active: true, wins: 3, losses: 2,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 5 games, 60%
                {
                    id: '3', name: 'Player C', eloRating: 1000, active: true, wins: 1, losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 1 game, 100%
                {
                    id: '4', name: 'Player D', eloRating: 1000, active: true, wins: 10, losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // 10 games, 100%
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getTopWinRate(5);
            expect(result.length).toBe(2);
            expect(result.find(p => p.id === '1')).toBeUndefined(); // Player A filtered out
            expect(result.find(p => p.id === '3')).toBeUndefined(); // Player C filtered out
            expect(result.find(p => p.id === '2')).toBeDefined();   // Player B included
            expect(result.find(p => p.id === '4')).toBeDefined();   // Player D included
            // Check sorting
            expect(result[0].id).toBe('4'); // 100%
            expect(result[1].id).toBe('2'); // 60%
        });

        it('should handle null for wins/losses, treating them as 0', () => {
            mockPlayers = [
                // @ts-ignore testing invalid type for robustness
                {id: '1', name: 'Player A', eloRating: 1000, active: true, wins: null, losses: 5}, // 0 wins, 5 losses -> 0%
                // @ts-ignore
                {id: '2', name: 'Player B', eloRating: 1000, active: true, wins: 5, losses: null}, // 5 wins, 0 losses -> 100%
                // @ts-ignore
                {id: '3', name: 'Player C', eloRating: 1000, active: true, wins: null, losses: null}, // 0 wins, 0 losses -> 0%, <5 games
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getTopWinRate(3);

            expect(result.length).toBe(2); // Player 3 filtered out (<5 games)
            const playerA = result.find(p => p.id === '1');
            const playerB = result.find(p => p.id === '2');

            expect(playerB?.stats.winRate).toBe(100);
            expect(playerA?.stats.winRate).toBe(0);
        });
    });

    describe('getLongestWinStreaks', () => {
        beforeEach(() => {
            // Streaks data is part of useStatsStore, so we set its initial state
            useStatsStore.setState({
                streaks: {
                    '1': {current: {wins: 3, losses: 0}, longest: 5},
                    '2': {current: {wins: 1, losses: 0}, longest: 8},
                    '3': {current: {wins: 0, losses: 2}, longest: 2},
                    '4': {current: {wins: 10, losses: 0}, longest: 10},
                    // Player 5 has no streak record
                },
                rankingHistory: [],
                isLoading: false,
                error: null,
            });
        });

        it('should return an empty array if there are no players', () => {
            mockPlayers = [];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getLongestWinStreaks(5);
            expect(result).toEqual([]);
        });

        it('should return players with longestWinStreak 0 if no streaks recorded or longest is 0', () => {
            mockPlayers = [
                {
                    id: '5', name: 'Player E', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // No streak record in store
                {
                    id: '6', name: 'Player F', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Will have streak record via store setup
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});

            // Set up streak for player F as 0
            useStatsStore.setState({
                streaks: {
                    ...useStatsStore.getState().streaks,
                    '6': {current: {wins: 0, losses: 0}, longest: 0},
                }
            });

            const result = useStatsStore.getState().getLongestWinStreaks(5);
            const playerE = result.find(p => p.id === '5');
            const playerF = result.find(p => p.id === '6');

            expect(playerE?.stats?.longestWinStreak).toBe(0);
            expect(playerF?.stats?.longestWinStreak).toBe(0);
        });

        it('should return players sorted by longestWinStreak in descending order', () => {
            mockPlayers = [
                {
                    id: '1', name: 'Player A', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 5
                {
                    id: '2', name: 'Player B', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 8
                {
                    id: '3', name: 'Player C', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 2
                {
                    id: '4', name: 'Player D', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 10
                {
                    id: '5', name: 'Player E', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 0 (no record)
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getLongestWinStreaks(5);

            expect(result.length).toBe(5);
            expect(result[0]).toMatchObject({id: '4', stats: {longestWinStreak: 10}});
            expect(result[1]).toMatchObject({id: '2', stats: {longestWinStreak: 8}});
            expect(result[2]).toMatchObject({id: '1', stats: {longestWinStreak: 5}});
            expect(result[3]).toMatchObject({id: '3', stats: {longestWinStreak: 2}});
            expect(result[4]).toMatchObject({id: '5', stats: {longestWinStreak: 0}});
        });

        it('should handle players where stats object or longestWinStreak is initially undefined', () => {
            mockPlayers = [
                {id: '1', name: 'Player A', eloRating: 1000, active: true} as Player, // Streak 5 from store
            ];
            // Ensure stats is undefined
            delete mockPlayers[0].stats;
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});

            const result = useStatsStore.getState().getLongestWinStreaks(1);
            expect(result[0]).toBeDefined();
            expect(result[0].stats).toBeDefined();
            expect(result[0].stats.longestWinStreak).toBe(5);
        });

        it('should respect the limit parameter for longestWinStreaks', () => {
            mockPlayers = [
                {
                    id: '1', name: 'Player A', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 5
                {
                    id: '2', name: 'Player B', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 8
                {
                    id: '3', name: 'Player C', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 2
                {
                    id: '4', name: 'Player D', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // Streak 10
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            const result = useStatsStore.getState().getLongestWinStreaks(2);
            expect(result.length).toBe(2);
            expect(result[0].id).toBe('4'); // Streak 10
            expect(result[1].id).toBe('2'); // Streak 8
        });

        it('should correctly assign 0 for longestWinStreak if player has no entry in streaks state', () => {
            mockPlayers = [
                {
                    id: '99', name: 'Player X', eloRating: 1000, active: true,
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    dailyDelta: 0,
                    lastMatchDay: '',
                    createdAt: '',
                    updatedAt: ''
                }, // No entry in streaks
            ];
            (usePlayerStore.getState as jest.Mock).mockReturnValue({players: mockPlayers});
            // Ensure streaks state does not have '99'
            const currentStreaks = useStatsStore.getState().streaks;
            delete currentStreaks['99']; // ensure it's not there if it somehow got added
            useStatsStore.setState({streaks: currentStreaks});


            const result = useStatsStore.getState().getLongestWinStreaks(1);
            expect(result.length).toBe(1);
            expect(result[0]).toMatchObject({id: '99', stats: {longestWinStreak: 0}});
        });
    });
});
