import {formatDate, formatDateTime, formatMatchScore, formatRatingChange, formatWinRate} from '@/utils/formatters';

describe('Formatter Utilities', () => {
    describe('formatDate', () => {
        it('formats date correctly', () => {
            const dateString = '2023-05-15T14:30:00Z';
            const result = formatDate(dateString);
            expect(result).toContain('May');
            expect(result).toContain('15');
            expect(result).toContain('2023');
        });

        it('handles invalid date gracefully', () => {
            const result = formatDate('invalid-date');
            expect(result).toBeTruthy();
        });
    });

    describe('formatDateTime', () => {
        it('formats date and time correctly', () => {
            const dateString = '2023-05-15T14:30:00Z';
            const result = formatDateTime(dateString);
            expect(result).toContain('May');
            expect(result).toContain('15');
            expect(result).toContain('2023');
            expect(result).toMatch(/\d+:\d+/);
        });
    });

    describe('formatWinRate', () => {
        it('calculates win rate correctly', () => {
            expect(formatWinRate(3, 1)).toBe('75%');
            expect(formatWinRate(1, 3)).toBe('25%');
            expect(formatWinRate(0, 4)).toBe('0%');
            expect(formatWinRate(4, 0)).toBe('100%');
        });
        it('handles zero games played', () => {
            expect(formatWinRate(0, 0)).toBe('0%');
        });
    });

    describe('formatMatchScore', () => {
        it('formats match score correctly', () => {
            expect(formatMatchScore(3, 2)).toBe('3-2');
            expect(formatMatchScore(0, 3)).toBe('0-3');
            expect(formatMatchScore(5, 0)).toBe('5-0');
        });
    });

    describe('formatRatingChange', () => {
        it('formats positive rating change with plus sign', () => {
            expect(formatRatingChange(15)).toBe('+15');
            expect(formatRatingChange(8)).toBe('+8');
        });

        it('formats negative rating change with minus sign', () => {
            expect(formatRatingChange(-15)).toBe('-15');
            expect(formatRatingChange(-8)).toBe('-8');
        });

        it('formats zero rating change', () => {
            expect(formatRatingChange(0)).toBe('0');
        });
    });
});
