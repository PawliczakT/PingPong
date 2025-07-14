export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

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

export function formatWinRate(wins: number, losses: number): string {
    if (wins + losses === 0) return "0%";
    return `${Math.round((wins / (wins + losses)) * 100)}%`;
}

export function formatMatchScore(player1Score: number, player2Score: number): string {
    return `${player1Score}-${player2Score}`;
}

export function formatRatingChange(change: number): string {
    if (change > 0) return `+${change}`;
    return `${change}`;
}

export function formatChatMessageTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}
