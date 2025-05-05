import React from 'react';
import {render} from '@testing-library/react-native';
import HeadToHeadStats from '@/components/HeadToHeadStats';
import {HeadToHead} from '@/types';

jest.mock('@/components/PlayerAvatar', () => 'PlayerAvatar');

jest.mock('@/constants/colors', () => ({
    colors: {
        card: '#FFFFFF',
        text: '#000000',
        textLight: '#8E8E93',
        background: '#F2F2F7',
        primary: '#007AFF',
        secondary: '#FF9500',
        error: '#FF3B30',
    },
}));

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

describe('HeadToHeadStats', () => {
    const basicHeadToHead: HeadToHead = {
        player1Id: 'player1',
        player2Id: 'player2',
        player1Wins: 3,
        player2Wins: 2,
        matches: [],
    };

    const detailedHeadToHead: HeadToHead = {
        ...basicHeadToHead,
        player1Sets: 10,
        player2Sets: 8,
        player1Points: 150,
        player2Points: 130,
        averagePointsPerMatch: {
            player1: 30,
            player2: 26,
        },
    };

    it('renders basic head-to-head stats correctly', () => {
        const {toJSON, getByText} = render(<HeadToHeadStats headToHead={basicHeadToHead}/>);
        expect(toJSON()).toBeTruthy();
        expect(getByText('John Doe')).toBeTruthy();
        expect(getByText('Jane Smith')).toBeTruthy();
        expect(getByText('3')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
        expect(getByText('Matches Won')).toBeTruthy();
        expect(getByText('60% - 40%')).toBeTruthy();
        expect(getByText('5 matches played')).toBeTruthy();
    });

    it('renders detailed head-to-head stats correctly', () => {
        const {getByText} = render(<HeadToHeadStats headToHead={detailedHeadToHead}/>);
        expect(getByText('10')).toBeTruthy();
        expect(getByText('8')).toBeTruthy();
        expect(getByText('Sets Won')).toBeTruthy();
        expect(getByText('150')).toBeTruthy();
        expect(getByText('130')).toBeTruthy();
        expect(getByText('Total Points')).toBeTruthy();
        expect(getByText('30.0')).toBeTruthy();
        expect(getByText('26.0')).toBeTruthy();
        expect(getByText('Avg Points/Match')).toBeTruthy();
    });

    it('renders error message when player data is not found', () => {
        const invalidHeadToHead: HeadToHead = {
            player1Id: 'nonexistent1',
            player2Id: 'nonexistent2',
            player1Wins: 0,
            player2Wins: 0,
            matches: [],
        };
        const {getByText} = render(<HeadToHeadStats headToHead={invalidHeadToHead}/>);
        expect(getByText('Player data not found')).toBeTruthy();
    });

    it('handles singular match text correctly', () => {
        const singleMatchHeadToHead: HeadToHead = {
            ...basicHeadToHead,
            player1Wins: 1,
            player2Wins: 0,
        };
        const {getByText} = render(<HeadToHeadStats headToHead={singleMatchHeadToHead}/>);
        expect(getByText('1 match played')).toBeTruthy();
    });

    it('handles zero matches correctly', () => {
        const zeroMatchesHeadToHead: HeadToHead = {
            ...basicHeadToHead,
            player1Wins: 0,
            player2Wins: 0,
        };
        const {getByText} = render(<HeadToHeadStats headToHead={zeroMatchesHeadToHead}/>);
        expect(getByText('0% - 0%')).toBeTruthy();
        expect(getByText('0 matches played')).toBeTruthy();
    });
});
