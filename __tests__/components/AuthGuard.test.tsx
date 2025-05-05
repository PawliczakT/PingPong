import React from 'react';
import {render} from '@testing-library/react-native';
import AuthGuard from '@/components/AuthGuard';
import {Text} from 'react-native';
let mockError: Error | null = null;
jest.mock('@/store/authStore', () => ({
    useAuthStore: () => ({
        error: mockError,
    }),
}));

let mockSegments: string[] = [];
jest.mock('expo-router', () => ({
    useSegments: () => mockSegments,
}));

describe('AuthGuard', () => {
    beforeEach(() => {
        mockError = null;
        mockSegments = [];
    });

    it('renders children when no error and not in auth segment', () => {
        mockError = null;
        mockSegments = ['app'];

        const {getByText} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByText('Test Child')).toBeTruthy();
    });

    it('renders children when in auth segment regardless of error', () => {
        mockError = new Error('Auth Error');
        mockSegments = ['auth'];

        const {getByText} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByText('Test Child')).toBeTruthy();
    });

    it('renders error message when there is an error and not in auth segment', () => {
        mockError = new Error('Authentication failed');
        mockSegments = ['app'];

        const {getByText} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByText('Authentication failed')).toBeTruthy();
        expect(() => getByText('Test Child')).toThrow();
    });

    it('applies correct styles to error container', () => {
        mockError = new Error('Authentication failed');
        mockSegments = ['app'];

        const {toJSON} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );
        const container = toJSON();
        expect(container.props.style).toEqual({
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        });
    });
});
