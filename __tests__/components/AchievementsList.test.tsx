import React from 'react';
import {render} from '@testing-library/react-native';
import {AchievementProgress, AchievementType} from '@/backend/types';
import AchievementsList from '@/components/AchievementsList';

jest.mock('@/components/AchievementBadge', () => 'AchievementBadge');
jest.mock('@/constants/achievements', () => ({
    achievements: [
        {
            type: 'FIRST_WIN',
            name: 'First Victory',
            description: 'Win your first match',
            icon: 'award',
            target: 1,
        },
        {
            type: 'WINS_10',
            name: 'Consistent Winner',
            description: 'Win 10 matches',
            icon: 'award',
            target: 10,
        },
        {
            type: 'MATCHES_10',
            name: 'Getting Started',
            description: 'Play 10 matches',
            icon: 'zap',
            target: 10,
        },
    ],
    getAchievementIcon: () => () => null,
}));

jest.mock('@/constants/colors', () => ({
    colors: {
        text: '#000000',
        textLight: '#8E8E93',
    },
}));

describe('AchievementsList', () => {
    const playerAchievements: AchievementProgress[] = [
        {
            type: AchievementType.FIRST_WIN,
            progress: 1,
            unlocked: true,
            unlockedAt: '2023-05-15T14:30:00Z',
        },
        {
            type: AchievementType.WINS_10,
            progress: 5,
            unlocked: false,
            unlockedAt: null,
        },
        {
            type: AchievementType.MATCHES_10,
            progress: 0,
            unlocked: false,
            unlockedAt: null,
        },
    ];

    it('renders without crashing', () => {
        const {toJSON} = render(
            <AchievementsList playerAchievements={playerAchievements}/>
        );
        expect(toJSON()).toBeTruthy();
    });

    it('renders without crashing when showLocked is false', () => {
        const {toJSON} = render(
            <AchievementsList playerAchievements={playerAchievements} showLocked={false}/>
        );
        expect(toJSON()).toBeTruthy();
    });

    it('renders without crashing with empty achievements', () => {
        const {toJSON} = render(
            <AchievementsList playerAchievements={[]}/>
        );
        expect(toJSON()).toBeTruthy();
    });

    it('renders without crashing with onPress handler', () => {
        const onPressMock = jest.fn();
        const {toJSON} = render(
            <AchievementsList
                playerAchievements={playerAchievements}
                onPress={onPressMock}
            />
        );
        expect(toJSON()).toBeTruthy();
    });
});
