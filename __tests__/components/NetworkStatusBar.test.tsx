import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import NetworkStatusBar from '@/components/NetworkStatusBar';

// Mock the useNetworkStore hook
const mockCheckNetworkStatus = jest.fn();
const mockSyncPendingMatches = jest.fn().mockResolvedValue(undefined);
let mockIsOnline = true;
let mockPendingMatches: { id: string; }[] = [];

jest.mock('@/store/networkStore', () => ({
    useNetworkStore: () => ({
        isOnline: mockIsOnline,
        pendingMatches: mockPendingMatches,
        syncPendingMatches: mockSyncPendingMatches,
        checkNetworkStatus: mockCheckNetworkStatus,
    }),
}));

jest.mock('lucide-react-native', () => ({
    WifiOff: 'WifiOff',
    RefreshCw: 'RefreshCw',
}));

describe('NetworkStatusBar', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsOnline = true;
        mockPendingMatches = [];
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('does not render anything when online and no pending matches', () => {
        mockIsOnline = true;
        mockPendingMatches = [];
        const {toJSON} = render(<NetworkStatusBar/>);
        expect(toJSON()).toBeNull();
    });

    it('displays offline message when offline', () => {
        mockIsOnline = false;
        mockPendingMatches = [];
        render(<NetworkStatusBar/>);
        expect(screen.getByText("You're offline. Changes will be saved locally.")).toBeTruthy();
    });

    it('displays pending matches count and sync button when online with pending matches', () => {
        mockIsOnline = true;
        mockPendingMatches = [{id: '1'}, {id: '2'}];
        render(<NetworkStatusBar/>);
        expect(screen.getByText('2 match(es) pending sync')).toBeTruthy();
        expect(screen.getByText('Sync Now')).toBeTruthy();
    });

    it('calls syncPendingMatches when sync button is pressed', async () => {
        mockIsOnline = true;
        mockPendingMatches = [{id: '1'}];
        render(<NetworkStatusBar/>);
        fireEvent.press(screen.getByText('Sync Now'));
        expect(mockSyncPendingMatches).toHaveBeenCalledTimes(1);
    });

    it('calls onSync callback when sync button is pressed', async () => {
        mockIsOnline = true;
        mockPendingMatches = [{id: '1'}];
        const onSyncMock = jest.fn();
        render(<NetworkStatusBar onSync={onSyncMock}/>);
        fireEvent.press(screen.getByText('Sync Now'));
        await act(async () => {
            await Promise.resolve();
        });
        expect(onSyncMock).toHaveBeenCalledTimes(1);
    });

    it('shows "Syncing..." text while syncing', async () => {
        mockIsOnline = true;
        mockPendingMatches = [{id: '1'}];
        mockSyncPendingMatches.mockImplementationOnce(() => {
            return new Promise(resolve => {
                setTimeout(resolve, 1000);
            });
        });
        render(<NetworkStatusBar/>);
        fireEvent.press(screen.getByText('Sync Now'));
        expect(screen.getByText('Syncing...')).toBeTruthy();
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        await act(async () => {
            await Promise.resolve();
        });
    });

    it('checks network status periodically', () => {
        render(<NetworkStatusBar/>);
        expect(mockCheckNetworkStatus).toHaveBeenCalledTimes(1);
        act(() => {
            jest.advanceTimersByTime(30000);
        });
        expect(mockCheckNetworkStatus).toHaveBeenCalledTimes(2);
        act(() => {
            jest.advanceTimersByTime(30000);
        });
        expect(mockCheckNetworkStatus).toHaveBeenCalledTimes(3);
    });
});
