import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import MatchCard from '@/components/MatchCard';
import {Match} from '@/backend/types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('@/components/PlayerAvatar', () => 'PlayerAvatar');

const mockPlayer1 = {
    id: 'player1',
    name: 'John Doe',
    avatarUrl: 'https://example.com/avatar1.jpg',
    eloRating: 1500,
};

const mockPlayer2 = {
    id: 'player2',
    name: 'Jane Smith',
    avatarUrl: 'https://example.com/avatar2.jpg',
    eloRating: 1400,
};

jest.mock('@/store/playerStore', () => ({
    usePlayerStore: () => ({
        getPlayerById: (id: string) => {
            if (id === 'player1') return mockPlayer1;
            if (id === 'player2') return mockPlayer2;
            return null;
        },
    }),
}));

jest.mock('@/utils/formatters', () => ({
    formatDate: () => 'May 15, 2023',
}));

describe('MatchCard', () => {
    const mockMatch: Match = {
        id: 'match1',
        player1Id: 'player1',
        player2Id: 'player2',
        player1Score: 3,
        player2Score: 2,
        winner: 'player1',
        date: '2023-05-15T14:30:00Z',
        sets: [],
        winnerId: ''
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly with player 1 as winner', () => {
        render(<MatchCard match={mockMatch}/>);
        expect(screen.getByText('John Doe')).toBeTruthy();
        expect(screen.getByText('Jane Smith')).toBeTruthy();
        expect(screen.getByText('3 - 2')).toBeTruthy();
        expect(screen.getByText('May 15, 2023')).toBeTruthy();
    });

    it('renders correctly with player 2 as winner', () => {
        const player2WinMatch = {
            ...mockMatch,
            player1Score: 2,
            player2Score: 3,
            winner: 'player2',
        };

        render(<MatchCard match={player2WinMatch}/>);
        expect(screen.getByText('John Doe')).toBeTruthy();
        expect(screen.getByText('Jane Smith')).toBeTruthy();
        expect(screen.getByText('2 - 3')).toBeTruthy();
    });

    it('navigates to match details when pressed', () => {
        render(<MatchCard match={mockMatch}/>);
        const pressable = screen.getByText('3 - 2').parent?.parent;
        fireEvent.press(pressable!);
        expect(mockPush).toHaveBeenCalledWith('/match/match1');
    });

    it('calls custom onPress function when provided', () => {
        const onPressMock = jest.fn();
        render(<MatchCard match={mockMatch} onPress={onPressMock}/>);
        const pressable = screen.getByText('3 - 2').parent?.parent;
        fireEvent.press(pressable!);
        expect(onPressMock).toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('returns null if player data is not found', () => {
        const invalidMatch: Match = {
            ...mockMatch,
            player1Id: 'nonexistent',
        };
        const {toJSON} = render(<MatchCard match={invalidMatch}/>);
        expect(toJSON()).toBeNull();
    });
});
