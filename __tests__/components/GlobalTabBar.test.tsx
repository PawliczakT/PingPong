import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import GlobalTabBar from '@/components/GlobalTabBar';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
    usePathname: () => '',
}));

describe('GlobalTabBar', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        render(<GlobalTabBar/>);
        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Players')).toBeTruthy();
        expect(screen.getByText('Add Match')).toBeTruthy();
        expect(screen.getByText('Tournaments')).toBeTruthy();
        expect(screen.getByText('Stats')).toBeTruthy();
    });

    it('navigates to the correct screen when a tab is pressed', () => {
        render(<GlobalTabBar/>);

        fireEvent.press(screen.getByText('Home'));
        expect(mockPush).toHaveBeenCalledWith('/');

        fireEvent.press(screen.getByText('Players'));
        expect(mockPush).toHaveBeenCalledWith('/players');

        fireEvent.press(screen.getByText('Add Match'));
        expect(mockPush).toHaveBeenCalledWith('/add-match');

        fireEvent.press(screen.getByText('Tournaments'));
        expect(mockPush).toHaveBeenCalledWith('/tournaments');

        fireEvent.press(screen.getByText('Stats'));
        expect(mockPush).toHaveBeenCalledWith('/stats');
    });
});
