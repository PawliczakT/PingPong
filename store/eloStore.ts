//store/eloStore.ts
import {create} from 'zustand';
import {PlayerId, PlayerStats, RatingElo} from '@/utils/elo';
import {usePlayerStore} from './playerStore';
import {Player} from '@/backend/types';

interface EloState {
    elo: RatingElo;
    isInitialized: boolean;
    initialize: (players: Player[]) => void;
    updateRatingsAfterMatch: (winnerId: PlayerId, loserId: PlayerId, date: Date) => Promise<void>;
    getLeaderboard: () => Array<{ id: PlayerId, stats: PlayerStats }>;
}

export const useEloStore = create<EloState>((set, get) => ({
    elo: new RatingElo({initialRating: 1500}),
    isInitialized: false,

    initialize: (players) => {
        const eloInstance = new RatingElo({initialRating: 1500});
        const playersData: Record<PlayerId, PlayerStats> = {};

        players.forEach(player => {
            playersData[player.id] = {
                rating: player.eloRating,
                gamesPlayed: player.gamesPlayed || 0,
                dailyDelta: player.dailyDelta || 0,
                lastMatchDay: player.lastMatchDay || '',
            };
        });

        eloInstance.load(playersData);
        set({elo: eloInstance, isInitialized: true});
    },

    updateRatingsAfterMatch: async (winnerId, loserId, date) => {
        const eloInstance = get().elo;

        eloInstance.updateMatch({
            winner: winnerId,
            loser: loserId,
            date: date,
        });

        const winnerStats = eloInstance.getPlayerStats(winnerId);
        const loserStats = eloInstance.getPlayerStats(loserId);

        if (!winnerStats || !loserStats) {
            console.error('Could not retrieve player stats after ELO update.');
            return;
        }

        const playerStore = usePlayerStore.getState();
        const winner = playerStore.getPlayerById(winnerId);
        const loser = playerStore.getPlayerById(loserId);

        if (!winner || !loser) {
            console.error('Winner or loser not found in playerStore');
            return;
        }

        const updatedWinner = {
            ...winner,
            eloRating: winnerStats.rating,
            gamesPlayed: winnerStats.gamesPlayed,
            dailyDelta: winnerStats.dailyDelta,
            lastMatchDay: winnerStats.lastMatchDay
        };
        const updatedLoser = {
            ...loser,
            eloRating: loserStats.rating,
            gamesPlayed: loserStats.gamesPlayed,
            dailyDelta: loserStats.dailyDelta,
            lastMatchDay: loserStats.lastMatchDay
        };

        await playerStore.updatePlayer(updatedWinner);
        await playerStore.updatePlayer(updatedLoser);

        set({elo: eloInstance});
    },

    getLeaderboard: () => {
        return get().elo.getLeaderboard();
    }
}));
