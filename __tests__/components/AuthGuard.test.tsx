import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import AuthGuard from '@/components/AuthGuard';
import {Text} from 'react-native';

// Mock state values
let mockUser: { id: string; } | null = null;
let mockIsInitialized = true;
let mockIsLoading = false;

// Mock router
const mockReplace = jest.fn();

// Mock supabase responses
let mockHasProfile = false;
let mockSupabaseError: any = null;

// Mock supabase client
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => {
                        // Add a small delay to simulate real async behavior
                        await new Promise(resolve => setTimeout(resolve, 0));
                        return {
                            data: mockHasProfile ? {id: 'mock-player-id'} : null,
                            error: mockSupabaseError
                        };
                    }
                })
            })
        })
    }
}));

// Mock store with selector implementation
jest.mock('@/store/authStore', () => ({
    useAuthStore: (selector: any) => {
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
        mockHasProfile = false;
        mockSupabaseError = null;
        mockReplace.mockReset();

        // Mock console methods to reduce noise
        jest.spyOn(console, 'log').mockImplementation(() => {
        });
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        // Restore console methods
        jest.restoreAllMocks();
    });

    it('shows loading indicator when not initialized', () => {
        mockIsInitialized = false;

        const {getByTestId} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('shows loading indicator when loading', () => {
        mockIsLoading = true;

        const {getByTestId} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('redirects unauthenticated user to login from protected route', async () => {
        mockUser = null;
        mockSegments = ['app']; // protected route

        const {unmount} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        // Wait for any async operations to complete
        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/auth/login');
        });

        unmount();
    });

    it('renders children for unauthenticated user on public route', async () => {
        mockUser = null;
        mockSegments = ['auth', 'login']; // public route

        const {getByText, unmount} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        // Wait for component to stabilize
        await waitFor(() => {
            expect(getByText('Test Child')).toBeTruthy();
        });

        unmount();
    });

    it('redirects authenticated user from auth route to tabs', async () => {
        mockUser = {id: '123'}; // authenticated
        mockSegments = ['auth', 'login'];
        mockHasProfile = true; // User has a profile

        const {unmount} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        // Wait for the async profile check and redirect
        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
        }, {timeout: 3000});

        unmount();
    });

    it('redirects authenticated user without profile to profile setup', async () => {
        mockUser = {id: '123'}; // authenticated
        mockSegments = ['app']; // not in auth group, not profile route
        mockHasProfile = false; // User doesn't have a profile

        const {unmount} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        // Wait for the async profile check and redirect
        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/(tabs)/profile');
        }, {timeout: 3000});

        unmount();
    });

    it('allows authenticated user with profile to access protected routes', async () => {
        mockUser = {id: '123'}; // authenticated
        mockSegments = ['app']; // protected route
        mockHasProfile = true; // User has a profile

        const {getByText, unmount} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        // Wait for async operations to complete and children to render
        await waitFor(() => {
            expect(getByText('Test Child')).toBeTruthy();
        });

        // Should not redirect anywhere
        expect(mockReplace).not.toHaveBeenCalled();

        unmount();
    });

    it('handles profile check error gracefully', async () => {
        mockUser = {id: '123'}; // authenticated
        mockSegments = ['app'];
        mockHasProfile = false;
        mockSupabaseError = new Error('Database error');

        const {getByTestId, unmount} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        // Should show loading state when profile check fails
        await waitFor(() => {
            expect(getByTestId('loading-indicator')).toBeTruthy();
        });

        // Should not redirect when there's an error
        expect(mockReplace).not.toHaveBeenCalled();

        unmount();
    });

    it('allows user on profile route when they need profile setup', async () => {
        mockUser = {id: '123'}; // authenticated
        mockSegments = ['(tabs)', 'profile']; // on profile route
        mockHasProfile = false; // User doesn't have a profile

        const {getByText, unmount} = render(
            <AuthGuard>
                <Text>Test Child</Text>
            </AuthGuard>
        );

        // Should render children since user is on profile route
        await waitFor(() => {
            expect(getByText('Test Child')).toBeTruthy();
        });

        // Should not redirect since user is already on profile route
        expect(mockReplace).not.toHaveBeenCalled();

        unmount();
    });
});
