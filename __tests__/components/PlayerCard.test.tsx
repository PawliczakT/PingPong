import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react-native';
import PlayerCard from '@/components/PlayerCard';
import {Player} from '@/backend/types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('@/components/PlayerAvatar', () => 'PlayerAvatar');

jest.mock('@/utils/formatters', () => ({
    formatWinRate: (wins: number, losses: number) => `${Math.round((wins / (wins + losses)) * 100)}%`,
}));

const mockGetPlayerTournamentWins = jest.fn(() => 5);
jest.mock('@/store/tournamentStore', () => ({
    useTournamentStore: jest.fn((selector) => selector({getPlayerTournamentWins: mockGetPlayerTournamentWins})),
}));

describe('PlayerCard', () => {
    const mockPlayer: Player = {
        id: 'player1',
        name: 'John Doe',
        nickname: 'Johnny',
        avatarUrl: 'https://example.com/avatar1.jpg',
        eloRating: 1500,
        wins: 10,
        losses: 5,
        active: true,
        createdAt: '',
        updatedAt: '',
        gamesPlayed: 0,
        dailyDelta: 0,
        lastMatchDay: ''
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders player information correctly', () => {
        const {getByText, getByTestId} = render(<PlayerCard player={mockPlayer}/>);
        expect(getByText('John Doe')).toBeTruthy();
        expect(getByText('"Johnny"')).toBeTruthy();
        expect(getByText('1500')).toBeTruthy();
        expect(within(getByTestId('player-card-wins')).getByText('10')).toBeTruthy();
        expect(within(getByTestId('player-card-losses')).getByText('5')).toBeTruthy();
        expect(within(getByTestId('player-card-winrate')).getByText('67%')).toBeTruthy();
        expect(within(getByTestId('player-card-tournaments')).getByText('5')).toBeTruthy();
        expect(getByText('ELO')).toBeTruthy();
        expect(getByText('Wins')).toBeTruthy();
        expect(getByText('Losses')).toBeTruthy();
        expect(getByText('Win Rate')).toBeTruthy();
    });

    it('renders rank when provided', () => {
        render(<PlayerCard player={mockPlayer} rank={1}/>);
        expect(screen.getByText('1')).toBeTruthy();
    });

    it('does not render stats when showStats is false', () => {
        render(<PlayerCard player={mockPlayer} showStats={false}/>);
        expect(screen.queryByText('ELO')).toBeNull();
        expect(screen.queryByText('Wins')).toBeNull();
        expect(screen.queryByText('Losses')).toBeNull();
        expect(screen.queryByText('Win Rate')).toBeNull();
    });

    it('renders custom stat when provided', () => {
        render(<PlayerCard player={mockPlayer} statValue="85%" statLabel="Custom Stat"/>);
        expect(screen.getByText('85%')).toBeTruthy();
        expect(screen.getByText('Custom Stat')).toBeTruthy();
        expect(screen.queryByText('ELO')).toBeNull();
        expect(screen.queryByText('Wins')).toBeNull();
    });

    it('navigates to player details when pressed', () => {
        render(<PlayerCard player={mockPlayer}/>);
        const pressable = screen.getByText('John Doe').parent?.parent;
        fireEvent.press(pressable!);
        expect(mockPush).toHaveBeenCalledWith('/player/player1');
    });

    it('calls custom onPress function when provided', () => {
        const onPressMock = jest.fn();
        render(<PlayerCard player={mockPlayer} onPress={onPressMock}/>);
        const pressable = screen.getByText('John Doe').parent?.parent;
        fireEvent.press(pressable!);
        expect(onPressMock).toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('handles player without nickname', () => {
        const playerWithoutNickname = {...mockPlayer, nickname: undefined};
        render(<PlayerCard player={playerWithoutNickname}/>);
        expect(screen.queryByText('"Johnny"')).toBeNull();
    });
});
