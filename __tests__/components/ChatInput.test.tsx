import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {ChatInput} from '../../components/ChatInput'; // Assuming ChatInput is in the same directory or correct path

// Mock useTheme
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useTheme: () => ({
    colors: {
      border: '#ccc',
      card: '#fff',
      background: '#f0f0f0',
      text: '#000',
      textMuted: '#888',
      primary: 'blue',
    },
  }),
}));

describe('ChatInput', () => {
  const mockOnSendMessage = jest.fn();
  const mockOnMentionQueryChange = jest.fn();
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByPlaceholderText, getByAccessibilityLabel } = render(
      <ChatInput
        value=""
        onChangeText={mockOnChangeText}
        onSendMessage={mockOnSendMessage}
        onMentionQueryChange={mockOnMentionQueryChange}
      />
    );

    expect(getByPlaceholderText('Type a message...')).toBeTruthy();
    expect(getByAccessibilityLabel('Send message')).toBeTruthy();
  });

  it('handles text input changes and calls onChangeText', () => {
    const { getByPlaceholderText } = render(
      <ChatInput
        value=""
        onChangeText={mockOnChangeText}
        onSendMessage={mockOnSendMessage}
        onMentionQueryChange={mockOnMentionQueryChange}
      />
    );
    const input = getByPlaceholderText('Type a message...');
    fireEvent.changeText(input, 'Hello');
    expect(mockOnChangeText).toHaveBeenCalledWith('Hello');
  });

  it('calls onSendMessage when send button is pressed with non-empty message', () => {
    const { getByAccessibilityLabel } = render(
      <ChatInput
        value="Test message" // Parent now controls value
        onChangeText={mockOnChangeText}
        onSendMessage={mockOnSendMessage}
        onMentionQueryChange={mockOnMentionQueryChange}
      />
    );
    fireEvent.press(getByAccessibilityLabel('Send message'));
    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    expect(mockOnChangeText).toHaveBeenCalledWith(''); // Expects parent to clear input via this callback
  });

  it('does not call onSendMessage when message is empty or only whitespace', () => {
    const { getByAccessibilityLabel } = render(
      <ChatInput
        value="   " // Parent controls value
        onChangeText={mockOnChangeText}
        onSendMessage={mockOnSendMessage}
        onMentionQueryChange={mockOnMentionQueryChange}
      />
    );
    fireEvent.press(getByAccessibilityLabel('Send message'));
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('send button is disabled when message is empty', () => {
    const { getByAccessibilityLabel } = render(
      <ChatInput
        value=""
        onChangeText={mockOnChangeText}
        onSendMessage={mockOnSendMessage}
        onMentionQueryChange={mockOnMentionQueryChange}
      />
    );
    // In react-native, 'disabled' prop makes TouchableOpacity not call onPress.
    // We test this by checking if onSendMessage is NOT called.
    // Direct check of 'disabled' prop on TouchableOpacity is not straightforward with RNTL.
    // We can check if the button is visually distinct if styles change, or its behavior.
    fireEvent.press(getByAccessibilityLabel('Send message'));
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('calls onMentionQueryChange when typing @mention', () => {
    const { getByPlaceholderText } = render(
      <ChatInput
        value=""
        onChangeText={mockOnChangeText}
        onSendMessage={mockOnSendMessage}
        onMentionQueryChange={mockOnMentionQueryChange}
      />
    );
    const input = getByPlaceholderText('Type a message...');

    // Simulate parent updating value for each character
    mockOnChangeText.mockImplementation((text) => {
        // In a real scenario, parent would re-render ChatInput with this new text as `value`
        // Here, we need to simulate the effect of this for handleTextChange inside ChatInput
    });

    fireEvent.changeText(input, 'Hello @test');
    // Because value is controlled by parent, this fireEvent only triggers the internal handleTextChange
    // The test for onMentionQueryChange needs to assert based on the logic within handleTextChange
    // which calls onMentionQueryChange directly.
    expect(mockOnMentionQueryChange).toHaveBeenCalledWith('test');

    fireEvent.changeText(input, 'Hello @');
    expect(mockOnMentionQueryChange).toHaveBeenCalledWith(null); // Clears if only @

    fireEvent.changeText(input, 'Hello world');
    expect(mockOnMentionQueryChange).toHaveBeenCalledWith(null); // Clears if no mention
  });

  it('is not editable and send button is disabled when isLoading is true', () => {
    const { getByPlaceholderText, getByAccessibilityLabel } = render(
      <ChatInput
        value="Some text"
        onChangeText={mockOnChangeText}
        onSendMessage={mockOnSendMessage}
        onMentionQueryChange={mockOnMentionQueryChange}
        isLoading={true}
      />
    );
    const input = getByPlaceholderText('Type a message...');
    expect(input.props.editable).toBe(false);

    fireEvent.press(getByAccessibilityLabel('Send message'));
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

});
