import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import StatsScreen from '@/app/(tabs)/stats';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('@/store/playerStore', () => ({
    usePlayerStore: () => ({
        getActivePlayersSortedByRating: () => [
            {
                id: '1',
                name: 'Player 1',
                avatarUrl: null,
                eloRating: 1500,
                wins: 10,
                losses: 5,
                stats: {winRate: 0.67, longestWinStreak: 3}
            },
            {
                id: '2',
                name: 'Player 2',
                avatarUrl: null,
                eloRating: 1450,
                wins: 8,
                losses: 6,
                stats: {winRate: 0.57, longestWinStreak: 2}
            },
            {
                id: '3',
                name: 'Player 3',
                avatarUrl: null,
                eloRating: 1400,
                wins: 6,
                losses: 7,
                stats: {winRate: 0.46, longestWinStreak: 1}
            },
        ],
    }),
}));

jest.mock('@/store/statsStore', () => ({
    useStatsStore: () => ({
        getTopWinners: () => [
            {
                id: '1',
                name: 'Player 1',
                avatarUrl: null,
                eloRating: 1500,
                wins: 10,
                losses: 5,
                stats: {winRate: 0.67, longestWinStreak: 3}
            },
            {
                id: '4',
                name: 'Player 4',
                avatarUrl: null,
                eloRating: 1350,
                wins: 9,
                losses: 8,
                stats: {winRate: 0.53, longestWinStreak: 2}
            },
        ],
        getTopWinRate: () => [
            {
                id: '5',
                name: 'Player 5',
                avatarUrl: null,
                eloRating: 1300,
                wins: 5,
                losses: 1,
                stats: {winRate: 0.83, longestWinStreak: 4}
            },
            {
                id: '1',
                name: 'Player 1',
                avatarUrl: null,
                eloRating: 1500,
                wins: 10,
                losses: 5,
                stats: {winRate: 0.67, longestWinStreak: 3}
            },
        ],
        getLongestWinStreaks: () => [
            {
                id: '5',
                name: 'Player 5',
                avatarUrl: null,
                eloRating: 1300,
                wins: 5,
                losses: 1,
                stats: {winRate: 0.83, longestWinStreak: 4}
            },
            {
                id: '1',
                name: 'Player 1',
                avatarUrl: null,
                eloRating: 1500,
                wins: 10,
                losses: 5,
                stats: {winRate: 0.67, longestWinStreak: 3}
            },
        ],
    }),
}));

jest.mock('@/components/PlayerCard', () => 'PlayerCard');
jest.mock('@/components/StreakDisplay', () => 'StreakDisplay');
jest.mock('@/components/Button', () => 'Button');
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: 'SafeAreaView',
}));

describe('StatsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        render(<StatsScreen/>);
        expect(screen.getByText('Statistics')).toBeTruthy();
        expect(screen.getByText('Current Rankings')).toBeTruthy();
        expect(screen.getByText('Top Winners (Most Wins)')).toBeTruthy();
        expect(screen.getByText('Best Win Rate (%)')).toBeTruthy();
        expect(screen.getByText('Longest Win Streaks')).toBeTruthy();
        expect(screen.getByText('Head-to-Head')).toBeTruthy();
        expect(screen.getByText('Player Stats')).toBeTruthy();
        expect(screen.getByText('Tournaments')).toBeTruthy();
        expect(screen.getByText('Achievements')).toBeTruthy();
    });

    it('navigates to the correct screen when a stats card is pressed', () => {
        render(<StatsScreen/>);
        fireEvent.press(screen.getByText('Head-to-Head'));
        expect(mockPush).toHaveBeenCalledWith('/stats/head-to-head');
        fireEvent.press(screen.getByText('Player Stats'));
        expect(mockPush).toHaveBeenCalledWith('/players');
        fireEvent.press(screen.getByText('Tournaments'));
        expect(mockPush).toHaveBeenCalledWith('/tournaments');
        fireEvent.press(screen.getByText('Achievements'));
        expect(mockPush).toHaveBeenCalledWith('/achievements');
    });
});
