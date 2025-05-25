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
            console.log('[MatchStore] Adding match with ID:', `temp-${Date.now()}`);
            set({isLoading: true, error: null});

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

                // Tymczasowy ID dla natychmiastowej aktualizacji UI
                const tempId = `temp-${Date.now()}`;

                // Tymczasowy mecz do natychmiastowej aktualizacji UI
                const tempMatch: Match = {
                    id: tempId,
                    player1Id,
                    player2Id,
                    player1Score,
                    player2Score,
                    sets,
                    winner: winner,
                    winnerId: winner === player1Id ? 1 : 2,
                    date: new Date().toISOString(),
                    tournamentId,
                };

                // Natychmiastowa aktualizacja lokalnego stanu
                set(state => ({
                    matches: [tempMatch, ...state.matches]
                }));

                // Asynchroniczne zapisywanie w bazie danych
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

                const newMatch: Match = {
                    id: data.id,
                    player1Id: data.player1_id,
                    player2Id: data.player2_id,
                    player1Score: data.player1_score,
                    player2Score: data.player2_score,
                    sets: data.sets,
                    winner: data.winner,
                    winnerId: data.winner === player1Id ? 1 : 2,
                    date: data.date,
                    tournamentId: data.tournament_id,
                };

                console.log('[MatchStore] Added match with ID:', newMatch.id);

                // Aktualizacja lokalnego stanu - zastąpienie tymczasowego meczu rzeczywistym
                set(state => ({
                    matches: state.matches.map(m => m.id === tempId ? newMatch : m)
                }));

                // Aktualizacja danych graczy i statystyk w tle
                Promise.all([
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
                ]).catch(error => {
                    console.error("Error updating player data:", error);
                });

                const updatedPlayer1 = playerStore.getPlayerById(player1Id) || player1;
                const updatedPlayer2 = playerStore.getPlayerById(player2Id) || player2;

                // Powiadomienia i osiągnięcia w tle - to może działać asynchronicznie
                Promise.all([
                    notificationStore.sendMatchResultNotification(newMatch, updatedPlayer1, updatedPlayer2),
                    Math.abs(player1NewRating - player1.eloRating) >= 15 ?
                        notificationStore.sendRankingChangeNotification(updatedPlayer1, player1.eloRating, player1NewRating) : Promise.resolve(),
                    Math.abs(player2NewRating - player2.eloRating) >= 15 ?
                        notificationStore.sendRankingChangeNotification(updatedPlayer2, player2.eloRating, player2NewRating) : Promise.resolve(),
                    achievementStore.checkAndUpdateAchievements(player1Id).then((achievements: Achievement[] | undefined) => {
                        if (Array.isArray(achievements)) {
                            achievements.forEach((achievement: Achievement) => {
                                notificationStore.sendAchievementNotification(updatedPlayer1, achievement);
                            });
                        }
                    }),
                    achievementStore.checkAndUpdateAchievements(player2Id).then((achievements: Achievement[] | undefined) => {
                        if (Array.isArray(achievements)) {
                            achievements.forEach((achievement: Achievement) => {
                                notificationStore.sendAchievementNotification(updatedPlayer2, achievement);
                            });
                        }
                    })
                ]).catch(error => {
                    console.error("Error processing match aftermath:", error);
                }).finally(() => {
                    set({isLoading: false});
                });

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

        getRecentMatches: (limit = 3) => {
            console.log('[MatchStore] Getting recent matches, limit:', limit);
            // Filter out duplicates by ID before sorting and limiting
            const uniqueMatches = Array.from(
                new Map(get().matches.map(match => [match.id, match]))
                .values()
            );
            
            console.log('[MatchStore] Total unique matches:', uniqueMatches.length);
            
            return uniqueMatches
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
            winnerId: item.winner === item.player1_id ? 1 : 2,
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
                {event: 'INSERT', schema: 'public', table: 'matches'},
                (payload) => {
                    // Tylko dodaj nowy mecz zamiast pobierać wszystkie
                    const newMatch: Match = {
                        id: payload.new.id,
                        player1Id: payload.new.player1_id,
                        player2Id: payload.new.player2_id,
                        player1Score: payload.new.player1_score,
                        player2Score: payload.new.player2_score,
                        sets: typeof payload.new.sets === 'string' ?
                            JSON.parse(payload.new.sets) : payload.new.sets,
                        winner: payload.new.winner,
                        winnerId: payload.new.winner === payload.new.player1_id ? 1 : 2,
                        date: payload.new.date,
                        tournamentId: payload.new.tournament_id,
                    };

                    console.log('[MatchStore] Added match with ID:', newMatch.id);

                    useMatchStore.setState(state => ({
                        matches: [newMatch, ...state.matches]
                    }));
                }
            )
            .on(
                'postgres_changes',
                {event: 'UPDATE', schema: 'public', table: 'matches'},
                (payload) => {
                    // Aktualizuj konkretny mecz zamiast pobierać wszystkie
                    const updatedMatch: Match = {
                        id: payload.new.id,
                        player1Id: payload.new.player1_id,
                        player2Id: payload.new.player2_id,
                        player1Score: payload.new.player1_score,
                        player2Score: payload.new.player2_score,
                        sets: typeof payload.new.sets === 'string' ?
                            JSON.parse(payload.new.sets) : payload.new.sets,
                        winner: payload.new.winner,
                        winnerId: payload.new.winner === payload.new.player1_id ? 1 : 2,
                        date: payload.new.date,
                        tournamentId: payload.new.tournament_id,
                    };

                    useMatchStore.setState(state => ({
                        matches: state.matches.map(m =>
                            m.id === updatedMatch.id ? updatedMatch : m
                        )
                    }));
                }
            )
            .on(
                'postgres_changes',
                {event: 'DELETE', schema: 'public', table: 'matches'},
                (payload) => {
                    // Usuń konkretny mecz zamiast pobierać wszystkie
                    useMatchStore.setState(state => ({
                        matches: state.matches.filter(m => m.id !== payload.old.id)
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel).catch(error =>
                console.error("Error removing matches channel:", error));
        };
    }, []);
};
