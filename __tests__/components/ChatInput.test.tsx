import React, {ComponentProps} from 'react';
import {fireEvent, render, RenderAPI, waitFor} from '@testing-library/react-native';
import {ChatInput} from '@/components/ChatInput';

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
    let mockOnChangeText: jest.Mock;
    let mockOnSendMessage: jest.Mock;
    let mockOnMentionQueryChange: jest.Mock;

    const renderComponent = (props: Partial<ComponentProps<typeof ChatInput>>): RenderAPI => {
        return render(
            <ChatInput
                value=""
                onChangeText={mockOnChangeText}
                onSendMessage={mockOnSendMessage}
                onMentionQueryChange={mockOnMentionQueryChange}
                isLoading={false}
                {...props}
            />
        );
    };

    beforeEach(() => {
        mockOnChangeText = jest.fn();
        mockOnSendMessage = jest.fn();
        mockOnMentionQueryChange = jest.fn();
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const {getByPlaceholderText, getByLabelText} = renderComponent({});
        expect(getByPlaceholderText('Send message...')).toBeTruthy();
        const sendButton = getByLabelText('Send message');
        expect(sendButton.props.accessibilityState.disabled).toBe(true);
    });

    it('shows send button when there is text', () => {
        const {getByLabelText} = renderComponent({value: 'Hello'});
        const sendButton = getByLabelText('Send message');
        expect(sendButton.props.accessibilityState.disabled).toBe(false);
    });

    it('handles text input changes and calls onChangeText', () => {
        const {getByPlaceholderText} = renderComponent({});
        const input = getByPlaceholderText('Send message...');
        fireEvent.changeText(input, 'Hello');
        expect(mockOnChangeText).toHaveBeenCalledWith('Hello');
    });

    it('calls onSendMessage when send button is pressed with non-empty message', async () => {
        const {getByLabelText} = renderComponent({value: 'Test message'});
        fireEvent.press(getByLabelText('Send message'));

        await waitFor(() => {
            expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
        });

        await waitFor(() => {
            expect(mockOnChangeText).toHaveBeenCalledWith('');
        });
    });

    it('does not call onSendMessage when message is empty or only whitespace', () => {
        const {getByLabelText} = renderComponent({value: ' '});
        const sendButton = getByLabelText('Send message');
        expect(sendButton.props.accessibilityState.disabled).toBe(true);
        fireEvent.press(sendButton);
        expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('send button is disabled when message is empty', () => {
        const {getByLabelText} = renderComponent({value: ''});
        const sendButton = getByLabelText('Send message');
        expect(sendButton.props.accessibilityState.disabled).toBe(true);
    });

    it('calls onMentionQueryChange when typing @mention', () => {
        const {getByPlaceholderText} = renderComponent({});
        const input = getByPlaceholderText('Send message...');

        fireEvent.changeText(input, '@test');
        expect(mockOnMentionQueryChange).toHaveBeenLastCalledWith('test');

        fireEvent.changeText(input, '@');
        expect(mockOnMentionQueryChange).toHaveBeenLastCalledWith('');

        fireEvent.changeText(input, 'Hello world');
        expect(mockOnMentionQueryChange).toHaveBeenLastCalledWith('');
    });

    it('is not editable and send button is disabled when isLoading is true', () => {
        const {getByPlaceholderText, getByLabelText} = renderComponent({
            value: 'some message',
            isLoading: true
        });
        const input = getByPlaceholderText('Loading...');
        expect(input.props.editable).toBe(false);

        const sendButton = getByLabelText('Send message');
        fireEvent.press(sendButton);
        expect(mockOnSendMessage).not.toHaveBeenCalled();
    });
});
