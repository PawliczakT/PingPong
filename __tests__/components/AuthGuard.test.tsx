import React from 'react';
import { render, act } from '@testing-library/react-native';
import AuthGuard from '@/components/AuthGuard';
import { Text } from 'react-native';

// Mock state values
let mockUser: { id: string; } | null = null;
let mockIsInitialized = true;
let mockIsLoading = false;

// Mock router
const mockReplace = jest.fn();

// Mock store with selector implementation
jest.mock('@/store/authStore', () => ({
    useAuthStore: (selector: (arg0: { user: { id: string; } | null; isInitialized: boolean; isLoading: boolean; }) => any) => {
        // This handles the state selector pattern
        const state = {
            user: mockUser,
            isInitialized: mockIsInitialized,
            isLoading: mockIsLoading
        };
        return selector(state);
    },
}));

// Mock segments and router
let mockSegments = [''];
jest.mock('expo-router', () => ({
    useSegments: () => mockSegments,
    useRouter: () => ({
        replace: mockReplace,
    }),
}));

describe('AuthGuard', () => {
    beforeEach(() => {
        // Reset all mocks and state before each test
        mockUser = null;
        mockIsInitialized = true;
        mockIsLoading = false;
        mockSegments = [''];
        mockReplace.mockReset();

        // Mock console methods to reduce noise
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows loading indicator when not initialized', () => {
        mockIsInitialized = false;

        const { getByTestId } = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('shows loading indicator when loading', () => {
        mockIsLoading = true;

        const { getByTestId } = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('redirects unauthenticated user to login from protected route', () => {
        mockUser = null;
        mockSegments = ['app']; // protected route

        render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        // Check if router.replace was called with the login path
        expect(mockReplace).toHaveBeenCalledWith('/auth/login');
    });

    it('renders children for unauthenticated user on public route', () => {
        mockUser = null;
        mockSegments = ['auth', 'login']; // public route

        const { getByText } = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByText('Test Child')).toBeTruthy();
    });

    it('redirects authenticated user from auth route to edit profile', () => {
        mockUser = { id: '123' }; // authenticated
        mockSegments = ['auth', 'login'];

        render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(mockReplace).toHaveBeenCalledWith('/player/edit-profile');
    });

    it('renders children for authenticated user on protected route', () => {
        mockUser = { id: '123' };
        mockSegments = ['player', 'edit-profile']; // protected route

        const { getByText } = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByText('Test Child')).toBeTruthy();
    });
});
