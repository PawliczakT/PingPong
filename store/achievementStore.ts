import {create} from "zustand";
import {Achievement, AchievementProgress, AchievementType, Match, Set} from "@/types";
import {usePlayerStore} from "./playerStore";
import {useTournamentStore} from "./tournamentStore";
import {achievements} from "@/constants/achievements";
import {supabase} from "@/lib/supabase";
import {useEffect} from "react";

interface AchievementState {
    playerAchievements: Record<string, AchievementProgress[]>;
    isLoading: boolean;
    error: string | null;

    initializePlayerAchievements: (playerId: string) => void;
    updateAchievementProgress: (playerId: string, achievementType: AchievementType, progress: number) => void;
    unlockAchievement: (playerId: string, achievementType: AchievementType) => Promise<Achievement | null>;
    getPlayerAchievements: (playerId: string) => AchievementProgress[];
    getUnlockedAchievements: (playerId: string) => Achievement[];
    checkAndUpdateAchievements: (playerId: string) => Promise<Achievement[]>;
}

export const useAchievementStore = create<AchievementState>()(
    (set, get) => ({

        playerAchievements: {},
        isLoading: false,
        error: null,

        initializePlayerAchievements: (playerId) => {
            if (!get().playerAchievements[playerId]) {
                set((state) => ({
                    playerAchievements: {
                        ...state.playerAchievements,
                        [playerId]: achievements.map(achievement => ({
                            type: achievement.type,
                            progress: 0,
                            unlocked: false,
                            unlockedAt: null,
                        })),
                    },
                }));
            }
        },

        updateAchievementProgress: (playerId, achievementType, progress) => {
            set((state) => {
                if (!state.playerAchievements[playerId]) {
                    get().initializePlayerAchievements(playerId);
                }

                const updatedAchievements = state.playerAchievements[playerId].map(achievement => {
                    if (achievement.type === achievementType && !achievement.unlocked) {
                        return {
                            ...achievement,
                            progress: Math.max(achievement.progress, progress),
                        };
                    }
                    return achievement;
                });

                return {
                    playerAchievements: {
                        ...state.playerAchievements,
                        [playerId]: updatedAchievements,
                    },
                };
            });
        },

        unlockAchievement: async (playerId, achievementType) => {
            const achievementDef = achievements.find(a => a.type === achievementType);
            if (!achievementDef) return null;
            set({isLoading: true, error: null});
            try {
                const {error} = await supabase.from('achievements').upsert({
                    player_id: playerId,
                    type: achievementType,
                    progress: achievementDef.target,
                    unlocked: true,
                    unlocked_at: new Date().toISOString(),
                }, {onConflict: 'player_id,type'});
                if (error) throw error;
                set((state) => {
                    const updatedAchievements = state.playerAchievements[playerId]?.map(achievement => {
                        if (achievement.type === achievementType && !achievement.unlocked) {
                            return {
                                ...achievement,
                                progress: achievementDef.target,
                                unlocked: true,
                                unlockedAt: new Date().toISOString(),
                            };
                        }
                        return achievement;
                    }) || [];
                    return {
                        playerAchievements: {
                            ...state.playerAchievements,
                            [playerId]: updatedAchievements,
                        },
                        isLoading: false,
                    };
                });
                return achievementDef;
            } catch (error) {
                set({isLoading: false, error: error instanceof Error ? error.message : "Failed to unlock achievement"});
                return null;
            }
        },

        getPlayerAchievements: (playerId) => {
            if (!get().playerAchievements[playerId]) {
                get().initializePlayerAchievements(playerId);
            }
            return get().playerAchievements[playerId] || [];
        },

        getUnlockedAchievements: (playerId) => {
            const playerAchievements = get().getPlayerAchievements(playerId);
            const unlockedTypes = playerAchievements
                .filter(a => a.unlocked)
                .map(a => a.type);

            return achievements.filter(a => unlockedTypes.includes(a.type));
        },

        checkAndUpdateAchievements: async (playerId) => {
            const playerStore = usePlayerStore.getState();
            const matchStore = require("./matchStore").useMatchStore.getState();
            const tournamentStore = useTournamentStore.getState();

            const player = playerStore.getPlayerById(playerId);
            if (!player) return [];

            get().initializePlayerAchievements(playerId);

            const playerMatches = matchStore.getMatchesByPlayerId(playerId);
            const playerWins = player.wins;
            const playerLosses = player.losses;
            const totalMatches = playerWins + playerLosses;

            const tournamentsWon = tournamentStore.tournaments.filter(t => t.winner === playerId).length;

            let currentStreak = 0;
            let isWinStreak = true;

            const sortedMatches = [...playerMatches].sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            for (const match of sortedMatches) {
                const isWin = match.winner === playerId;

                if (currentStreak === 0) {
                    currentStreak = 1;
                    isWinStreak = isWin;
                } else if (isWin === isWinStreak) {
                    currentStreak++;
                } else {
                    break;
                }
            }

            let longestWinStreak = 0;
            let currentWinStreak = 0;

            const chronologicalMatches = [...sortedMatches].reverse();

            for (const match of chronologicalMatches) {
                if (match.winner === playerId) {
                    currentWinStreak++;
                    longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
                } else {
                    currentWinStreak = 0;
                }
            }

            const cleanSweepMatches = playerMatches.filter((match: Match) => {
                if (match.winner !== playerId) return false;

                const playerIsPlayer1 = match.player1Id === playerId;
                return match.sets.every((set: Set) =>
                    playerIsPlayer1
                        ? set.player1Score > set.player2Score
                        : set.player2Score > set.player1Score
                );
            }).length;

            const topPlayerIds = playerStore.getActivePlayersSortedByRating()
                .slice(0, 3)
                .map(p => p.id)
                .filter(id => id !== playerId);

            const topPlayerDefeats = playerMatches.filter((match: Match) => {
                const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;
                return match.winner === playerId && topPlayerIds.includes(opponentId);
            }).length;

            const progressUpdates = [
                {type: AchievementType.FIRST_WIN, progress: playerWins > 0 ? 1 : 0},
                {type: AchievementType.WINS_10, progress: playerWins},
                {type: AchievementType.WINS_25, progress: playerWins},
                {type: AchievementType.WINS_50, progress: playerWins},
                {type: AchievementType.MATCHES_10, progress: totalMatches},
                {type: AchievementType.MATCHES_25, progress: totalMatches},
                {type: AchievementType.MATCHES_50, progress: totalMatches},
                {type: AchievementType.MATCHES_100, progress: totalMatches},
                {type: AchievementType.WIN_STREAK_3, progress: isWinStreak ? currentStreak : 0},
                {type: AchievementType.WIN_STREAK_5, progress: isWinStreak ? currentStreak : 0},
                {type: AchievementType.WIN_STREAK_10, progress: isWinStreak ? currentStreak : 0},
                {type: AchievementType.LONGEST_STREAK_5, progress: longestWinStreak},
                {type: AchievementType.LONGEST_STREAK_10, progress: longestWinStreak},
                {type: AchievementType.TOURNAMENT_WIN, progress: tournamentsWon},
                {type: AchievementType.TOURNAMENT_WINS_3, progress: tournamentsWon},
                {type: AchievementType.TOURNAMENT_WINS_5, progress: tournamentsWon},
                {type: AchievementType.CLEAN_SWEEP, progress: cleanSweepMatches},
                {type: AchievementType.CLEAN_SWEEPS_5, progress: cleanSweepMatches},
                {type: AchievementType.CLEAN_SWEEPS_10, progress: cleanSweepMatches},
                {type: AchievementType.DEFEAT_TOP_PLAYER, progress: topPlayerDefeats},
                {type: AchievementType.DEFEAT_TOP_PLAYERS_5, progress: topPlayerDefeats},
                {type: AchievementType.DEFEAT_TOP_PLAYERS_10, progress: topPlayerDefeats},
            ];

            progressUpdates.forEach(update => {
                get().updateAchievementProgress(playerId, update.type, update.progress);
            });

            const achievementDefs = achievements;
            const playerAchievements = get().getPlayerAchievements(playerId);

            const newlyUnlocked: Achievement[] = [];

            for (const achievement of playerAchievements) {
                if (!achievement.unlocked) {
                    const def = achievementDefs.find(a => a.type === achievement.type);
                    if (def && achievement.progress >= def.target) {
                        const unlocked = await get().unlockAchievement(playerId, achievement.type);
                        if (unlocked) {
                            newlyUnlocked.push(unlocked);
                        }
                    }
                }
            }

            return newlyUnlocked;
        },
    }),
);

export const fetchAchievementsFromSupabase = async () => {
    useAchievementStore.setState({isLoading: true, error: null});
    try {
        const {data, error} = await supabase.from('achievements').select('*');
        if (error) throw error;
        const playerAchievements: Record<string, AchievementProgress[]> = {};
        data.forEach((item: any) => {
            if (!playerAchievements[item.player_id]) playerAchievements[item.player_id] = [];
            playerAchievements[item.player_id].push({
                type: item.type,
                progress: item.progress,
                unlocked: item.unlocked,
                unlockedAt: item.unlocked_at,
            });
        });
        useAchievementStore.setState({playerAchievements, isLoading: false});
    } catch (error) {
        useAchievementStore.setState({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to fetch achievements"
        });
    }
};

export const useAchievementsRealtime = () => {
    useEffect(() => {
        const channel = supabase
            .channel('achievements-changes')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'achievements'},
                () => {
                    fetchAchievementsFromSupabase().catch((e) => {
                        console.error("Error fetching achievements:", e);
                    });
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel).catch((e) => {
                console.error("Error removing channel:", e);
            });
        };
    }, []);
};
