import {calculateEloRating, getInitialEloRating} from '@/utils/elo';

describe('ELO Rating Utilities', () => {
    describe('getInitialEloRating', () => {
        it('returns the correct initial ELO rating', () => {
            expect(getInitialEloRating()).toBe(1200);
        });
    });

    describe('calculateEloRating', () => {
        it('calculates new ratings when player 1 wins', () => {
            const player1Rating = 1400;
            const player2Rating = 1200;
            const player1Won = true;
            const result = calculateEloRating(player1Rating, player2Rating, player1Won);
            expect(result.player1NewRating).toBeGreaterThan(player1Rating);
            expect(result.player2NewRating).toBeLessThan(player2Rating);
        });

        it('calculates new ratings when player 2 wins', () => {
            const player1Rating = 1400;
            const player2Rating = 1200;
            const player1Won = false;
            const result = calculateEloRating(player1Rating, player2Rating, player1Won);
            expect(result.player1NewRating).toBeLessThan(player1Rating);
            expect(result.player2NewRating).toBeGreaterThan(player2Rating);
        });

        it('calculates ratings with custom K-factor', () => {
            const player1Rating = 1400;
            const player2Rating = 1200;
            const player1Won = true;
            const kFactor = 16;
            const result = calculateEloRating(player1Rating, player2Rating, player1Won, kFactor);
            const defaultResult = calculateEloRating(player1Rating, player2Rating, player1Won);
            expect(result.player1NewRating - player1Rating).toBeLessThan(defaultResult.player1NewRating - player1Rating);
            expect(player2Rating - result.player2NewRating).toBeLessThan(player2Rating - defaultResult.player2NewRating);
        });

        it('produces expected rating changes for equal-rated players', () => {
            const rating = 1500;
            const resultWin = calculateEloRating(rating, rating, true);
            expect(resultWin.player1NewRating).toBe(rating + 16);
            expect(resultWin.player2NewRating).toBe(rating - 16);
        });
    });
});
