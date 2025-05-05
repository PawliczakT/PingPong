/**
 * Calculate new ELO ratings for two players after a match
 * @param player1Rating Current ELO rating of player 1
 * @param player2Rating Current ELO rating of player 2
 * @param player1Won Boolean indicating if player 1 won the match
 * @param kFactor K-factor determines how much ratings change (default: 32)
 * @returns Object with new ratings for both players
 */
export function calculateEloRating(
    player1Rating: number,
    player2Rating: number,
    player1Won: boolean,
    kFactor: number = 32
): { player1NewRating: number; player2NewRating: number } {
    const expectedScore1 = 1 / (1 + Math.pow(10, (player2Rating - player1Rating) / 400));
    const expectedScore2 = 1 / (1 + Math.pow(10, (player1Rating - player2Rating) / 400));
    const actualScore1 = player1Won ? 1 : 0;
    const actualScore2 = player1Won ? 0 : 1;
    const player1NewRating = Math.round(player1Rating + kFactor * (actualScore1 - expectedScore1));
    const player2NewRating = Math.round(player2Rating + kFactor * (actualScore2 - expectedScore2));
    return {player1NewRating, player2NewRating};
}

/**
 * Get the initial ELO rating for new players
 */
export function getInitialEloRating(): number {
    return 1200;
}
