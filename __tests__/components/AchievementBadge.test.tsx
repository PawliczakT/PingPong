import React from 'react';
import {render} from '@testing-library/react-native';
import AchievementBadge from '@/components/AchievementBadge';
import {Achievement, AchievementType} from '@/backend/types';

jest.mock('@/constants/achievements', () => {
    const {AchievementType} = require('@/backend/types');
    return {
        achievements: [
            {type: AchievementType.FIRST_WIN, name: 'First Win', description: 'Win your first match', icon: 'trophy'},
            {
                type: AchievementType.CLEAN_SWEEP,
                name: 'Flawless Victory',
                description: 'Win a match 3-0.',
                icon: 'star',
            },
        ],
    };
});

jest.mock('@/constants/colors', () => ({
    colors: {
        primary: '#007AFF',
        inactive: '#8E8E93',
        card: '#FFFFFF',
        border: '#E5E5EA',
        text: '#000000',
    },
}));

describe('AchievementBadge', () => {
    const mockAchievement: Achievement = {
        type: AchievementType.FIRST_WIN,
        name: 'First Victory',
        description: 'Win your first match',
        icon: 'award',
        target: 1,
        id: '',
        progress: 0,
        unlocked: false
    };

    it('renders correctly with default props', () => {
        const {toJSON} = render(<AchievementBadge achievement={mockAchievement}/>);
        expect(toJSON()).toBeTruthy();
    });

    it('applies correct size for small badge', () => {
        const {toJSON} = render(<AchievementBadge achievement={mockAchievement} size="small"/>);
        const container = toJSON();
        expect(container.props.style).toEqual(expect.arrayContaining([
            expect.objectContaining({width: 60, height: 60})
        ]));
    });

    it('applies correct size for medium badge', () => {
        const {toJSON} = render(<AchievementBadge achievement={mockAchievement} size="medium"/>);
        const container = toJSON();
        expect(container.props.style).toEqual(expect.arrayContaining([
            expect.objectContaining({width: 80, height: 80})
        ]));
    });

    it('applies correct size for large badge', () => {
        const {toJSON} = render(<AchievementBadge achievement={mockAchievement} size="large"/>);
        const container = toJSON();
        expect(container.props.style).toEqual(expect.arrayContaining([
            expect.objectContaining({width: 100, height: 100})
        ]));
    });

    it('applies locked style when unlocked is false', () => {
        const {toJSON} = render(<AchievementBadge achievement={mockAchievement} unlocked={false}/>);
        const container = toJSON();
        expect(container.props.style).toEqual(expect.arrayContaining([
            expect.objectContaining({opacity: 0.6, backgroundColor: '#E5E5EA'})
        ]));
    });

    it('shows progress bar when showProgress is true and unlocked is false', () => {
        const {toJSON} = render(
            <AchievementBadge
                achievement={mockAchievement}
                unlocked={false}
                showProgress={true}
                progress={0.5}
            />
        );
        const json = toJSON();
        const progressContainer = json.children[1];
        expect(progressContainer).toBeTruthy();
        expect(progressContainer.props.style).toEqual(expect.objectContaining({
            position: 'absolute',
            bottom: 0,
        }));
    });

    it('does not show progress bar when showProgress is false', () => {
        const {toJSON} = render(
            <AchievementBadge
                achievement={mockAchievement}
                unlocked={false}
                showProgress={false}
            />
        );
        const json = toJSON();
        expect(json.children.length).toBe(1);
    });

    it('does not show progress bar when unlocked is true', () => {
        const {toJSON} = render(
            <AchievementBadge
                achievement={mockAchievement}
                unlocked={true}
                showProgress={true}
            />
        );
        const json = toJSON();
        expect(json.children.length).toBe(1);
    });

    it('calculates progress percentage correctly', () => {
        const {toJSON} = render(
            <AchievementBadge
                achievement={{...mockAchievement, target: 10}}
                unlocked={false}
                showProgress={true}
                progress={5}
            />
        );
        const json = toJSON();
        const progressContainer = json.children[1];
        const progressBar = progressContainer.children[0];
        expect(progressBar.props.style).toEqual(expect.arrayContaining([
            expect.objectContaining({width: '50%'})
        ]));
    });

    it('caps progress percentage at 100%', () => {
        const {toJSON} = render(
            <AchievementBadge
                achievement={{...mockAchievement, target: 10}}
                unlocked={false}
                showProgress={true}
                progress={15}
            />
        );
        const json = toJSON();
        const progressContainer = json.children[1];
        const progressBar = progressContainer.children[0];
        expect(progressBar.props.style).toEqual(expect.arrayContaining([
            expect.objectContaining({width: '100%'})
        ]));
    });

    it('renders correctly for a given achievement type', () => {
        const {toJSON} = render(<AchievementBadge achievement={mockAchievement}/>);
        expect(toJSON()).toBeTruthy();
    });
});
