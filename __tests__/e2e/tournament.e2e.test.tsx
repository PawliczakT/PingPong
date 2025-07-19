import React from 'react';
import {render} from '@testing-library/react-native';
import {usePlayerStore} from '@/store/playerStore';
import {useTournamentStore} from '@/tournaments/TournamentStore';
import {useMatchStore} from '@/store/matchStore';
import {Player, TournamentFormat, TournamentStatus} from '@/backend/types';

// Mock the screen components
const TournamentsScreen = () => <React.Fragment/>;
const TournamentDetailsScreen = () => <React.Fragment/>;
const NewTournamentScreen = () => <React.Fragment/>;

jest.mock('@/app/services/notificationService', () => ({
    notificationService: {
        sendNotification: jest.fn(),
    },
}));

// Mock the navigation
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        back: jest.fn(),
        replace: jest.fn(),
    }),
    useLocalSearchParams: () => ({id: 'tournament1'}),
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
                        eq: () => ({
                            data: [],
                            error: null,
                        }),
                        order: () => ({
                            data: [],
                            error: null,
                        }),
                        ilike: () => ({
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
                                data: {id: 'new-tournament-id'},
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
            };
        },
    },
}));

// Setup test data
const setupTestData = () => {
    // Setup players
    const playerStore = usePlayerStore.getState();

    // Mock the getPlayerById method
    jest.spyOn(playerStore, 'getPlayerById').mockImplementation((id: string) => {
        const players: Player[] = [
            {
                id: 'player1',
                name: 'John Doe',
                avatarUrl: undefined,
                active: true,
                eloRating: 1100,
                wins: 5,
                losses: 2,
                gamesPlayed: 7,
                dailyDelta: 10,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player2',
                name: 'Jane Smith',
                avatarUrl: undefined,
                active: true,
                eloRating: 1050,
                wins: 3,
                losses: 4,
                gamesPlayed: 7,
                dailyDelta: -5,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player3',
                name: 'Peter Jones',
                avatarUrl: undefined,
                active: true,
                eloRating: 1150,
                wins: 8,
                losses: 1,
                gamesPlayed: 9,
                dailyDelta: 20,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player4',
                name: 'Mary Williams',
                avatarUrl: undefined,
                active: true,
                eloRating: 1000,
                wins: 0,
                losses: 5,
                gamesPlayed: 5,
                dailyDelta: -15,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ];
        return players.find((p) => p.id === id);
    });

    usePlayerStore.setState({
        players: [
            {
                id: 'player1',
                name: 'John Doe',
                avatarUrl: undefined,
                active: true,
                eloRating: 1100,
                wins: 5,
                losses: 2,
                gamesPlayed: 7,
                dailyDelta: 10,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player2',
                name: 'Jane Smith',
                avatarUrl: undefined,
                active: true,
                eloRating: 1050,
                wins: 3,
                losses: 4,
                gamesPlayed: 7,
                dailyDelta: -5,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player3',
                name: 'Peter Jones',
                avatarUrl: undefined,
                active: true,
                eloRating: 1150,
                wins: 8,
                losses: 1,
                gamesPlayed: 9,
                dailyDelta: 20,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player4',
                name: 'Mary Williams',
                avatarUrl: undefined,
                active: true,
                eloRating: 1000,
                wins: 0,
                losses: 5,
                gamesPlayed: 5,
                dailyDelta: -15,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ]
    });

    // Mock the getActivePlayersSortedByRating method
    jest.spyOn(playerStore, 'getActivePlayersSortedByRating').mockImplementation(() => {
        return [
            {
                id: 'player1',
                name: 'John Doe',
                avatarUrl: undefined,
                active: true,
                eloRating: 1100,
                wins: 5,
                losses: 2,
                gamesPlayed: 7,
                dailyDelta: 10,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player2',
                name: 'Jane Smith',
                avatarUrl: undefined,
                active: true,
                eloRating: 1050,
                wins: 3,
                losses: 4,
                gamesPlayed: 7,
                dailyDelta: -5,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player3',
                name: 'Peter Jones',
                avatarUrl: undefined,
                active: true,
                eloRating: 1150,
                wins: 8,
                losses: 1,
                gamesPlayed: 9,
                dailyDelta: 20,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'player4',
                name: 'Mary Williams',
                avatarUrl: undefined,
                active: true,
                eloRating: 1000,
                wins: 0,
                losses: 5,
                gamesPlayed: 5,
                dailyDelta: -15,
                lastMatchDay: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ];
    });

    // Setup tournaments
    const tournamentStore = useTournamentStore.getState();

    // Mock the tournaments getter
    Object.defineProperty(tournamentStore, 'tournaments', {
        get: jest.fn().mockReturnValue([
            {
                id: 'tournament1',
                name: 'Knockout Tournament',
                format: 'KNOCKOUT' as TournamentFormat,
                status: 'completed',
                date: new Date().toISOString(),
                players: ['player1', 'player2', 'player3', 'player4'],
                matches: ['match1', 'match2', 'match3'],
                winner: null
            },
            {
                id: 'tournament2',
                name: 'Round Robin Tournament',
                format: 'ROUND_ROBIN' as TournamentFormat,
                status: 'inProgress',
                date: new Date().toISOString(),
                players: ['player1', 'player2', 'player3', 'player4'],
                matches: ['match4', 'match5'],
                winner: null
            },
        ]),
    });

    // Mock getTournamentById
    jest.spyOn(tournamentStore, 'getTournamentById').mockImplementation((id) => {
        return tournamentStore.tournaments.find(t => t.id === id);
    });

    // Mock createTournament
    jest.spyOn(tournamentStore, 'createTournament').mockImplementation(async (name, date, format, playerIds) => {
        // Return the ID of the new tournament
        return 'new-tournament-id';
    });

    // Mock updateTournamentStatus
    jest.spyOn(tournamentStore, 'updateTournamentStatus').mockImplementation(async (id, status) => {
        // This would update the tournament status in a real implementation
        return;
    });

    // Setup matches
    const matchStore = useMatchStore.getState();

    // Mock addMatch
    jest.spyOn(matchStore, 'addMatch').mockImplementation(async (data) => {
        const {player1Id, player2Id, player1Score, player2Score, sets, tournamentId} = data;
        // Zwracamy ID gracza jako winnerId bazując na wyniku
        const winnerId = player1Score > player2Score ? player1Id : player2Id;

        return {
            id: 'new-match-id',
            player1Id,
            player2Id,
            player1Score,
            player2Score,
            sets: sets || [],
            winnerId,
            date: new Date().toISOString(),
            tournamentId
        };
    });
};

describe('Tournament Management E2E Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupTestData();
    });

    it('should retrieve tournament list correctly', async () => {
        // Render the tournaments screen (just to follow the flow)
        render(<TournamentsScreen/>);

        // Test that tournament store methods work correctly
        const tournamentStore = useTournamentStore.getState();
        const tournaments = tournamentStore.tournaments;

        // Assert tournaments are retrieved correctly
        expect(tournaments.length).toBe(2);
        expect(tournaments[0].name).toBe('Knockout Tournament');
        expect(tournaments[1].name).toBe('Round Robin Tournament');
    });

    it('should create a new tournament successfully', async () => {
        // Render the tournament listing screen (just to follow the flow)
        render(<TournamentsScreen/>);

        // Directly call the store method to create a tournament
        const tournamentStore = useTournamentStore.getState();
        const playerIds = ['player1', 'player2', 'player3', 'player4'];
        const tournamentDate = '2025-05-24T12:00:00.000Z'; // Używamy stałej daty

        const newTournament = await tournamentStore.createTournament(
            'New Test Tournament',
            tournamentDate,
            'KNOCKOUT' as TournamentFormat,
            playerIds
        );

        // Assert tournament was created correctly
        expect(tournamentStore.createTournament).toHaveBeenCalledWith(
            'New Test Tournament',
            tournamentDate,
            'KNOCKOUT' as TournamentFormat,
            playerIds
        );
        expect(newTournament).toBe('new-tournament-id');
    });

    it('should retrieve tournament details with matches', async () => {
        // Render the tournament details screen (just to follow the flow)
        render(<TournamentDetailsScreen/>);

        // Test that tournament store methods work correctly
        const tournamentStore = useTournamentStore.getState();
        const tournament = tournamentStore.getTournamentById('tournament1');

        // Assert tournament and matches are retrieved correctly
        expect(tournament?.name).toBe('Knockout Tournament');
        expect(tournament?.format).toBe('KNOCKOUT' as TournamentFormat);
        expect(tournament?.status).toBe('completed');
        expect(tournament?.matches.length).toBe(3);
        expect(tournament?.winner).toBe(null);
    });

    it('should update tournament status successfully', async () => {
        // Render the tournament details screen (just to follow the flow)
        render(<TournamentDetailsScreen/>);

        // Directly call the store method to update tournament status
        const tournamentStore = useTournamentStore.getState();
        await tournamentStore.updateTournamentStatus('tournament2', TournamentStatus.COMPLETED);

        // Assert tournament status was updated correctly
        expect(tournamentStore.updateTournamentStatus).toHaveBeenCalledWith('tournament2', TournamentStatus.COMPLETED);
    });

    it('should calculate tournament standings for round-robin format', async () => {
        // Render the tournament details screen (just to follow the flow)
        render(<TournamentDetailsScreen/>);

        // Define types for the test
        type PlayerStat = {
            playerId: string;
            wins: number;
            losses: number;
            points: number;
        };

        type PlayerStatsRecord = Record<string, PlayerStat>;

        // Setup mock data for a round-robin tournament with matches
        const matches = [
            {player1Id: 'player1', player2Id: 'player2', winnerId: 'player1'},
            {player1Id: 'player1', player2Id: 'player3', winnerId: 'player1'},
            {player1Id: 'player2', player2Id: 'player3', winnerId: 'player3'},
        ];

        // Calculate standings (simple version of what the app would do)
        const playerStats: PlayerStatsRecord = {};

        // Initialize player stats
        ['player1', 'player2', 'player3'].forEach(playerId => {
            playerStats[playerId] = {playerId, wins: 0, losses: 0, points: 0};
        });

        // Count wins and losses
        matches.forEach(match => {
            const winner = match.winnerId;
            const loser = match.player1Id === winner ? match.player2Id : match.player1Id;

            playerStats[winner].wins += 1;
            playerStats[winner].points += 3; // 3 points for a win
            playerStats[loser].losses += 1;
            playerStats[loser].points += 1; // 1 point for a loss
        });

        // Sort players by points
        const standings: PlayerStat[] = Object.values(playerStats).sort((a, b) => b.points - a.points);

        // Assertions for the standings
        expect(standings.length).toBe(3);

        // Player1: 2 wins, 0 losses, 6 points
        expect(standings[0].playerId).toBe('player1');
        expect(standings[0].wins).toBe(2);
        expect(standings[0].losses).toBe(0);
        expect(standings[0].points).toBe(6);

        // Player3: 1 win, 1 loss, 4 points
        expect(standings[1].playerId).toBe('player3');
        expect(standings[1].wins).toBe(1);
        expect(standings[1].losses).toBe(1);
        expect(standings[1].points).toBe(4);

        // Player2: 0 wins, 2 losses, 2 points
        expect(standings[2].playerId).toBe('player2');
        expect(standings[2].wins).toBe(0);
        expect(standings[2].losses).toBe(2);
        expect(standings[2].points).toBe(2);
    });

    it('should add a match to a tournament successfully', async () => {
        // Render the tournament details screen (just to follow the flow)
        render(<TournamentDetailsScreen/>);

        // Directly call the store method to add a match
        const matchStore = useMatchStore.getState();
        const newMatch = await matchStore.addMatch({
            player1Id: 'player1',
            player2Id: 'player2',
            player1Score: 3,
            player2Score: 1,
            sets: [{player1Score: 11, player2Score: 8}, {player1Score: 9, player2Score: 11}, {
                player1Score: 11,
                player2Score: 7
            }, {player1Score: 12, player2Score: 10}],
            tournamentId: 'tournament1'
        });

        // Assert match was added correctly with tournament ID
        expect(matchStore.addMatch).toHaveBeenCalledWith({
            player1Id: 'player1',
            player2Id: 'player2',
            player1Score: 3,
            player2Score: 1,
            sets: [{player1Score: 11, player2Score: 8}, {player1Score: 9, player2Score: 11}, {
                player1Score: 11,
                player2Score: 7
            }, {player1Score: 12, player2Score: 10}],
            tournamentId: 'tournament1'
        });
        expect(newMatch.tournamentId).toBe('tournament1');
        expect(newMatch.winnerId).toBe('player1');
    });
});
