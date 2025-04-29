import React from 'react';
import {render, screen} from '@testing-library/react-native';
import StreakDisplay from '@/components/StreakDisplay';

jest.mock('lucide-react-native', () => ({
    Flame: 'Flame',
    Snowflake: 'Snowflake',
}));

describe('StreakDisplay', () => {
    it('renders nothing when no streaks are provided', () => {
        const {toJSON} = render(<StreakDisplay/>);
        expect(toJSON()).toBeNull();
    });

    it('renders win streak badge when currentStreak.wins > 0', () => {
        render(<StreakDisplay currentStreak={{wins: 3, losses: 0}}/>);
        expect(screen.getByText('3')).toBeTruthy();
    });

    it('renders loss streak badge when currentStreak.losses > 0', () => {
        render(<StreakDisplay currentStreak={{wins: 0, losses: 2}}/>);
        expect(screen.getByText('2')).toBeTruthy();
    });

    it('renders both win and loss streak badges when both > 0', () => {
        render(<StreakDisplay currentStreak={{wins: 3, losses: 2}}/>);
        const streakTexts = screen.getAllByText(/[0-9]+/);
        expect(streakTexts).toHaveLength(2);
        expect(streakTexts[0].props.children).toBe(3);
        expect(streakTexts[1].props.children).toBe(2);
    });

    it('renders longest streak text when longestStreak > 0', () => {
        render(<StreakDisplay longestStreak={5}/>);
        expect(screen.getByText('Najdłuższa seria: 5')).toBeTruthy();
    });

    it('renders all streak information when all are provided', () => {
        render(<StreakDisplay currentStreak={{wins: 3, losses: 2}} longestStreak={5}/>);
        expect(screen.getByText('3')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.getByText('Najdłuższa seria: 5')).toBeTruthy();
    });

    it('applies custom style when provided', () => {
        const customStyle = {marginTop: 10};

        const {toJSON} = render(
            <StreakDisplay
                currentStreak={{wins: 3, losses: 0}}
                style={customStyle}
            />
        );

        const json = toJSON();
        expect(json).toBeTruthy();

        if (json) {
            const containerProps = json.props;
            expect(containerProps.style).toEqual(expect.arrayContaining([expect.objectContaining(customStyle)]));
        }
    });

    it('renders zero streaks correctly', () => {
        const {toJSON} = render(<StreakDisplay currentStreak={{wins: 0, losses: 0}} longestStreak={0}/>);
        expect(toJSON()).toBeNull();
    });
});
