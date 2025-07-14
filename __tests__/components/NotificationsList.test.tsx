import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import NotificationsList from '@/components/NotificationsList';
import {Notification} from '@/backend/types';

jest.mock('lucide-react-native', () => ({
    Bell: 'Bell',
    Trash2: 'Trash2',
}));

jest.mock('@/constants/colors', () => ({
    colors: {
        text: '#000000',
        textLight: '#8E8E93',
        primary: '#007AFF',
        border: '#E5E5EA',
    },
}));

describe('NotificationsList', () => {
    const mockNotifications: Notification[] = [
        {
            id: '1',
            title: 'New Match',
            message: 'A new match has been recorded',
            type: 'match',
            read: false,
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
        {
            id: '2',
            title: 'Tournament Update',
            message: 'Tournament has started',
            type: 'tournament',
            read: true,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: '3',
            title: 'Achievement Unlocked',
            message: 'You earned a new achievement',
            type: 'achievement',
            read: false,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
    ];

    const onPressMock = jest.fn();
    const onClearMock = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders notifications correctly', () => {
        render(
            <NotificationsList
                notifications={mockNotifications}
                onPress={onPressMock}
                onClear={onClearMock}
            />
        );
        expect(screen.getByText('New Match')).toBeTruthy();
        expect(screen.getByText('Tournament Update')).toBeTruthy();
        expect(screen.getByText('Achievement Unlocked')).toBeTruthy();
        expect(screen.getByText('A new match has been recorded')).toBeTruthy();
        expect(screen.getByText('Tournament has started')).toBeTruthy();
        expect(screen.getByText('You earned a new achievement')).toBeTruthy();
        expect(screen.getByText('5 min ago')).toBeTruthy();
        expect(screen.getByText('2 hours ago')).toBeTruthy();
        expect(screen.getByText('3 days ago')).toBeTruthy();
    });

    it('renders empty state when there are no notifications', () => {
        render(
            <NotificationsList
                notifications={[]}
                onPress={onPressMock}
                onClear={onClearMock}
            />
        );
        expect(screen.getByText('No notifications yet')).toBeTruthy();
    });

    it('calls onPress when a notification is pressed', () => {
        render(
            <NotificationsList
                notifications={mockNotifications}
                onPress={onPressMock}
                onClear={onClearMock}
            />
        );
        fireEvent.press(screen.getByText('New Match'));
        expect(onPressMock).toHaveBeenCalledTimes(1);
        expect(onPressMock).toHaveBeenCalledWith(mockNotifications[0]);
    });

    it('calls onClear when Clear All button is pressed', () => {
        render(
            <NotificationsList
                notifications={mockNotifications}
                onPress={onPressMock}
                onClear={onClearMock}
            />
        );
        fireEvent.press(screen.getByText('Clear All'));
        expect(onClearMock).toHaveBeenCalledTimes(1);
    });

    it('formats time correctly for different time periods', () => {
        const justNowNotification: Notification = {
            id: '4',
            title: 'Just Now',
            message: 'This just happened',
            type: 'match',
            read: false,
            createdAt: new Date(Date.now() - 30 * 1000).toISOString(),
        };

        render(
            <NotificationsList
                notifications={[justNowNotification, ...mockNotifications]}
                onPress={onPressMock}
                onClear={onClearMock}
            />
        );
        expect(screen.getByText('just now')).toBeTruthy();
    });
});
