import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import MessageReactions, {ReactionsData} from '../../components/MessageReactions';

// Mock useTheme
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useTheme: () => ({
        colors: {
            border: '#ccc',
            text: '#000',
            primary: 'blue', // For potential future use (e.g., highlighting user's reaction)
        },
    }),
}));

describe('MessageReactions', () => {
    const mockOnToggleReaction = jest.fn();
    const messageId = 'msg1';

    const reactionsData: ReactionsData = {
        '👍': ['user1', 'user2'],
        '❤️': ['user3'],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing if reactions object is null, undefined, or empty', () => {
        const {queryByTestId, rerender} = render(
            <MessageReactions reactions={null} messageId={messageId} onToggleReaction={mockOnToggleReaction}/>
        );
        // queryByTestId is not ideal for multiple items, better to check for absence of specific text
        expect(queryByTestId(/reaction-chip/i)).toBeNull(); // Assuming chips have a testID pattern or check content

        rerender(<MessageReactions reactions={undefined} messageId={messageId}
                                   onToggleReaction={mockOnToggleReaction}/>);
        expect(queryByTestId(/reaction-chip/i)).toBeNull();

        rerender(<MessageReactions reactions={{}} messageId={messageId} onToggleReaction={mockOnToggleReaction}/>);
        expect(queryByTestId(/reaction-chip/i)).toBeNull();
    });

    it('renders reaction chips with counts correctly', () => {
        const {getByText, getAllByRole} = render(
            <MessageReactions reactions={reactionsData} messageId={messageId} onToggleReaction={mockOnToggleReaction}/>
        );

        expect(getByText('👍')).toBeTruthy();
        expect(getByText('2')).toBeTruthy(); // Count for 👍
        expect(getByText('❤️')).toBeTruthy();
        expect(getByText('1')).toBeTruthy(); // Count for ❤️

        const reactionButtons = getAllByRole('button'); // Based on accessibilityRole="button"
        expect(reactionButtons.length).toBe(2);
    });

    it('calls onToggleReaction with correct emoji when a chip is pressed', () => {
        const {getByText} = render(
            <MessageReactions reactions={reactionsData} messageId={messageId} onToggleReaction={mockOnToggleReaction}/>
        );

        // Accessibility label was `Reaction ${emoji}, count ${count}. Press to toggle.`
        // We can find by text content of the emoji itself if it's unique enough or use testID if added to TouchableOpacity
        fireEvent.press(getByText('👍').parent); // Press the TouchableOpacity containing the emoji text
        expect(mockOnToggleReaction).toHaveBeenCalledWith('👍');

        fireEvent.press(getByText('❤️').parent);
        expect(mockOnToggleReaction).toHaveBeenCalledWith('❤️');
    });

    it('does not render chip if reaction count is zero (after filtering)', () => {
        const reactionsWithZero: ReactionsData = {
            '👍': ['user1'],
            '😂': [], // This should not be rendered
        };
        const {queryByText} = render(
            <MessageReactions reactions={reactionsWithZero} messageId={messageId}
                              onToggleReaction={mockOnToggleReaction}/>
        );
        expect(queryByText('😂')).toBeNull();
        expect(queryByText('👍')).toBeTruthy();
    });

});
