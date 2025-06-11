import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MentionSuggestionsOverlay from './MentionSuggestionsOverlay';

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
jest.mock('./PlayerAvatar', () => {
  const { View, Text } = require('react-native');
  return jest.fn(({ source }) => <View testID="mock-player-avatar-mention"><Text>{source?.uri || 'default-avatar'}</Text></View>);
});


const mockSuggestions = [
  { id: 'user1', nickname: 'Alice', avatar_url: 'url_alice' },
  { id: 'user2', nickname: 'Bob', avatar_url: 'url_bob' },
];

describe('MentionSuggestionsOverlay', () => {
  const mockOnSelectSuggestion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isVisible is false', () => {
    const { container } = render(
      <MentionSuggestionsOverlay
        suggestions={mockSuggestions}
        onSelectSuggestion={mockOnSelectSuggestion}
        isVisible={false}
      />
    );
    // When null is returned, container.children.length should be 0 or check for specific elements not to be there.
    // Depending on how "renders nothing" is implemented (null vs styled View), this might need adjustment.
    // If it returns null, queryByText for any suggestion item should fail.
    expect(container.children.length).toBe(0);
  });

  it('renders nothing when suggestions array is empty, even if isVisible is true', () => {
    const { container } = render(
      <MentionSuggestionsOverlay
        suggestions={[]}
        onSelectSuggestion={mockOnSelectSuggestion}
        isVisible={true}
      />
    );
    expect(container.children.length).toBe(0);
  });

  it('renders suggestions correctly when isVisible is true and suggestions exist', () => {
    const { getByText, getAllByTestId } = render(
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
    const { getByText } = render(
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
    const { getByText } = render(
      <MentionSuggestionsOverlay
        suggestions={mockSuggestions}
        onSelectSuggestion={mockOnSelectSuggestion}
        isVisible={true}
      />
    );
    const aliceSuggestion = getByText('Alice').parent; // Get TouchableOpacity parent
    expect(aliceSuggestion.props.accessibilityLabel).toBe('Select mention Alice');
    expect(aliceSuggestion.props.accessibilityRole).toBe('button');
  });

});
