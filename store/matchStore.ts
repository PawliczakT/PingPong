import {create} from "zustand";
import {HeadToHead, Match, Player, Set} from "@/types";
import {usePlayerStore} from "./playerStore";
import {useStatsStore} from "./statsStore";
import {useNotificationStore} from "./notificationStore";
import {useAchievementStore} from "./achievementStore";
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
            let newMatch: Match;

            try {
                const winner = player1Score > player2Score ? player1Id : player2Id;
                const playerStore = usePlayerStore.getState();
                const statsStore = useStatsStore.getState();
                const notificationStore = useNotificationStore.getState();
                const achievementStore = useAchievementStore.getState();

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

                // 1. Zapisz mecz do bazy danych
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
                    winnerId: data.winner,
                    winner: data.winner,
                    date: data.date,
                    tournamentId: data.tournament_id,
                    isComplete: true
                };

                // 2. Wykonaj operacje w batchu zamiast indywidualnie
                // Przygotuj batch dla rankingów graczy do aktualizacji w jednym zapytaniu
                const batchUpdates = [
                    {id: player1Id, rating: player1NewRating, won: winner === player1Id},
                    {id: player2Id, rating: player2NewRating, won: winner === player2Id}
                ];

                // Przygotuj dane dla historii rankingu
                const rankingChanges = [
                    {
                        player_id: player1Id,
                        old_rating: player1.eloRating,
                        new_rating: player1NewRating,
                        change: player1NewRating - player1.eloRating,
                        date: new Date().toISOString(),
                        match_id: newMatch.id
                    },
                    {
                        player_id: player2Id,
                        old_rating: player2.eloRating,
                        new_rating: player2NewRating,
                        change: player2NewRating - player2.eloRating,
                        date: new Date().toISOString(),
                        match_id: newMatch.id
                    }
                ];

                // Wykonaj wszystkie aktualizacje bazy danych równolegle
                await Promise.all([
                    // Aktualizuj rating i statystyki graczy w jednym zapytaniu dla każdego gracza
                    supabase.from('players').update({
                        elo_rating: player1NewRating,
                        wins: player1.wins + (winner === player1Id ? 1 : 0),
                        losses: player1.losses + (winner === player1Id ? 0 : 1)
                    }).eq('id', player1Id),

                    supabase.from('players').update({
                        elo_rating: player2NewRating,
                        wins: player2.wins + (winner === player2Id ? 1 : 0),
                        losses: player2.losses + (winner === player2Id ? 0 : 1)
                    }).eq('id', player2Id),

                    // Dodaj zmiany rankingu jednym zapytaniem
                    supabase.from('ranking_history').insert(rankingChanges),

                    // Aktualizuj serie zwycięstw
                    statsStore.updatePlayerStreak(player1Id, winner === player1Id),
                    statsStore.updatePlayerStreak(player2Id, winner === player2Id)
                ]);

                // 3. Aktualizuj lokalny stan graczy na podstawie dokonanych zmian
                // Nie ma potrzeby pobierać graczy ponownie z bazy danych
                const updatedPlayer1: Player = {
                    ...player1,
                    eloRating: player1NewRating,
                    wins: player1.wins + (winner === player1Id ? 1 : 0),
                    losses: player1.losses + (winner === player1Id ? 0 : 1)
                };

                const updatedPlayer2: Player = {
                    ...player2,
                    eloRating: player2NewRating,
                    wins: player2.wins + (winner === player2Id ? 1 : 0),
                    losses: player2.losses + (winner === player2Id ? 0 : 1)
                };

                // Zaktualizuj lokalny stan graczy
                const playerStoreSet = usePlayerStore.setState;
                playerStoreSet(state => ({
                    ...state,
                    players: state.players.map(p => {
                        if (p.id === player1Id) return updatedPlayer1;
                        if (p.id === player2Id) return updatedPlayer2;
                        return p;
                    })
                }));

                // 4. Wykonaj operacje UI w tle (powiadomienia i osiągnięcia)
                // Te operacje mogą być wykonane asynchronicznie, bez czekania na ich zakończenie
                Promise.all([
                    notificationStore.sendMatchResultNotification(newMatch, updatedPlayer1, updatedPlayer2),

                    // Wysyłaj powiadomienia o zmianie rankingu tylko jeśli zmiana jest znacząca
                    Math.abs(player1NewRating - player1.eloRating) >= 15 ?
                        notificationStore.sendRankingChangeNotification(updatedPlayer1, player1.eloRating, player1NewRating) :
                        Promise.resolve(),

                    Math.abs(player2NewRating - player2.eloRating) >= 15 ?
                        notificationStore.sendRankingChangeNotification(updatedPlayer2, player2.eloRating, player2NewRating) :
                        Promise.resolve(),

                    // Sprawdź osiągnięcia w tle
                    achievementStore.checkAndUpdateAchievements(player1Id)
                        .then(achievements => {
                            if (Array.isArray(achievements)) {
                                achievements.forEach(achievement => {
                                    notificationStore.sendAchievementNotification(updatedPlayer1, achievement);
                                });
                            }
                        }),

                    achievementStore.checkAndUpdateAchievements(player2Id)
                        .then(achievements => {
                            if (Array.isArray(achievements)) {
                                achievements.forEach(achievement => {
                                    notificationStore.sendAchievementNotification(updatedPlayer2, achievement);
                                });
                            }
                        })
                ]).catch(err => console.error("Background operations error:", err));

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
            winnerId: item.winner,
            winner: item.winner,
            date: item.date,
            tournamentId: item.tournament_id,
            isComplete: true
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
