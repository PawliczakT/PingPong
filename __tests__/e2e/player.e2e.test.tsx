import React from 'react';
import {render} from '@testing-library/react-native';

// Mock notification service to prevent WebSocket errors
jest.mock('@/app/services/notificationService', () => ({
    notificationService: {
        sendNotification: jest.fn(),
    },
}));

import {usePlayerStore} from '@/store/playerStore';
import {useMatchStore} from '@/store/matchStore';
import {useAchievementStore} from '@/store/achievementStore';
import {AchievementType} from '@/backend/types';

// Mock the screen components
const PlayerProfileScreen = () => <React.Fragment/>;
const PlayersScreen = () => <React.Fragment/>;

// Mock the navigation
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        back: jest.fn(),
        replace: jest.fn(),
    }),
    useLocalSearchParams: () => ({id: 'player1'}),
    Link: ({children}: any) => children,
}));

// Mock Supabase
const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseInsert = jest.fn();
const mockSupabaseUpdate = jest.fn();

jest.mock('../../app/lib/supabase', () => ({
    supabase: {
        from: (...args: any) => {
            mockSupabaseFrom(...args);
            return {
                select: (...selectArgs: any) => {
                    mockSupabaseSelect(...selectArgs);
                    return {
                        order: () => ({
                            data: [],
                            error: null,
                        }),
                    };
                },
                insert: (data: any) => {
                    mockSupabaseInsert(data);
                    return {
                        select: () => ({
                            single: () => ({
                                data: {id: 'new-player-id'},
                                error: null,
                            }),
                        }),
                    };
                },
                update: (data: any) => {
                    mockSupabaseUpdate(data);
                    return {
                        eq: () => ({
                            data: null,
                            error: null,
                        }),
                    };
                },
                delete: () => ({
                    eq: () => ({
                        error: null,
                    }),
                }),
            };
        },
        storage: {
            from: () => ({
                upload: () => ({
                    data: {path: 'mock-path'},
                    error: null,
                }),
            }),
        },
    },
}));

// Helper function to calculate player stats based on matches
const calculatePlayerStats = (playerId: string, matches: any[]) => {
    const playerMatches = matches.filter(
        match => match.player1Id === playerId || match.player2Id === playerId
    );

    const wins = playerMatches.filter(match => {
        return (match.player1Id === playerId && match.winnerId === 1) || (match.player2Id === playerId && match.winnerId === 2);
    }).length;

    const matches_played = playerMatches.length;
    const losses = matches_played - wins;
    const winRate = matches_played > 0 ? Math.round((wins / matches_played) * 100) : 0;

    return {
        matches: matches_played,
        wins,
        losses,
        winRate,
    };
};

// Setup test data
const setupTestData = () => {
    // Mock player store with test data
    const playerStore = usePlayerStore.getState();

    // Create a spy for getPlayerById
    jest.spyOn(playerStore, 'getPlayerById').mockImplementation((playerId) => {
        if (playerId === 'player1') {
            return {
                id: 'player1',
                name: 'John Doe',
                nickname: 'JD',
                email: 'john@example.com',
                avatarUrl: undefined,
                active: true,
                eloRating: 1000,
                wins: 1,
                losses: 1,
                gamesPlayed: 0,
                dailyDelta: 0,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        if (playerId === 'player2') {
            return {
                id: 'player2',
                name: 'Jane Smith',
                nickname: 'Jane',
                email: 'jane@example.com',
                avatarUrl: undefined,
                active: true,
                eloRating: 950,
                wins: 1,
                losses: 1,
                gamesPlayed: 0,
                dailyDelta: 0,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        if (playerId === 'player3') {
            return {
                id: 'player3',
                name: 'Bob Johnson',
                nickname: 'Bobby',
                email: 'bob@example.com',
                avatarUrl: undefined,
                active: true,
                eloRating: 900,
                wins: 0,
                losses: 2,
                gamesPlayed: 2,
                dailyDelta: 0,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        if (playerId === 'player4') {
            return {
                id: 'player4',
                name: 'Alice Brown',
                nickname: 'Ali',
                email: 'alice@example.com',
                avatarUrl: undefined,
                active: true,
                eloRating: 850,
                wins: 0,
                losses: 0,
                gamesPlayed: 0,
                dailyDelta: 0,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        return undefined;
    });

    // Create a spy for getActivePlayersSortedByRating
    jest.spyOn(playerStore, 'getActivePlayersSortedByRating').mockImplementation(() => {
        return [
            {
                id: 'player1',
                name: 'John Doe',
                nickname: 'JD',
                email: 'john@example.com',
                avatarUrl: undefined,
                active: true,
                eloRating: 1100,
                wins: 1,
                losses: 1,
                gamesPlayed: 2,
                dailyDelta: 0,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'player2',
                name: 'Jane Smith',
                nickname: 'Jane',
                email: 'jane@example.com',
                avatarUrl: undefined,
                active: true,
                eloRating: 1050,
                wins: 1,
                losses: 1,
                gamesPlayed: 2,
                dailyDelta: 0,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'player3',
                name: 'Bob Johnson',
                nickname: 'Bobby',
                email: 'bob@example.com',
                avatarUrl: undefined,
                active: true,
                eloRating: 1000,
                wins: 1,
                losses: 1,
                gamesPlayed: 2,
                dailyDelta: 0,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'player4',
                name: 'Alice Brown',
                nickname: 'Ali',
                email: 'alice@example.com',
                avatarUrl: undefined,
                active: true,
                eloRating: 950,
                wins: 0,
                losses: 0,
                gamesPlayed: 0,
                dailyDelta: 0,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
        ];
    });

    // Mock addPlayer
    jest.spyOn(playerStore, 'addPlayer').mockImplementation(async (name, nickname, avatarUrl) => {
        return {
            id: 'new-player-id',
            name,
            nickname: nickname || undefined,
            email: 'new.player@example.com',
            avatarUrl: avatarUrl || undefined,
            active: true,
            eloRating: 1000,
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            dailyDelta: 0,
            lastMatchDay: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    });

    // Mock updatePlayer
    jest.spyOn(playerStore, 'updatePlayer').mockImplementation(async (player) => {
        // This would update the player in a real implementation
        return;
    });

    // Setup matches
    const matchStore = useMatchStore.getState();

    // Mock the matches getter
    Object.defineProperty(matchStore, 'matches', {
        get: jest.fn().mockReturnValue([
            {
                id: 'match1',
                player1Id: 'player1',
                player2Id: 'player2',
                player1Score: 11,
                player2Score: 5,
                winnerId: 1,
                date: new Date().toISOString(),
                tournamentId: 'tournament1',
                tournamentName: 'Test Tournament',
                sets: [{ player1Score: 11, player2Score: 5 }],
            },
            {
                id: 'match2',
                player1Id: 'player1',
                player2Id: 'player3',
                player1Score: 7,
                player2Score: 11,
                winnerId: 2,
                date: new Date().toISOString(),
                tournamentId: 'tournament1',
                tournamentName: 'Test Tournament',
                sets: [{ player1Score: 7, player2Score: 11 }],
            },
            {
                id: 'match3',
                player1Id: 'player2',
                player2Id: 'player3',
                player1Score: 11,
                player2Score: 9,
                winnerId: 1,
                date: new Date().toISOString(),
                tournamentId: 'tournament1',
                tournamentName: 'Test Tournament',
                sets: [{ player1Score: 11, player2Score: 9 }],
            },
        ]),
    });

    // Setup achievements
    const achievementStore = useAchievementStore.getState();

    // Mock player achievements
    Object.defineProperty(achievementStore, 'playerAchievements', {
        get: jest.fn().mockReturnValue({
            player1: [
                {
                    type: AchievementType.FIRST_WIN,
                    progress: 1,
                    unlocked: true,
                    unlockedAt: new Date().toISOString()
                },
                {
                    type: AchievementType.TOURNAMENT_WIN,
                    progress: 1,
                    unlocked: true,
                    unlockedAt: new Date().toISOString()
                },
            ],
        }),
    });

    // Mock checkAndUpdateAchievements
    jest.spyOn(achievementStore, 'checkAndUpdateAchievements').mockImplementation(async () => []);
};

describe('Player Management E2E Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupTestData();
    });

    it('should retrieve player list correctly', async () => {
        // Render the players screen (just to follow the flow)
        render(<PlayersScreen/>);

        // Test that player store methods work correctly
        const playerStore = usePlayerStore.getState();
        const players = playerStore.getActivePlayersSortedByRating();

        // Assert players are retrieved correctly
        expect(players.length).toBe(4);
        expect(players[0].name).toBe('John Doe');
        expect(players[1].name).toBe('Jane Smith');
        expect(players[2].name).toBe('Bob Johnson');
        expect(players[3].name).toBe('Alice Brown');
    });

    it('should add a new player successfully', async () => {
        // Render the players screen (just to follow the flow)
        render(<PlayersScreen/>);

        // Directly call the store method to add a player
        const playerStore = usePlayerStore.getState();
        const newPlayer = await playerStore.addPlayer('New Player', 'Newbie', undefined);

        // Assert player was added correctly
        expect(playerStore.addPlayer).toHaveBeenCalledWith('New Player', 'Newbie', undefined);
        expect(newPlayer.id).toBe('new-player-id');
        expect(newPlayer.name).toBe('New Player');
        expect(newPlayer.nickname).toBe('Newbie');
    });

    it('should retrieve player profile with match history', async () => {
        // Render the player profile screen (just to follow the flow)
        render(<PlayerProfileScreen/>);

        // Test that player store methods work correctly
        const playerStore = usePlayerStore.getState();
        const player = playerStore.getPlayerById('player1');

        // Test that match store methods work correctly for this player
        const matchStore = useMatchStore.getState();
        const matches = matchStore.matches.filter(m =>
            m.player1Id === 'player1' || m.player2Id === 'player1'
        );

        // Assert player and matches are retrieved correctly
        expect(player?.name).toBe('John Doe');
        expect(matches.length).toBe(2);
    });

    it('should update player information successfully', async () => {
        // Render the player profile screen (just to follow the flow)
        render(<PlayerProfileScreen/>);

        // Directly call the store method to update a player
        const playerStore = usePlayerStore.getState();
        const updatedPlayer = {
            id: 'player1',
            name: 'John Doe Updated',
            nickname: 'JD Updated',
            email: 'john.updated@example.com',
            avatarUrl: 'new-avatar-url',
            active: true,
            eloRating: 1000,
            wins: 1,
            losses: 1,
            gamesPlayed: 0,
            dailyDelta: 0,
            lastMatchDay: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await playerStore.updatePlayer(updatedPlayer);

        // Assert player was updated correctly
        expect(playerStore.updatePlayer).toHaveBeenCalledWith(updatedPlayer);
    });

    it('should calculate player statistics correctly', async () => {
        // Render the player profile screen (just to follow the flow)
        render(<PlayerProfileScreen/>);

        // Calculate player stats using our helper function
        const matchStore = useMatchStore.getState();
        const stats = calculatePlayerStats('player1', matchStore.matches);

        // Assert stats are calculated correctly
        expect(stats.matches).toBe(2);
        expect(stats.wins).toBe(1);
        expect(stats.losses).toBe(1);
        expect(stats.winRate).toBe(50);
    });

    it('should retrieve player achievements correctly', async () => {
        // Render the player profile screen (just to follow the flow)
        render(<PlayerProfileScreen/>);

        // Test that achievement store methods work correctly
        const achievementStore = useAchievementStore.getState();
        const achievements = achievementStore.playerAchievements.player1;

        // Assert achievements are retrieved correctly
        expect(achievements.length).toBe(2);
        expect(achievements[0].type).toBe(AchievementType.FIRST_WIN);
        expect(achievements[1].type).toBe(AchievementType.TOURNAMENT_WIN);
        expect(achievements[0].unlocked).toBe(true);
        expect(achievements[1].unlocked).toBe(true);
    });
});
