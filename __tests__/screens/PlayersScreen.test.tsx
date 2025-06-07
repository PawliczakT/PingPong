import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import PlayersScreen from '@/app/(tabs)/players';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('@/components/PlayerCard', () => 'PlayerCard');
jest.mock('@/components/EmptyState', () => 'EmptyState');
jest.mock('@/components/Button', () => 'Button');
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: 'SafeAreaView',
}));

jest.mock('lucide-react-native', () => ({
    Plus: 'Plus',
    Search: 'Search',
    Users: 'Users',
    X: 'X',
}));

let mockPlayers = [
    {id: '1', name: 'John Doe', nickname: 'Johnny', eloRating: 1500, wins: 10, losses: 5, active: true},
    {id: '2', name: 'Jane Smith', eloRating: 1450, wins: 8, losses: 6, active: true},
    {id: '3', name: 'Bob Johnson', nickname: 'Bobby', eloRating: 1400, wins: 6, losses: 7, active: true},
    {id: '4', name: 'Inactive Player', eloRating: 1300, wins: 2, losses: 8, active: false},
];

jest.mock('@/store/playerStore', () => ({
    usePlayerStore: () => ({
        players: mockPlayers,
    }),
}));

describe('PlayersScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the list of active players', () => {
        const {UNSAFE_getAllByType} = render(<PlayersScreen/>);
        const playerCards = UNSAFE_getAllByType('PlayerCard');
        expect(playerCards.length).toBe(3); // 3 active players
        expect(playerCards[0].props.player.id).toBe('1'); // Highest ELO
        expect(playerCards[1].props.player.id).toBe('2');
        expect(playerCards[2].props.player.id).toBe('3'); // Lowest ELO
    });

    it('displays EmptyState when there are no active players', () => {
        const originalPlayers = [...mockPlayers];
        mockPlayers = [{id: '4', name: 'Inactive Player', eloRating: 1300, wins: 2, losses: 8, active: false}];
        const {UNSAFE_getAllByType} = render(<PlayersScreen/>);
        const emptyState = UNSAFE_getAllByType('EmptyState');
        expect(emptyState.length).toBe(1);
        mockPlayers = originalPlayers;
    });

    it('filters players based on search query', () => {
        const {getByPlaceholderText, UNSAFE_getAllByType} = render(<PlayersScreen/>);
        const searchInput = getByPlaceholderText('Search players...');
        fireEvent.changeText(searchInput, 'Jane');
        const playerCards = UNSAFE_getAllByType('PlayerCard');
        expect(playerCards.length).toBe(1);
        expect(playerCards[0].props.player.name).toBe('Jane Smith');
        fireEvent.changeText(searchInput, 'Johnny');
        const playerCardsAfterNicknameSearch = UNSAFE_getAllByType('PlayerCard');
        expect(playerCardsAfterNicknameSearch.length).toBe(1);
        expect(playerCardsAfterNicknameSearch[0].props.player.nickname).toBe('Johnny');
    });

    it('displays "No players found" when search has no results', () => {
        const {getByPlaceholderText, getByText} = render(<PlayersScreen/>);
        const searchInput = getByPlaceholderText('Search players...');
        fireEvent.changeText(searchInput, 'xyz');
        expect(getByText('No players found')).toBeTruthy();
    });

    it('clears search query when X button is pressed', () => {
        const {getByPlaceholderText, UNSAFE_getAllByType} = render(<PlayersScreen/>);
        const searchInput = getByPlaceholderText('Search players...');
        fireEvent.changeText(searchInput, 'Jane');
        let playerCards = UNSAFE_getAllByType('PlayerCard');
        expect(playerCards.length).toBe(1);
        const xButton = screen.UNSAFE_getByType('X').parent;
        fireEvent.press(xButton);
        playerCards = UNSAFE_getAllByType('PlayerCard');
        expect(playerCards.length).toBe(3);
        expect(searchInput.props.value).toBe('');
    });
});
