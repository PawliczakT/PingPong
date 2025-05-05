import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import TournamentCard from '@/components/TournamentCard';
import {Tournament, TournamentFormat, TournamentStatus} from '@/types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('@/store/playerStore', () => ({
    usePlayerStore: () => ({
        getPlayerById: (id: string) => {
            if (id === 'player1') return {id: 'player1', name: 'John Doe'};
            if (id === 'player2') return {id: 'player2', name: 'Jane Smith'};
            return null;
        },
    }),
}));

jest.mock('@/utils/formatters', () => ({
    formatDate: () => 'May 15, 2023',
}));

jest.mock('lucide-react-native', () => ({
    ArrowRight: 'ArrowRight',
    Calendar: 'Calendar',
    Trophy: 'Trophy',
    Users: 'Users',
}));

describe('TournamentCard', () => {
    const mockUpcomingTournament: Tournament = {
        id: 'tournament1',
        name: 'Summer Tournament',
        date: '2023-05-15T14:30:00Z',
        status: TournamentStatus.UPCOMING,
        participants: ['player1', 'player2', 'player3'],
        matches: [],
        format: TournamentFormat.KNOCKOUT
    };

    const mockInProgressTournament: Tournament = {
        id: 'tournament2',
        name: 'Spring Tournament',
        date: '2023-04-10T10:00:00Z',
        status: TournamentStatus.IN_PROGRESS,
        participants: ['player1', 'player2'],
        matches: [],
        format: TournamentFormat.KNOCKOUT
    };

    const mockCompletedTournament: Tournament = {
        id: 'tournament3',
        name: 'Winter Tournament',
        date: '2023-01-20T09:00:00Z',
        status: TournamentStatus.COMPLETED,
        participants: ['player1', 'player2', 'player3', 'player4'],
        matches: [],
        winner: 'player1',
        format: TournamentFormat.KNOCKOUT
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders tournament information correctly', () => {
        render(<TournamentCard tournament={mockUpcomingTournament}/>);
        expect(screen.getByText('Summer Tournament')).toBeTruthy();
        expect(screen.getByText('Upcoming')).toBeTruthy();
        expect(screen.getByText('May 15, 2023')).toBeTruthy();
        expect(screen.getByText('3 players')).toBeTruthy();
    });

    it('displays winner when tournament is completed', () => {
        render(<TournamentCard tournament={mockCompletedTournament}/>);
        expect(screen.getByText('John Doe')).toBeTruthy();
    });

    it('navigates to tournament details when pressed', () => {
        render(<TournamentCard tournament={mockUpcomingTournament}/>);
        const pressable = screen.getByText('Summer Tournament').parent?.parent;
        fireEvent.press(pressable!);
        expect(mockPush).toHaveBeenCalledWith('/tournament/tournament1');
    });

    it('calls custom onPress function when provided', () => {
        const onPressMock = jest.fn();
        render(<TournamentCard tournament={mockUpcomingTournament} onPress={onPressMock}/>);
        const pressable = screen.getByText('Summer Tournament').parent?.parent;
        fireEvent.press(pressable!);
        expect(onPressMock).toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('displays correct status for in-progress tournament', () => {
        render(<TournamentCard tournament={mockInProgressTournament}/>);
        expect(screen.getByText('In Progress')).toBeTruthy();
    });

    it('displays correct status for completed tournament', () => {
        render(<TournamentCard tournament={mockCompletedTournament}/>);
        expect(screen.getByText('Completed')).toBeTruthy();
    });

    it('handles unknown tournament status gracefully', () => {
        const unknownStatusTournament = {
            ...mockUpcomingTournament,
            status: 'UNKNOWN' as TournamentStatus,
        };
        render(<TournamentCard tournament={unknownStatusTournament}/>);
        expect(screen.getByText('Summer Tournament')).toBeTruthy();
    });
});
