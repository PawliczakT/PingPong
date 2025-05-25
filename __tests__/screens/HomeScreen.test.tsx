import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('@/components/PlayerCard', () => 'PlayerCard');
jest.mock('@/components/MatchCard', () => 'MatchCard');
jest.mock('@/components/TournamentCard', () => 'TournamentCard');
jest.mock('@/components/Button', () => 'Button');
jest.mock('@/components/EmptyState', () => 'EmptyState');
jest.mock('@/components/NetworkStatusBar', () => 'NetworkStatusBar');
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: 'SafeAreaView',
}));

jest.mock('lucide-react-native', () => ({
    Bell: 'Bell',
    PlusCircle: 'PlusCircle',
    Trophy: 'Trophy',
    Users: 'Users',
}));

const mockPlayers = [
    {id: '1', name: 'Player 1', eloRating: 1500, wins: 10, losses: 5, active: true},
    {id: '2', name: 'Player 2', eloRating: 1450, wins: 8, losses: 6, active: true},
    {id: '3', name: 'Player 3', eloRating: 1400, wins: 6, losses: 7, active: true},
];

const mockMatches = [
    {
        id: '1',
        player1Id: '1',
        player2Id: '2',
        player1Score: 3,
        player2Score: 2,
        winner: '1',
        date: '2023-05-15T14:30:00Z',
        sets: []
    },
    {
        id: '2',
        player1Id: '2',
        player2Id: '3',
        player1Score: 3,
        player2Score: 1,
        winner: '2',
        date: '2023-05-14T10:00:00Z',
        sets: []
    },
    {
        id: '3',
        player1Id: '1',
        player2Id: '3',
        player1Score: 2,
        player2Score: 3,
        winner: '3',
        date: '2023-05-13T16:45:00Z',
        sets: []
    },
];

const mockTournaments = [
    {
        id: '1',
        name: 'Tournament 1',
        startDate: '2023-06-01T10:00:00Z',
        status: 'upcoming',
        participants: ['1', '2', '3']
    },
    {id: '2', name: 'Tournament 2', startDate: '2023-06-15T14:00:00Z', status: 'active', participants: ['1', '2']},
];

const mockNotifications = [
    {id: '1', title: 'New Match', message: 'A new match has been recorded', read: false, date: '2023-05-15T14:30:00Z'},
    {
        id: '2',
        title: 'Tournament Starting',
        message: 'Tournament 1 is starting soon',
        read: true,
        date: '2023-05-14T10:00:00Z'
    },
];

jest.mock('@/store/playerStore', () => ({
    usePlayerStore: () => ({
        getActivePlayersSortedByRating: () => mockPlayers,
    }),
}));

jest.mock('@/store/matchStore', () => ({
    useMatchStore: () => ({
        getRecentMatches: () => mockMatches,
    }),
}));

jest.mock('@/store/tournamentStore', () => ({
    useTournamentStore: () => ({
        getUpcomingTournaments: () => [mockTournaments[0]],
        getActiveTournaments: () => [mockTournaments[1]],
    }),
}));

jest.mock('@/store/networkStore', () => ({
    useNetworkStore: () => ({
        checkNetworkStatus: jest.fn().mockResolvedValue(true),
        syncPendingMatches: jest.fn(),
    }),
}));

jest.mock('@/store/notificationStore', () => ({
    useNotificationStore: () => ({
        registerForPushNotifications: jest.fn().mockResolvedValue(true),
        notificationHistory: mockNotifications,
    }),
}));

describe('HomeScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly with data', () => {
        render(<HomeScreen/>);
        expect(screen.getByText('Grey Zone PingPong StatKeeper')).toBeTruthy();
        expect(screen.getByText('Track your matches and rankings')).toBeTruthy();
        expect(screen.getByText('Top Players')).toBeTruthy();
        expect(screen.getByText('Recent Matches')).toBeTruthy();
        expect(screen.getByText('Upcoming Tournaments')).toBeTruthy();
        expect(screen.getByText('New Match')).toBeTruthy();
        expect(screen.getByText('New Tournament')).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy();
    });

    it('navigates to correct screens when quick actions are pressed', () => {
        render(<HomeScreen/>);
        fireEvent.press(screen.getByText('New Match'));
        expect(mockPush).toHaveBeenCalledWith('/add-match');
        fireEvent.press(screen.getByText('New Tournament'));
        expect(mockPush).toHaveBeenCalledWith('/tournament/create');
    });

    it('navigates to correct screens when View All buttons are pressed', () => {
        const {UNSAFE_getAllByType} = render(<HomeScreen/>);
        const buttons = UNSAFE_getAllByType('Button');
        fireEvent(buttons[0], 'press');
        expect(mockPush).toHaveBeenCalledWith('/players');
        fireEvent(buttons[1], 'press');
        expect(mockPush).toHaveBeenCalledWith('/matches');
        fireEvent(buttons[2], 'press');
        expect(mockPush).toHaveBeenCalledWith('/tournaments');
    });

    it('navigates to notifications when notification bell is pressed', () => {
        render(<HomeScreen/>);
        const notificationButton = screen.getByText('1').parent?.parent;
        fireEvent.press(notificationButton!);
        expect(mockPush).toHaveBeenCalledWith('/notifications');
    });

    it('renders PlayerCard components for top players', () => {
        const {UNSAFE_getAllByType} = render(<HomeScreen/>);
        const playerCards = UNSAFE_getAllByType('PlayerCard');
        expect(playerCards.length).toBe(3);
    });

    it('renders MatchCard components for recent matches', () => {
        const {UNSAFE_getAllByType} = render(<HomeScreen/>);
        const matchCards = UNSAFE_getAllByType('MatchCard');
        expect(matchCards.length).toBe(3);
    });

    it('renders TournamentCard components for upcoming tournaments', () => {
        const {UNSAFE_getAllByType} = render(<HomeScreen/>);
        const tournamentCards = UNSAFE_getAllByType('TournamentCard');
        expect(tournamentCards.length).toBe(2);
    });
});
