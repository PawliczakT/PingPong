//store/matchStore.ts
import {create} from "zustand";
import {Achievement, HeadToHead, Match, Set} from "@/backend/types";
import {usePlayerStore} from "./playerStore";
import {dispatchSystemNotification} from '@/backend/server/trpc/services/notificationService';
import {
    sendAchievementNotification,
    sendMatchResultNotification,
    sendRankingChangeNotification
} from "./notificationStore";
// import {calculateEloRating} from "@/utils/elo"; // No longer needed
import {supabase} from '@/app/lib/supabase';
import {useEffect} from "react";
import {Json} from "@/backend/types/supabase";
import {elo} from "@/app/lib/eloService"; // Import global elo instance
import {MatchRecord} from "@/utils/elo"; // Import MatchRecord type

interface MatchState {
    matches: Match[];
    isLoading: boolean;
    error: string | null;
    addMatch: (
        player1Id: string,
        player2Id: string,
        player1Score: number,
        player2Score: number,
        sets: Set[],
        tournamentId?: string
    ) => Promise<Match>;
    getMatchById: (matchId: string) => Match | undefined;
    getMatchesByPlayerId: (playerId: string) => Match[];
    getRecentMatches: (limit?: number) => Match[];
    getHeadToHead: (player1Id: string, player2Id: string) => HeadToHead;
}

export const useMatchStore = create<MatchState>()(
    (set, get) => ({

        matches: [],
        isLoading: false,
        error: null,

        addMatch: async (player1Id, player2Id, player1Score, player2Score, sets, tournamentId) => {
            set({isLoading: true, error: null});
            let newMatch: Match | null = null;

            try {
                const winner = player1Score > player2Score ? player1Id : player2Id;
                const playerStore = usePlayerStore.getState();
                const statsStore = require("./statsStore").useStatsStore.getState();
                const achievementStore = require("./achievementStore").useAchievementStore.getState();

                const player1 = playerStore.getPlayerById(player1Id);
                const player2 = playerStore.getPlayerById(player2Id);

                if (!player1 || !player2) {
                    throw new Error("Player not found");
                }

                const matchDate = new Date(); // Use a consistent date for all operations related to this match

                // Create MatchRecord for elo service
                const matchRecord: MatchRecord = {
                    winner: winner,
                    loser: winner === player1Id ? player2Id : player1Id,
                    date: matchDate,
                };

                // Get old ratings for RankingChange event before updating Elo
                const oldPlayer1Rating = player1.eloRating;
                const oldPlayer2Rating = player2.eloRating;

                // Update Elo ratings using the elo service
                elo.updateMatch(matchRecord);

                const player1UpdatedStats = elo.getPlayerStats(player1Id);
                const player2UpdatedStats = elo.getPlayerStats(player2Id);

                if (!player1UpdatedStats || !player2UpdatedStats) {
                    throw new Error("Failed to get updated player stats from Elo service");
                }

                // Persist match to Supabase
                const {data, error: insertError} = await supabase.from('matches').insert([
                    {
                        player1_id: player1Id,
                        player2_id: player2Id,
                        player1_score: player1Score,
                        player2_score: player2Score,
                        sets: sets as unknown as Json,
                        winner: winner,
                        tournament_id: tournamentId,
                        date: matchDate.toISOString(), // Use consistent date
                    }
                ]).select().single();

                if (insertError) throw insertError;

                newMatch = {
                    id: data.id,
                    player1Id: data.player1_id,
                    player2Id: data.player2_id,
                    player1Score: data.player1_score,
                    player2Score: data.player2_score,
                    sets: data.sets as unknown as Set[],
                    winner: data.winner,
                    winnerId: data.winner,
                    date: data.date, // This will be the ISOString from Supabase
                    tournamentId: data.tournament_id,
                };

                // Update player stats in Supabase and local store (playerStore)
                await Promise.all([
                    playerStore.updatePlayerEloStats(player1Id, player1UpdatedStats),
                    playerStore.updatePlayerEloStats(player2Id, player2UpdatedStats),
                    playerStore.updatePlayerStats(player1Id, winner === player1Id), // For wins/losses
                    playerStore.updatePlayerStats(player2Id, winner === player2Id), // For wins/losses
                    statsStore.updatePlayerStreak(player1Id, winner === player1Id),
                    statsStore.updatePlayerStreak(player2Id, winner === player2Id),
                    statsStore.addRankingChange({
                        playerId: player1Id,
                        oldRating: oldPlayer1Rating,
                        newRating: player1UpdatedStats.rating,
                        change: player1UpdatedStats.rating - oldPlayer1Rating,
                        date: matchDate.toISOString(),
                        matchId: newMatch.id
                    }),
                    statsStore.addRankingChange({
                        playerId: player2Id,
                        oldRating: oldPlayer2Rating,
                        newRating: player2UpdatedStats.rating,
                        change: player2UpdatedStats.rating - oldPlayer2Rating,
                        date: matchDate.toISOString(),
                        matchId: newMatch.id
                    })
                ]);

                // Fetch the possibly updated player objects from the store for notifications
                const updatedPlayer1 = playerStore.getPlayerById(player1Id) || player1;
                const updatedPlayer2 = playerStore.getPlayerById(player2Id) || player2;

                try {
                    if (newMatch && updatedPlayer1 && updatedPlayer2) {
                        const winnerNickname =
                            newMatch.winner === player1Id ? updatedPlayer1.nickname : updatedPlayer2.nickname;

                        const loserNickname =
                            newMatch.winner === player1Id ? updatedPlayer2.nickname : updatedPlayer1.nickname;

                        await dispatchSystemNotification('match_won', {
                            notification_type: 'match_won',
                            winnerNickname,
                            loserNickname,
                            matchId: newMatch.id,
                        });
                    }
                } catch (error) {
                    console.warn("Non-critical error in addMatch [dispatchSystemNotification]:", error);
                }

                try {
                    await sendMatchResultNotification(newMatch, updatedPlayer1, updatedPlayer2);
                } catch (error) {
                    console.warn("Non-critical error in addMatch [sendMatchResultNotification]:", error);
                }

                try {
                    // Use the new rating from player1UpdatedStats for comparison
                    if (player1UpdatedStats && Math.abs(player1UpdatedStats.rating - oldPlayer1Rating) >= 15) {
                        await sendRankingChangeNotification(updatedPlayer1, oldPlayer1Rating, player1UpdatedStats.rating);
                    }
                } catch (error) {
                    console.warn("Non-critical error in addMatch [sendRankingChangeNotification player1]:", error);
                }

                try {
                    // Use the new rating from player2UpdatedStats for comparison
                    if (player2UpdatedStats && Math.abs(player2UpdatedStats.rating - oldPlayer2Rating) >= 15) {
                        await sendRankingChangeNotification(updatedPlayer2, oldPlayer2Rating, player2UpdatedStats.rating);
                    }
                } catch (error) {
                    console.warn("Non-critical error in addMatch [sendRankingChangeNotification player2]:", error);
                }

                let player1Achievements: Achievement[] | undefined;
                let player2Achievements: Achievement[] | undefined;

                try {
                    player1Achievements = await achievementStore.checkAndUpdateAchievements(player1Id);
                } catch (error) {
                    console.warn(/*...*/);
                }

                try {
                    player2Achievements = await achievementStore.checkAndUpdateAchievements(player2Id);
                } catch (error) {
                    console.warn(/*...*/);
                }

                try {
                    if (Array.isArray(player1Achievements)) {
                        player1Achievements.forEach((achievement: Achievement) => {
                            sendAchievementNotification(updatedPlayer1, achievement);
                            // Dispatch system notification for chat
                            dispatchSystemNotification('achievement_unlocked', {
                                notification_type: 'achievement_unlocked',
                                achieverNickname: updatedPlayer1.nickname,
                                achievementName: achievement.name,
                                achievementId: achievement.id,
                            }).catch(e => console.warn("Failed to dispatch achievement notification for player 1", e));
                        });
                    }
                } catch (error) {
                    console.warn("Error processing player 1 achievements notifications:", error);
                }

                try {
                    if (Array.isArray(player2Achievements)) {
                        player2Achievements.forEach((achievement: Achievement) => {
                            sendAchievementNotification(updatedPlayer2, achievement);
                            dispatchSystemNotification('achievement_unlocked', {
                                notification_type: 'achievement_unlocked',
                                achieverNickname: updatedPlayer2.nickname,
                                achievementName: achievement.name,
                                achievementId: achievement.id,
                            }).catch(e => console.warn("Failed to dispatch achievement notification for player 2", e));
                        });
                    }
                } catch (error) {
                    console.warn("Error processing player 2 achievements notifications:", error);
                }

                set({isLoading: false});
                return newMatch;

            } catch (error) {
                console.error("Error in addMatch:", error);
                set({
                    isLoading: false,
                    error: error instanceof Error ? error.message : "Failed to add match"
                });
                throw error;
            }
        },

        getMatchById: (matchId) => {
            return get().matches.find((match) => match.id === matchId);
        },

        getMatchesByPlayerId: (playerId) => {
            return get().matches.filter(
                (match) => match.player1Id === playerId || match.player2Id === playerId
            ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        },

        getRecentMatches: (limit = 10) => {
            return [...get().matches]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, limit);
        },

        getHeadToHead: (player1Id, player2Id) => {
            const matches = get().matches.filter(
                (match) =>
                    (match.player1Id === player1Id && match.player2Id === player2Id) ||
                    (match.player1Id === player2Id && match.player2Id === player1Id)
            ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const player1Wins = matches.filter(
                (match) => match.winner === player1Id
            ).length;

            const player2Wins = matches.filter(
                (match) => match.winner === player2Id
            ).length;

            return {
                player1Id,
                player2Id,
                player1Wins,
                player2Wins,
                matches,
            };
        },
    }),
);

export const fetchMatchesFromSupabase = async () => {
    useMatchStore.setState({isLoading: true, error: null});
    try {
        const {data, error} = await supabase.from('matches').select('*');
        if (error) throw error;
        const matches: Match[] = data.map((item: any) => ({
            id: item.id,
            player1Id: item.player1_id,
            player2Id: item.player2_id,
            player1Score: item.player1_score,
            player2Score: item.player2_score,
            sets: typeof item.sets === 'string' ? JSON.parse(item.sets) : item.sets,
            winner: item.winner,
            winnerId: item.winner,
            date: item.date,
            tournamentId: item.tournament_id,
        }));
        useMatchStore.setState({matches, isLoading: false});
    } catch (error) {
        useMatchStore.setState({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to fetch matches"
        });
    }
};

export const useMatchesRealtime = () => {
    useEffect(() => {
        const channel = supabase
            .channel('matches-changes')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'matches'},
                () => {
                    fetchMatchesFromSupabase().catch((e) => {
                        console.warn("Error fetching matches from Supabase:", e);
                    })
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel).catch(e =>
                console.error("Error removing matches channel:", e));
        };
    }, []);
};
