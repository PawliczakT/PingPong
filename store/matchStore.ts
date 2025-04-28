import {create} from "zustand";
import {Achievement, HeadToHead, Match, Set} from "@/types";
import {usePlayerStore} from "./playerStore";
import {useNotificationStore} from "./notificationStore";
import {calculateEloRating} from "@/utils/elo";
import {supabase} from "@/lib/supabase";
import {useEffect} from "react";

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
                const notificationStore = useNotificationStore.getState();
                const achievementStore = require("./achievementStore").useAchievementStore.getState();

                const player1 = playerStore.getPlayerById(player1Id);
                const player2 = playerStore.getPlayerById(player2Id);

                if (!player1 || !player2) {
                    throw new Error("Player not found");
                }

                const {player1NewRating, player2NewRating} = calculateEloRating(
                    player1.eloRating,
                    player2.eloRating,
                    winner === player1Id
                );

                const {data, error: insertError} = await supabase.from('matches').insert([
                    {
                        player1_id: player1Id,
                        player2_id: player2Id,
                        player1_score: player1Score,
                        player2_score: player2Score,
                        sets: sets,
                        winner: winner,
                        tournament_id: tournamentId,
                        date: new Date().toISOString(),
                    }
                ]).select().single();

                if (insertError) throw insertError;

                newMatch = {
                    id: data.id,
                    player1Id: data.player1_id,
                    player2Id: data.player2_id,
                    player1Score: data.player1_score,
                    player2Score: data.player2_score,
                    sets: data.sets,
                    winner: data.winner,
                    date: data.date,
                    tournamentId: data.tournament_id,
                };

                await Promise.all([
                    playerStore.updatePlayerRating(player1Id, player1NewRating),
                    playerStore.updatePlayerRating(player2Id, player2NewRating),
                    playerStore.updatePlayerStats(player1Id, winner === player1Id),
                    playerStore.updatePlayerStats(player2Id, winner === player2Id),
                    statsStore.updatePlayerStreak(player1Id, winner === player1Id),
                    statsStore.updatePlayerStreak(player2Id, winner === player2Id),
                    statsStore.addRankingChange({
                        playerId: player1Id,
                        oldRating: player1.eloRating,
                        newRating: player1NewRating,
                        change: player1NewRating - player1.eloRating,
                        date: new Date().toISOString(),
                        matchId: newMatch.id
                    }),
                    statsStore.addRankingChange({
                        playerId: player2Id,
                        oldRating: player2.eloRating,
                        newRating: player2NewRating,
                        change: player2NewRating - player2.eloRating,
                        date: new Date().toISOString(),
                        matchId: newMatch.id
                    })
                ]);

                const updatedPlayer1 = playerStore.getPlayerById(player1Id) || player1;
                const updatedPlayer2 = playerStore.getPlayerById(player2Id) || player2;
                await notificationStore.sendMatchResultNotification(newMatch, updatedPlayer1, updatedPlayer2);

                if (Math.abs(player1NewRating - player1.eloRating) >= 15) {
                    await notificationStore.sendRankingChangeNotification(updatedPlayer1, player1.eloRating, player1NewRating);
                }
                if (Math.abs(player2NewRating - player2.eloRating) >= 15) {
                    await notificationStore.sendRankingChangeNotification(updatedPlayer2, player2.eloRating, player2NewRating);
                }

                const [player1Achievements, player2Achievements] = await Promise.all([
                    achievementStore.checkAndUpdateAchievements(player1Id),
                    achievementStore.checkAndUpdateAchievements(player2Id)
                ]);

                if (Array.isArray(player1Achievements)) {
                    player1Achievements.forEach((achievement: Achievement) => {
                        notificationStore.sendAchievementNotification(updatedPlayer1, achievement);
                    });
                }
                if (Array.isArray(player2Achievements)) {
                    player2Achievements.forEach((achievement: Achievement) => {
                        notificationStore.sendAchievementNotification(updatedPlayer2, achievement);
                    });
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
            supabase.removeChannel(channel).then(r =>
                console.error("Error removing matches channel:", r));
        };
    }, []);
};
