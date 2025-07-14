import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import HomeScreen from '@/app/(tabs)/index';

const mockTournaments = [
    {
        id: '1',
        name: 'Tournament 1',
        date: '2025-06-01',
        status: 'pending',
        participants: ['1', '2'],
        matches: [],
        format: 'KNOCKOUT'
    },
];
jest.mock('@/hooks/useTournaments', () => ({
    useTournaments: () => ({
        data: mockTournaments,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    }),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({push: mockPush}),
}));
const mockPlayerState = {getActivePlayersSortedByRating: () => []};
const mockMatchState = {getRecentMatches: () => []};
const mockNetworkState = {checkNetworkStatus: jest.fn().mockResolvedValue(true), syncPendingMatches: jest.fn()};
const mockNotificationState = {
    registerForPushNotifications: jest.fn().mockResolvedValue('mock-push-token'),
    notificationHistory: []
};
jest.mock('@/store/playerStore', () => ({usePlayerStore: (selector: any) => selector(mockPlayerState)}));
jest.mock('@/store/matchStore', () => ({useMatchStore: (selector: any) => selector(mockMatchState)}));
jest.mock('@/store/networkStore', () => ({useNetworkStore: (selector: any) => selector(mockNetworkState)}));
jest.mock('@/store/notificationStore', () => ({useNotificationStore: (selector: any) => selector(mockNotificationState)}));
jest.mock('@/components/PlayerCard', () => 'PlayerCard');
jest.mock('@/components/MatchCard', () => 'MatchCard');
jest.mock('@/components/TournamentCard', () => 'TournamentCard');
jest.mock('@/components/Button', () => {
    const {TouchableOpacity, Text} = require('react-native');
    return (props: any) => <TouchableOpacity testID={props.testID}
                                             onPress={props.onPress}><Text>{props.title}</Text></TouchableOpacity>;
});
jest.mock('@/components/EmptyState', () => 'EmptyState');
jest.mock('@/components/NetworkStatusBar', () => 'NetworkStatusBar');
jest.mock('react-native-safe-area-context', () => ({SafeAreaView: ({children}: any) => <>{children}</>}));
jest.mock('lucide-react-native', () => ({Bell: 'Bell', PlusCircle: 'PlusCircle', Trophy: 'Trophy', Users: 'Users'}));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

const renderWithProviders = (component: React.ReactElement) => {
    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    );
};


describe('HomeScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        queryClient.clear();
    });

    it('renders correctly with data', () => {
        renderWithProviders(<HomeScreen/>);

        expect(screen.getByText(/PingPong StatKeeper/)).toBeTruthy();
        expect(screen.getByText('Top Players')).toBeTruthy();
        expect(screen.getByText('Upcoming Tournaments')).toBeTruthy();
    });

    it('navigates to notifications when notification bell is pressed', () => {
        renderWithProviders(<HomeScreen/>);
        fireEvent.press(screen.getByTestId('notification-bell-button'));
        expect(mockPush).toHaveBeenCalledWith('/notifications');
    });

    it('navigates to correct screens when quick actions are pressed', () => {
        renderWithProviders(<HomeScreen/>);
        fireEvent.press(screen.getByText('New Match'));
        expect(mockPush).toHaveBeenCalledWith('/add-match');

        fireEvent.press(screen.getByText('New Tournament'));
        expect(mockPush).toHaveBeenCalledWith('/tournament/create');
    });
});
