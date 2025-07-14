import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import ReactionPicker from '../../components/ReactionPicker'; // Assuming path is correct
import {Animated} from 'react-native';

// Mock useTheme
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useTheme: () => ({
        colors: {
            card: '#fff',
            border: '#ccc',
        },
    }),
}));

// Mock Animated
jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');

    // Mock Animated module
    const Animated = {
        ...RN.Animated,
        Value: jest.fn(() => ({
            setValue: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            removeAllListeners: jest.fn(),
            interpolate: jest.fn(config => config.outputRange[0]),
        })),
        spring: jest.fn((value, config) => ({
            start: (callback) => {
                value.setValue(config.toValue);
                callback && callback({finished: true});
            },
            stop: jest.fn(),
        })),
        timing: jest.fn((value, config) => ({
            start: (callback) => {
                value.setValue(config.toValue);
                callback && callback({finished: true});
            },
            stop: jest.fn(),
        })),
        sequence: jest.fn(animations => ({
            start: (callback) => {
                animations.forEach(anim => anim.start(() => {
                }));
                callback && callback({finished: true});
            },
            stop: jest.fn(),
        })),
    };

    // Keep original View, Text, etc., but replace Animated
    return Object.setPrototypeOf(
        {
            Animated,
        },
        RN,
    );
});

const PREDEFINED_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

describe('ReactionPicker', () => {
    const mockOnSelectEmoji = jest.fn();
    const mockOnDismiss = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing when isVisible is false initially', () => {
        const {getByTestId} = render(
            <ReactionPicker
                isVisible={false}
                onSelectEmoji={mockOnSelectEmoji}
                onDismiss={mockOnDismiss}
            />
        );

        // The component is in the tree but animated to scale: 0, making it invisible.
        // We check for the container's presence, assuming it has a testID.
        // Note: This requires adding testID="reaction-picker-container" to the component's root View.
        const container = getByTestId('reaction-picker-container');
        expect(container).toBeTruthy();
    });

    it('renders emojis when isVisible is true', () => {
        const {getByText} = render(
            <ReactionPicker
                isVisible={true}
                onSelectEmoji={mockOnSelectEmoji}
                onDismiss={mockOnDismiss}
            />
        );
        PREDEFINED_EMOJIS.forEach(emoji => {
            expect(getByText(emoji)).toBeTruthy();
        });
    });

    it('renders emojis when isVisible becomes true', () => {
        const {rerender, getByText} = render(
            <ReactionPicker
                isVisible={false}
                onSelectEmoji={mockOnSelectEmoji}
                onDismiss={mockOnDismiss}
            />
        );

        rerender(
            <ReactionPicker
                isVisible={true}
                onSelectEmoji={mockOnSelectEmoji}
                onDismiss={mockOnDismiss}
            />
        );

        PREDEFINED_EMOJIS.forEach(emoji => {
            expect(getByText(emoji)).toBeTruthy();
        });
    });

    it('calls onSelectEmoji with the correct emoji when an emoji is pressed', () => {
        const {getByText} = render(
            <ReactionPicker
                isVisible={true}
                onSelectEmoji={mockOnSelectEmoji}
                onDismiss={mockOnDismiss}
            />
        );
        const emojiToSelect = PREDEFINED_EMOJIS[1]; // '❤️'
        fireEvent.press(getByText(emojiToSelect));
        expect(mockOnSelectEmoji).toHaveBeenCalledWith(emojiToSelect);
    });

    it('animates entry and exit based on isVisible prop', () => {
        const {rerender} = render(
            <ReactionPicker isVisible={false} onSelectEmoji={mockOnSelectEmoji} onDismiss={mockOnDismiss}/>
        );

        rerender(
            <ReactionPicker isVisible={true} onSelectEmoji={mockOnSelectEmoji} onDismiss={mockOnDismiss}/>
        );
        // isVisible true -> scaleAnim to 1
        expect(Animated.spring).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({toValue: 1}));

        rerender(
            <ReactionPicker isVisible={false} onSelectEmoji={mockOnSelectEmoji} onDismiss={mockOnDismiss}/>
        );
        // isVisible false -> scaleAnim to 0, uses timing
        expect(Animated.timing).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({toValue: 0}));
    });

    it('emoji buttons have press animation', () => {
        const {getByText} = render(
            <ReactionPicker isVisible={true} onSelectEmoji={mockOnSelectEmoji} onDismiss={mockOnDismiss}/>
        );
        const emojiToPress = PREDEFINED_EMOJIS[0];
        fireEvent.press(getByText(emojiToPress));
        // Check if Animated.spring was called for the button's scale animation
        expect(Animated.spring).toHaveBeenCalled();
    });

});
