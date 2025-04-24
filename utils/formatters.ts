/**
 * Format a date string to a readable format
 * @param dateString ISO date string
 * @returns Formatted date string (e.g., "Jan 15, 2023")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date string to include time
 * @param dateString ISO date string
 * @returns Formatted date and time string (e.g., "Jan 15, 2023, 3:45 PM")
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

/**
 * Format a win/loss ratio
 * @param wins Number of wins
 * @param losses Number of losses
 * @returns Formatted ratio string (e.g., "75%")
 */
export function formatWinRate(wins: number, losses: number): string {
  if (wins + losses === 0) return "0%";
  return `${Math.round((wins / (wins + losses)) * 100)}%`;
}

/**
 * Format a match score
 * @param player1Score Player 1 score
 * @param player2Score Player 2 score
 * @returns Formatted score string (e.g., "3-2")
 */
export function formatMatchScore(player1Score: number, player2Score: number): string {
  return `${player1Score}-${player2Score}`;
}

/**
 * Format ELO rating change
 * @param change Rating change value
 * @returns Formatted string with + or - sign
 */
export function formatRatingChange(change: number): string {
  if (change > 0) return `+${change}`;
  return `${change}`;
}