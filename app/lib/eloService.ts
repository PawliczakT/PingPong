import { RatingElo, PlayerStats, PlayerId } from '@/utils/elo';
import { usePlayerStore } from '@/store/playerStore';
import { Player } // Assuming Player type is imported from backend types
    from "@/backend/types";

// Global instance of RatingElo
export const elo = new RatingElo({
    initialRating: 1200, // Consistent with previous getInitialEloRating()
    // kNewbie: 32, // Default
    // kIntermediate: 16, // Default
    // kPro: 8, // Default
    // decayThreshold1: 100, // Default
    // decayThreshold2: 300, // Default
    // maxDailyDelta: 100, // Default
    // scale: 400, // Default
});

// Function to initialize Elo state with data from PlayerStore / Supabase
export const initializeEloWithPlayerData = () => {
    const players: Player[] = usePlayerStore.getState().players;
    const eloPlayerData: Record<PlayerId, PlayerStats> = {};

    players.forEach(p => {
        if (p.id) { // Ensure player ID exists
            eloPlayerData[p.id] = {
                rating: p.eloRating,
                gamesPlayed: p.gamesPlayed,
                dailyDelta: p.dailyDelta,
                lastMatchDay: p.lastMatchDay,
            };
        }
    });
    elo.load(eloPlayerData);
    console.log('Elo state initialized with player data. Players loaded:', elo.getPlayerCount());
};

// Helper to get PlayerStats directly, ensuring player exists in Elo instance
export const getEloStats = (playerId: PlayerId): PlayerStats => {
    elo.ensurePlayer(playerId); // Ensures player exists, creating with initial rating if not
    return elo.getPlayerStats(playerId)!;
}
