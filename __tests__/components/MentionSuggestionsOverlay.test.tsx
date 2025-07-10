import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import MentionSuggestionsOverlay from '../../components/MentionSuggestionsOverlay';

// Mock useTheme
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useTheme: () => ({
        colors: {
            card: '#fff',
            border: '#ccc',
            text: '#000',
        },
    }),
}));

// Mock PlayerAvatar
jest.mock('../../components/PlayerAvatar', () => {
    const {View, Text} = require('react-native');
    return jest.fn(({source}) => <View
        testID="mock-player-avatar-mention"><Text>{source?.uri || 'default-avatar'}</Text></View>);
});


const mockSuggestions = [
    {id: 'user1', nickname: 'Alice', avatar_url: 'url_alice'},
    {id: 'user2', nickname: 'Bob', avatar_url: 'url_bob'},
];

describe('MentionSuggestionsOverlay', () => {
    const mockOnSelectSuggestion = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing when isVisible is false', () => {
        const {queryByText} = render(
            <MentionSuggestionsOverlay
                suggestions={mockSuggestions}
                onSelectSuggestion={mockOnSelectSuggestion}
                isVisible={false}
            />,
        );
        expect(queryByText('Alice')).toBeNull();
    });

    it('renders nothing when suggestions array is empty, even if isVisible is true', () => {
        const {queryByText} = render(
            <MentionSuggestionsOverlay
                suggestions={[]}
                onSelectSuggestion={mockOnSelectSuggestion}
                isVisible={true}
            />,
        );
        expect(queryByText('Alice')).toBeNull();
    });

    it('renders suggestions correctly when isVisible is true and suggestions exist', () => {
        const {getByText, getAllByTestId} = render(
            <MentionSuggestionsOverlay
                suggestions={mockSuggestions}
                onSelectSuggestion={mockOnSelectSuggestion}
                isVisible={true}
            />
        );

        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('Bob')).toBeTruthy();
        expect(getAllByTestId('mock-player-avatar-mention').length).toBe(2);
    });

    it('calls onSelectSuggestion with the correct nickname when a suggestion is pressed', () => {
        const {getByText} = render(
            <MentionSuggestionsOverlay
                suggestions={mockSuggestions}
                onSelectSuggestion={mockOnSelectSuggestion}
                isVisible={true}
            />
        );

        fireEvent.press(getByText('Alice'));
        expect(mockOnSelectSuggestion).toHaveBeenCalledWith('Alice');

        fireEvent.press(getByText('Bob'));
        expect(mockOnSelectSuggestion).toHaveBeenCalledWith('Bob');
    });

    it('renders items with accessibility props', () => {
        const {getByRole} = render(
            <MentionSuggestionsOverlay
                suggestions={mockSuggestions}
                onSelectSuggestion={mockOnSelectSuggestion}
                isVisible={true}
            />,
        );
        const aliceSuggestion = getByRole('button', {name: 'Select mention Alice'});
        expect(aliceSuggestion).toBeTruthy();
    });

});
