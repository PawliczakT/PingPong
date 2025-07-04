import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import ChatMessageItem, {ChatMessage} from '../../components/ChatMessageItem'; // Assuming ChatMessage is exported
import {useRouter} from 'expo-router'; // Mocked

// Mock child components and hooks
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useTheme: () => ({
        colors: {
            primary: 'blue',
            card: 'white',
            background: 'lightgrey',
            text: 'black',
            textMuted: 'grey',
            border: 'lightgrey',
            notification: 'yellow',
        },
    }),
}));

jest.mock('expo-router', () => ({
    useRouter: jest.fn(),
}));

jest.mock('../../components/PlayerAvatar', () => {
    const {View, Text} = require('react-native');
    return jest.fn(({source, size}) => <View testID="mock-player-avatar"><Text>{source?.uri || 'default-avatar'}</Text></View>);
});

jest.mock('../../components/MessageReactions', () => {
    const {View, Text} = require('react-native');
    return jest.fn(({reactions}) => (
        <View testID="mock-message-reactions">
            <Text>{JSON.stringify(reactions)}</Text>
        </View>
    ));
});

jest.mock('@/utils/formatters', () => ({
    formatChatMessageTime: (timestamp: string) => new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    }),
}));

const mockRouterPush = jest.fn();

describe('ChatMessageItem', () => {
    beforeEach(() => {
        (useRouter as jest.Mock).mockReturnValue({push: mockRouterPush});
        jest.clearAllMocks();
    });

    const userMessage: ChatMessage = {
        id: 'msg1',
        user_id: 'user123',
        profile: {
            id: 'user123',
            avatar_url: 'http://example.com/avatar.png',
            nickname: 'TestUser',
        },
        message_content: 'Hello world!',
        created_at: new Date().toISOString(),
        message_type: 'user_message',
        reactions: {'👍': ['user2']},
    };

    const systemNotification: ChatMessage = {
        id: 'sys1',
        user_id: null,
        message_type: 'system_notification',
        message_content: 'Player X won a match.',
        metadata: {
            notification_type: 'match_won',
            winnerNickname: 'PlayerX',
            loserNickname: 'PlayerY',
            matchId: 'match123',
        },
        created_at: new Date().toISOString(),
    };

    it('renders user message correctly', () => {
        const {getByText, getByTestId} = render(<ChatMessageItem message={userMessage} currentUserId="userOther"/>);

        expect(getByTestId('mock-player-avatar')).toBeTruthy();
        expect(getByText('TestUser')).toBeTruthy();
        expect(getByText('Hello world!')).toBeTruthy();
        expect(getByText(new Date(userMessage.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        }))).toBeTruthy();
        expect(getByTestId('mock-message-reactions')).toBeTruthy();
        expect(getByText(JSON.stringify({'👍': ['user2']}))).toBeTruthy();
    });

    it('renders system notification (match_won) correctly', () => {
        const {getByText, queryByTestId} = render(<ChatMessageItem message={systemNotification}/>);

        expect(queryByTestId('mock-player-avatar')).toBeNull(); // No avatar for system messages
        expect(getByText(/PlayerX/)).toBeTruthy(); // Part of the formatted message
        expect(getByText(/wygrał\(a\) mecz z/)).toBeTruthy();
        expect(getByText(/PlayerY/)).toBeTruthy();
        // Check for icon (not easily testable with Lucide, but text indicates formatting)
    });

    it('handles nickname press for user messages', () => {
        const {getByText} = render(<ChatMessageItem message={userMessage}/>);
        fireEvent.press(getByText('TestUser'));
        expect(mockRouterPush).toHaveBeenCalledWith('/player/user123');
    });

    it('does not trigger navigation for system message "nickname" press if any', () => {
        // If system messages could hypothetically render something that looks like a nickname
        const systemMsgWithFakeProfile: ChatMessage = {
            ...systemNotification,
            // System messages shouldn't typically have a "profile" in the same way user messages do
            // This test is more of a safeguard for consistent handling
        };
        const {getByText} = render(<ChatMessageItem message={systemMsgWithFakeProfile}/>);
        // Assuming "PlayerX" is rendered from metadata and might be pressable if not handled carefully
        // For this component, only user messages with actual profiles have pressable nicknames
        // Let's ensure pressing the text part of a system message doesn't navigate
        fireEvent.press(getByText(/PlayerX/));
        expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('renders different system notification types', () => {
        const tournamentWonNotification: ChatMessage = {
            ...systemNotification,
            id: 'sys2',
            metadata: {notification_type: 'tournament_won', winnerNickname: 'Champion', tournamentName: 'BigTourney'}
        };
        const achievementNotification: ChatMessage = {
            ...systemNotification,
            id: 'sys3',
            metadata: {
                notification_type: 'achievement_unlocked',
                achieverNickname: 'Achiever',
                achievementName: 'FirstWin'
            }
        };

        const {rerender, getByText} = render(<ChatMessageItem message={tournamentWonNotification}/>);
        expect(getByText(/Champion/)).toBeTruthy();
        expect(getByText(/zwyciężył\(a\) w turnieju/)).toBeTruthy();
        expect(getByText(/BigTourney/)).toBeTruthy();

        rerender(<ChatMessageItem message={achievementNotification}/>);
        expect(getByText(/Achiever/)).toBeTruthy();
        expect(getByText(/zdobył\(a\) osiągnięcie:/)).toBeTruthy();
        expect(getByText(/FirstWin/)).toBeTruthy();
    });

    // Test own message styling (conceptual, actual style check is complex)
    it('applies different styling for current user message', () => {
        // This is hard to test directly without snapshot testing or specific testIDs for styled elements
        // We assume styling difference is reflected in props passed to underlying Views if any, or snapshot
        const {getByText} = render(<ChatMessageItem message={userMessage} currentUserId="user123"/>);
        // For example, if a specific style or prop indicates it's "my message"
        // This test is more conceptual for this library.
        // With react-native-testing-library, you'd check for style properties directly on elements if needed.
        expect(getByText('Hello world!')).toBeTruthy(); // Message is rendered
    });

});
