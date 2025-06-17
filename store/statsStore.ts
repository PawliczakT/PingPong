import {create} from "zustand";
import {createJSONStorage, persist} from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {HeadToHead, Player, RankingChange} from "@/backend/types";
import {usePlayerStore} from "./playerStore";

interface StatsState {
    rankingHistory: RankingChange[];
    streaks: Record<string, { current: { wins: number, losses: number }, longest: number }>;
    isLoading: boolean;
    error: string | null;
    addRankingChange: (change: RankingChange) => void;
    getRankingHistoryForPlayer: (playerId: string) => RankingChange[];
    updatePlayerStreak: (playerId: string, won: boolean) => void;
    getPlayerStreak: (playerId: string) => { current: { wins: number, losses: number }, longest: number };
    getDetailedHeadToHead: (player1Id: string, player2Id: string) => HeadToHead;
    getTopWinners: (limit: number) => Player[];
    getTopWinRate: (limit: number) => Player[];
    getLongestWinStreaks: (limit: number) => Player[];
}

export const useStatsStore = create<StatsState>()(
    persist(
        (set, get) => ({
            rankingHistory: [],
            streaks: {},
            isLoading: false,
            error: null,

            addRankingChange: (change) => {
                set((state) => ({
                    rankingHistory: [...state.rankingHistory, change],
                }));
            },

            getRankingHistoryForPlayer: (playerId) => {
                return get().rankingHistory.filter(change => change.playerId === playerId);
            },

            updatePlayerStreak: (playerId, won) => {
                set((state) => {
                    const currentStreak = state.streaks[playerId] || {
                        current: {wins: 0, losses: 0},
                        longest: 0
                    };

                    let newStreak;

                    if (won) {
                        if (currentStreak.current.losses > 0) {
                            newStreak = {
                                current: {wins: 1, losses: 0},
                                longest: currentStreak.longest,
                            };
                        } else {
                            const newWins = currentStreak.current.wins + 1;
                            newStreak = {
                                current: {wins: newWins, losses: 0},
                                longest: Math.max(currentStreak.longest, newWins),
                            };
                        }
                    } else {
                        if (currentStreak.current.wins > 0) {
                            newStreak = {
                                current: {wins: 0, losses: 1},
                                longest: currentStreak.longest,
                            };
                        } else {
                            newStreak = {
                                current: {wins: 0, losses: currentStreak.current.losses + 1},
                                longest: currentStreak.longest,
                            };
                        }
                    }

                    return {
                        streaks: {
                            ...state.streaks,
                            [playerId]: newStreak,
                        },
                    };
                });
            },

            getPlayerStreak: (playerId) => {
                return get().streaks[playerId] || {current: {wins: 0, losses: 0}, longest: 0};
            },

            getDetailedHeadToHead: (player1Id, player2Id) => {
                const matchStore = require("./matchStore").useMatchStore.getState();
                const playerStore = usePlayerStore.getState();
                const basicH2H = matchStore.getHeadToHead(player1Id, player2Id);
                const matches = basicH2H.matches;

                let player1Sets = 0;
                let player2Sets = 0;
                let player1Points = 0;
                let player2Points = 0;

                matches.forEach((match: {
                    player1Id: string;
                    player1Score: any;
                    player2Score: any;
                    sets: { player1Score: number; player2Score: number; }[];
                }) => {
                    player1Sets += match.player1Id === player1Id ? match.player1Score : match.player2Score;
                    player2Sets += match.player1Id === player1Id ? match.player2Score : match.player1Score;

                    match.sets.forEach((set: { player1Score: number; player2Score: number; }) => {
                        if (match.player1Id === player1Id) {
                            player1Points += set.player1Score;
                            player2Points += set.player2Score;
                        } else {
                            player1Points += set.player2Score;
                            player2Points += set.player1Score;
                        }
                    });
                });

                return {
                    ...basicH2H,
                    player1Sets,
                    player2Sets,
                    player1Points,
                    player2Points,
                    averagePointsPerMatch: matches.length > 0 ? {
                        player1: player1Points / matches.length,
                        player2: player2Points / matches.length,
                    } : null,
                };
            },

            getTopWinners: (limit) => {
                const playerStore = usePlayerStore.getState();
                const players = playerStore.players.filter(p => p.active);

                return [...players]
                    .sort((a, b) => (b.wins || 0) - (a.wins || 0))
                    .slice(0, limit);
            },

            getTopWinRate: (limit) => {
                const playerStore = usePlayerStore.getState();
                const players = playerStore.players.filter(p => p.active);
                return [...players]
                    .filter(p => (p.wins || 0) + (p.losses || 0) >= 5)
                    .map(p => {
                        const wins = p.wins || 0;
                        const losses = p.losses || 0;
                        const totalGames = wins + losses;
                        return {
                            ...p,
                            stats: {
                                ...p.stats,
                                winRate: totalGames > 0 ? (wins / totalGames) * 100 : 0
                            }
                        };
                    })
                    .sort((a, b) => (b.stats?.winRate || 0) - (a.stats?.winRate || 0))
                    .slice(0, limit);
            },

            getLongestWinStreaks: (limit) => {
                const playerStore = usePlayerStore.getState();
                const players = playerStore.players.filter(p => p.active);

                return [...players]
                    .map(p => ({
                        ...p,
                        stats: {
                            ...p.stats,
                            longestWinStreak: get().streaks[p.id]?.longest || 0
                        }
                    }))
                    .sort((a, b) => (b.stats?.longestWinStreak || 0) - (a.stats?.longestWinStreak || 0))
                    .slice(0, limit);
            },
        }),
        {
            name: "pingpong-stats",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
