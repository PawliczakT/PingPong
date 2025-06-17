import React from 'react';
import {render} from '@testing-library/react-native';
import PlayerAvatar from '@/components/PlayerAvatar';
import {Player} from '@/backend/types';

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

describe('PlayerAvatar', () => {
    it('renders initials when no avatar URL is provided', () => {
        const {getByText} = render(<PlayerAvatar name="John Doe"/>);
        expect(getByText('JD')).toBeTruthy();
    });

    it('renders image when avatar URL is provided', () => {
        const {UNSAFE_getByType} = render(
            <PlayerAvatar name="John Doe" avatarUrl="https://example.com/avatar.jpg"/>
        );
        const image = UNSAFE_getByType('Image');
        expect(image).toBeTruthy();
        expect(image.props.source).toEqual({uri: 'https://example.com/avatar.jpg'});
    });

    it('uses player object data when provided', () => {
        const player: Player = {
            id: 'player1',
            name: 'Jane Smith',
            avatarUrl: 'https://example.com/jane.jpg',
            eloRating: 1500,
            wins: 10,
            losses: 5,
            active: true,
            createdAt: '',
            updatedAt: ''
        };

        const {UNSAFE_getByType} = render(<PlayerAvatar name="Ignored Name" player={player}/>);
        const image = UNSAFE_getByType('Image');
        expect(image).toBeTruthy();
        expect(image.props.source).toEqual({uri: 'https://example.com/jane.jpg'});
    });

    it('handles single name correctly for initials', () => {
        const {getByText} = render(<PlayerAvatar name="John"/>);
        expect(getByText('J')).toBeTruthy();
    });

    it('handles long names correctly for initials', () => {
        const {getByText} = render(<PlayerAvatar name="John Middle Last Name"/>);
        expect(getByText('JM')).toBeTruthy();
    });

    it('applies custom size correctly', () => {
        const {toJSON} = render(<PlayerAvatar name="John Doe" size={80}/>);
        const container = toJSON();
        expect(container.props.style.width).toBe(80);
        expect(container.props.style.height).toBe(80);
        expect(container.props.style.borderRadius).toBe(40);
    });
});
