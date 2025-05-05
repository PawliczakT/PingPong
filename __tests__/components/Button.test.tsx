import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import EmptyState from '@/components/EmptyState';
import {Text} from 'react-native';
import {ComponentType} from 'react';

jest.mock('@/components/Button', () => 'Button');

describe('EmptyState', () => {
    it('renders title and message correctly', () => {
        render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
            />
        );

        expect(screen.getByText('No Data')).toBeTruthy();
        expect(screen.getByText('There is no data to display')).toBeTruthy();
    });

    it('renders icon when provided', () => {
        const testIcon = <Text testID="test-icon">Icon</Text>;

        const {getByTestId} = render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
                icon={testIcon}
            />
        );

        expect(getByTestId('test-icon')).toBeTruthy();
    });

    it('renders action button when actionLabel and onAction are provided', () => {
        const onActionMock = jest.fn();

        const {UNSAFE_getByType} = render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
                actionLabel="Add Data"
                onAction={onActionMock}
            />
        );

        const ButtonMock = 'Button' as unknown as ComponentType<unknown>;
        const button = UNSAFE_getByType(ButtonMock);
        expect(button).toBeTruthy();
        expect(button.props.title).toBe('Add Data');
    });

    it('does not render action button when actionLabel is missing', () => {
        const onActionMock = jest.fn();

        const {UNSAFE_queryByType} = render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
                onAction={onActionMock}
            />
        );

        const ButtonMock = 'Button' as unknown as ComponentType<unknown>;
        expect(UNSAFE_queryByType(ButtonMock)).toBeNull();
    });

    it('does not render action button when onAction is missing', () => {
        const {UNSAFE_queryByType} = render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
                actionLabel="Add Data"
            />
        );

        const ButtonMock = 'Button' as unknown as ComponentType<unknown>;
        expect(UNSAFE_queryByType(ButtonMock)).toBeNull();
    });

    it('calls onAction when button is pressed', () => {
        const onActionMock = jest.fn();

        const {UNSAFE_getByType} = render(
            <EmptyState
                title="No Data"
                message="There is no data to display"
                actionLabel="Add Data"
                onAction={onActionMock}
            />
        );

        const ButtonMock = 'Button' as unknown as ComponentType<unknown>;
        const button = UNSAFE_getByType(ButtonMock);
        fireEvent(button, 'press');

        expect(onActionMock).toHaveBeenCalledTimes(1);
    });
});
