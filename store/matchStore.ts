//store/matchStore.ts
import {create} from "zustand";
import {Achievement, HeadToHead, Match, Set} from "@/backend/types";
import {usePlayerStore} from "./playerStore";
import {dispatchSystemNotification} from '@/app/services/notificationService';
import {
    sendAchievementNotification,
    sendMatchResultNotification,
    sendRankingChangeNotification
} from "./notificationStore";
import {supabase} from '@/app/lib/supabase';
import {useEffect} from "react";
import {Json} from "@/backend/types/supabase";
import {useEloStore} from "@/store/eloStore";

interface AddMatchData {
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    sets: Set[];
    tournamentId?: string;
}

interface MatchState {
    matches: Match[];
    isLoading: boolean;
    error: string | null;
    addMatch: (data: AddMatchData) => Promise<Match>;
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

        addMatch: async (data) => {
            const {player1Id, player2Id, player1Score, player2Score, sets, tournamentId} = data;
            set({isLoading: true, error: null});
            let newMatch: Match | null = null;

            try {
                const winnerId = player1Score > player2Score ? player1Id : player2Id;
                const loserId = player1Score > player2Score ? player2Id : player1Id;

                const playerStore = usePlayerStore.getState();
                const statsStore = require("./statsStore").useStatsStore.getState();
                const achievementStore = require("./achievementStore").useAchievementStore.getState();
                const eloStore = useEloStore.getState();

                const player1 = playerStore.getPlayerById(player1Id);
                const player2 = playerStore.getPlayerById(player2Id);

                if (!player1 || !player2) {
                    throw new Error("Player not found");
                }

                const {data: insertData, error: insertError} = await supabase.from('matches').insert([
                    {
                        player1_id: player1Id,
                        player2_id: player2Id,
                        player1_score: player1Score,
                        player2_score: player2Score,
                        sets: sets as unknown as Json,
                        winner: winnerId,
                        tournament_id: tournamentId,
                        date: new Date().toISOString(),
                    }
                ]).select().single();

                if (insertError) throw insertError;

                newMatch = {
                    id: insertData.id,
                    player1Id: insertData.player1_id,
                    player2Id: insertData.player2_id,
                    player1Score: insertData.player1_score,
                    player2Score: insertData.player2_score,
                    sets: insertData.sets as unknown as Set[],
                    winner: insertData.winner,
                    winnerId: insertData.winner,
                    date: insertData.date,
                    tournamentId: insertData.tournament_id,
                };

                const matchDate = new Date(newMatch.date);
                await eloStore.updateRatingsAfterMatch(winnerId, loserId, matchDate);

                await Promise.all([
                    playerStore.updatePlayerStats(player1Id, winnerId === player1Id),
                    playerStore.updatePlayerStats(player2Id, winnerId === player2Id),
                    statsStore.updatePlayerStreak(player1Id, winnerId === player1Id),
                    statsStore.updatePlayerStreak(player2Id, winnerId === player2Id),
                ]);

                const updatedPlayer1 = playerStore.getPlayerById(player1Id) || player1;
                const updatedPlayer2 = playerStore.getPlayerById(player2Id) || player2;

                // Send ranking change notifications based on the new data from the store
                if (newMatch && updatedPlayer1 && updatedPlayer2) {
                    statsStore.addRankingChange({
                        playerId: player1Id,
                        oldRating: player1.eloRating,
                        newRating: updatedPlayer1.eloRating,
                        change: updatedPlayer1.eloRating - player1.eloRating,
                        date: new Date().toISOString(),
                        matchId: newMatch.id
                    });
                    statsStore.addRankingChange({
                        playerId: player2Id,
                        oldRating: player2.eloRating,
                        newRating: updatedPlayer2.eloRating,
                        change: updatedPlayer2.eloRating - player2.eloRating,
                        date: new Date().toISOString(),
                        matchId: newMatch.id
                    });
                }

                try {
                    if (newMatch && updatedPlayer1 && updatedPlayer2) {
                        const winnerNickname =
                            newMatch.winner === player1Id
                                ? (updatedPlayer1.nickname ?? updatedPlayer1.name)
                                : (updatedPlayer2.nickname ?? updatedPlayer2.name);

                        const loserNickname =
                            newMatch.winner === player1Id
                                ? (updatedPlayer2.nickname ?? updatedPlayer2.name)
                                : (updatedPlayer1.nickname ?? updatedPlayer1.name);

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
                    if (Math.abs(updatedPlayer1.eloRating - player1.eloRating) >= 15) {
                        await sendRankingChangeNotification(updatedPlayer1, player1.eloRating, updatedPlayer1.eloRating);
                    }
                } catch (error) {
                    console.warn("Non-critical error in addMatch [sendRankingChangeNotification player1]:", error);
                }

                try {
                    if (Math.abs(updatedPlayer2.eloRating - player2.eloRating) >= 15) {
                        await sendRankingChangeNotification(updatedPlayer2, player2.eloRating, updatedPlayer2.eloRating);
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
                                achieverNickname: updatedPlayer1.nickname!,
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
                                achieverNickname: updatedPlayer2.nickname!,
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
                    fetchMatchesFromSupabase().catch((e: unknown) => {
                        console.warn("Error fetching matches from Supabase:", e);
                    })
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel).catch((e: unknown) =>
                console.error("Error removing matches channel:", e));
        };
    }, []);
};
