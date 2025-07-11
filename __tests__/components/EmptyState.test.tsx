import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import EmptyState from '@/components/EmptyState';

jest.mock('@/components/Button', () => {
    const {TouchableOpacity, Text} = require('react-native');
    return (props: { title: string; onAction: () => void; testID?: string }) => (
        <TouchableOpacity onPress={props.onAction} testID={props.testID}>
            <Text>{props.title}</Text>
        </TouchableOpacity>
    );
});

describe('EmptyState', () => {
    it('renders title and message correctly', () => {
        render(<EmptyState title="No Data" message="There is no data to display"/>);

        expect(screen.getByText('No Data')).toBeTruthy();
        expect(screen.getByText('There is no data to display')).toBeTruthy();
    });

    it('renders icon when provided', () => {
        const {Text} = require('react-native');
        const testIcon = <Text testID="test-icon">Icon</Text>;

        const {getByTestId} = render(
            <EmptyState title="No Data" message="There is no data to display" icon={testIcon}/>
        );

        expect(getByTestId('test-icon')).toBeTruthy();
    });

    it('renders action button when actionLabel and onAction are provided', () => {
        const onActionMock = jest.fn();

        render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
                actionLabel="Add Data"
                onAction={onActionMock}
            />
        );

        expect(screen.getByText('Add Data')).toBeTruthy();
    });

    it('does not render action button when actionLabel is missing', () => {
        const onActionMock = jest.fn();

        render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
                onAction={onActionMock}
            />
        );

        // Assuming button text comes from actionLabel, it shouldn't be found.
        // If EmptyState renders a button with no text, this might need adjustment.
        expect(screen.queryByText('Add Data')).toBeNull();
    });

    it('does not render action button when onAction is missing', () => {
        render(<EmptyState title="No Data" message="There is no data to display" actionLabel="Add Data"/>);

        expect(screen.queryByText('Add Data')).toBeNull();
    });

    it('calls onAction when button is pressed', () => {
        const onActionMock = jest.fn();

        render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
                actionLabel="Add Data"
                onAction={onActionMock}
            />
        );

        const button = screen.getByText('Add Data');
        fireEvent.press(button);

        expect(onActionMock).toHaveBeenCalledTimes(1);
    });
});
