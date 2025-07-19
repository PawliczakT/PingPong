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
jest.mock('@/components/Button', () => {
    const realButton = jest.requireActual('@/components/Button');
    const {TouchableOpacity, Text} = require('react-native');

    return (props) => {
        const {children, title, testID, ...rest} = props;
        return (
            <TouchableOpacity testID={testID} {...rest}>
                <Text>{title}</Text>
                {children}
            </TouchableOpacity>
        );
    };
});
jest.mock('@/components/EmptyState', () => 'EmptyState');
jest.mock('@/components/NetworkStatusBar', () => 'NetworkStatusBar');
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({children}: { children: React.ReactNode }) => <>{children}</>,
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
];
const mockTournaments = [
    {
        id: '1',
        name: 'Tournament 1',
        startDate: '2023-06-01T10:00:00Z',
        status: 'upcoming',
        participants: ['1', '2', '3']
    },
];
const mockNotifications = [
    {
        id: '1',
        title: 'New Match',
        body: 'A new match has been recorded',
        read: false,
        timestamp: '2023-05-15T14:30:00Z'
    },
];

const mockPlayerState = {getActivePlayersSortedByRating: () => mockPlayers};
const mockMatchState = {getRecentMatches: () => mockMatches};
const mockTournamentState = {
    getUpcomingTournaments: () => mockTournaments,
    getActiveTournaments: () => [],
};
const mockNetworkState = {
    checkNetworkStatus: jest.fn().mockResolvedValue(true),
    syncPendingMatches: jest.fn(),
};
const mockNotificationState = {
    registerForPushNotifications: jest.fn().mockResolvedValue('mock-push-token'),
    notificationHistory: mockNotifications,
};

jest.mock('@/store/playerStore', () => ({
    usePlayerStore: jest.fn().mockImplementation((selector) => selector(mockPlayerState)),
}));
jest.mock('@/store/matchStore', () => ({
    useMatchStore: jest.fn().mockImplementation((selector) => selector(mockMatchState)),
}));
jest.mock('@/tournaments/TournamentStore', () => ({
    useTournamentStore: jest.fn().mockImplementation((selector) => selector(mockTournamentState)),
}));
jest.mock('@/store/networkStore', () => ({
    useNetworkStore: jest.fn().mockImplementation((selector) => selector(mockNetworkState)),
}));
jest.mock('@/store/notificationStore', () => ({
    useNotificationStore: jest.fn().mockImplementation((selector) => selector(mockNotificationState)),
}));

describe('HomeScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly with data', () => {
        render(<HomeScreen/>);
        expect(screen.getByText(/PingPong StatKeeper/)).toBeTruthy();
        expect(screen.getByText('Top Players')).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy();
    });

    it('navigates to notifications when notification bell is pressed', () => {
        render(<HomeScreen/>);
        fireEvent.press(screen.getByTestId('notification-bell-button'));
        expect(mockPush).toHaveBeenCalledWith('/notifications');
    });

    it('navigates to correct screens when quick actions are pressed', () => {
        render(<HomeScreen/>);
        fireEvent.press(screen.getAllByText('New Match')[0]);
        expect(mockPush).toHaveBeenCalledWith('/add-match');
        fireEvent.press(screen.getAllByText('New Tournament')[0]);
        expect(mockPush).toHaveBeenCalledWith('/tournament/create');
    });

    it('navigates to correct screens when View All buttons are pressed', () => {
        render(<HomeScreen/>);
        fireEvent.press(screen.getByTestId('view-all-players-button'));
        expect(mockPush).toHaveBeenCalledWith('/players');
        fireEvent.press(screen.getByTestId('view-all-matches-button'));
        expect(mockPush).toHaveBeenCalledWith('/matches');
        fireEvent.press(screen.getByTestId('view-all-tournaments-button'));
        expect(mockPush).toHaveBeenCalledWith('/tournaments');
    });
});
