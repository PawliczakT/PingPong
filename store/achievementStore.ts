import {create} from "zustand";
import {
    Achievement,
    AchievementProgress,
    AchievementType,
    DisplayAchievement,
    Match,
    Set as MatchSet,
    Tournament,
    TournamentFormat
} from "@/backend/types";
import {usePlayerStore} from "./playerStore";
import {useTournamentStore} from "./tournamentStore";
import {achievements as allAchievementDefinitions} from "@/constants/achievements";
import {supabaseAsAdmin} from '@/backend/server/lib/supabaseAdmin';
import {useEffect} from "react";
import {useMatchStore} from "./matchStore";

interface AchievementState {
    playerAchievements: Record<string, AchievementProgress[]>;
    isLoading: boolean;
    error: string | null;

    initializePlayerAchievements: (playerId: string) => void;
    updateAchievementProgress: (playerId: string, achievementType: AchievementType, progress: number) => void;
    unlockAchievement: (playerId: string, achievementType: AchievementType) => Promise<Achievement | null>;
    getPlayerAchievements: (playerId: string) => AchievementProgress[];
    getUnlockedAchievements: (playerId: string) => Achievement[];
    getDisplayAchievements: (playerId: string) => DisplayAchievement[];
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
                        [playerId]: allAchievementDefinitions.map(achievement => ({
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
                // Jeśli brak osiągnięć dla gracza, inicjalizujemy je
                if (!state.playerAchievements[playerId]) {
                    // Tworzymy nowe osiągnięcia zamiast wywołania initializePlayerAchievements
                    // ponieważ to nie gwarantuje natychmiastowej aktualizacji stanu
                    const initialAchievements = allAchievementDefinitions.map(achievement => ({
                        type: achievement.type,
                        progress: 0,
                        unlocked: false,
                        unlockedAt: null,
                    }));

                    // Aktualizujemy konkretne osiągnięcie
                    const updatedInitialAchievements = initialAchievements.map(achievement => {
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
                            [playerId]: updatedInitialAchievements,
                        },
                    };
                }

                // Jeśli osiągnięcia istnieją, aktualizujemy je
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
            const achievementDef = allAchievementDefinitions.find(a => a.type === achievementType);
            if (!achievementDef) return null;
            set({isLoading: true, error: null});
            try {
                const {error} = await supabaseAsAdmin.from('achievements').upsert({
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
            // Zwracamy istniejące osiągnięcia bez automatycznej inicjalizacji
            // Inicjalizacja powinna być wykonana w useEffect, a nie podczas renderowania
            return get().playerAchievements[playerId] || [];
        },

        getUnlockedAchievements: (playerId) => {
            const playerAchievements = get().getPlayerAchievements(playerId);
            const unlockedTypes = playerAchievements
                .filter(a => a.unlocked)
                .map(a => a.type);

            return allAchievementDefinitions.filter(a => unlockedTypes.includes(a.type));
        },

        getDisplayAchievements: (playerId) => {
            const playerProgress = get().getPlayerAchievements(playerId);
            return allAchievementDefinitions.map(def => {
                const progress = playerProgress.find(p => p.type === def.type);
                return {
                    ...def,
                    progress: progress?.progress || 0,
                    unlocked: progress?.unlocked || false,
                    unlockedAt: progress?.unlockedAt || undefined,
                };
            });
        },

        checkAndUpdateAchievements: async (playerId): Promise<Achievement[]> => {
            set({isLoading: true, error: null});
            const {playerAchievements, updateAchievementProgress, unlockAchievement} = get();
            const playerStore = usePlayerStore.getState();
            const matchStore = useMatchStore.getState();
            const tournamentStore = useTournamentStore.getState();

            const player = playerStore.getPlayerById(playerId);
            if (!player) {
                set({isLoading: false, error: "Player not found"});
                return []; // Corrected return for early exit
            }

            const playerMatches = matchStore.getMatchesByPlayerId(playerId);
            const allTournaments = tournamentStore.tournaments; // Reverted to direct property access

            // --- Basic Stats ---
            const playerWins = player.wins;
            const totalMatchesPlayed = playerMatches.length;

            // Get top players for TOP_PLAYER_DEFEAT achievement
            const allPlayers = playerStore.players;
            const topPlayers = [...allPlayers]
                .sort((a, b) => b.eloRating - a.eloRating)
                .slice(0, 3)
                .map(p => p.id)
                .filter(id => id !== playerId); // Exclude the current player

            // --- Streaks (Current and Longest) ---
            const sortedMatches = [...playerMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let currentWinStreak = 0;
            let longestWinStreak = 0;
            let currentLossStreak = 0;
            let longestLossStreak = 0;
            let tempCurrentWins = 0;
            let tempCurrentLosses = 0;

            for (const match of sortedMatches) {
                if (match.winner === playerId) {
                    tempCurrentWins++;
                    tempCurrentLosses = 0; // Reset loss streak on a win
                    if (tempCurrentWins > longestWinStreak) {
                        longestWinStreak = tempCurrentWins;
                    }
                } else {
                    tempCurrentLosses++;
                    tempCurrentWins = 0; // Reset win streak on a loss
                    if (tempCurrentLosses > longestLossStreak) {
                        longestLossStreak = tempCurrentLosses;
                    }
                }
            }
            // Determine current streak based on the last match's outcome
            if (sortedMatches.length > 0) {
                const lastMatch = sortedMatches[sortedMatches.length - 1];
                if (lastMatch.winner === playerId) {
                    currentWinStreak = tempCurrentWins;
                    currentLossStreak = 0;
                } else {
                    currentLossStreak = tempCurrentLosses;
                    currentWinStreak = 0;
                }
            }

            // --- Match Specifics ---
            let cleanSweepsCount = 0;
            let perfectSetsCount = 0;
            let nearPerfectSetsCount = 0;
            let deuceSetWinsCount = 0;
            let comebackWinsCount = 0;
            let marathonMatchesPlayedCount = 0;
            let clutchPerformerCount = 0;
            let strategistWinsCount = 0;
            let heartbreakerLossesCount = 0;
            let setComeback5PointsCount = 0;
            let topPlayerDefeatsCount = 0;
            let perfectGameCount = 0;

            playerMatches.forEach((match: Match) => {
                // Clean Sweeps (3-0 win)
                if (match.winner === playerId) {
                    const playerIsP1 = match.player1Id === playerId;
                    if (match.sets.length === 3 &&
                        ((playerIsP1 && match.player1Score === 3 && match.player2Score === 0) ||
                            (!playerIsP1 && match.player2Score === 3 && match.player1Score === 0))) {
                        cleanSweepsCount++;
                    }

                    // Perfect Sets (11-0), Near Perfect (11-1), Deuce Wins, Clutch Performer, Strategist
                    let setMarginsInMatch = new Set<number>();
                    let allSetMarginsUnique = true;
                    match.sets.forEach((set: MatchSet, index: number) => {
                        const p1WonSet = set.player1Score > set.player2Score;
                        const p2WonSet = set.player2Score > set.player1Score;
                        const playerWonThisSet = (playerIsP1 && p1WonSet) || (!playerIsP1 && p2WonSet);

                        if (playerWonThisSet) {
                            const pScore = playerIsP1 ? set.player1Score : set.player2Score;
                            const oScore = playerIsP1 ? set.player2Score : set.player1Score;

                            if (pScore === 11 && oScore === 0) perfectSetsCount++;
                            if (pScore === 11 && oScore === 1) nearPerfectSetsCount++;
                            if (pScore >= 11 && oScore >= 10 && pScore - oScore === 2) deuceSetWinsCount++;

                            // Clutch Performer: Won the deciding set
                            // Best of 3: 2 sets to win, deciding is 3rd. Best of 5: 3 sets to win, deciding is 5th.
                            const setsToWinMatch = (match.player1Score + match.player2Score) < 3 ? 2 : Math.ceil((match.player1Score + match.player2Score) / 2) + ((match.player1Score + match.player2Score) % 2 === 0 ? 1 : 0); // Simplified, assumes Bo3 or Bo5 based on total sets played
                            // A more robust way for deciding set: if player won, and total sets played is odd (e.g. 2-1 in Bo3, 3-2 in Bo5)
                            // And this is the last set of the match
                            if ((match.player1Score + match.player2Score) % 2 !== 0 && index === match.sets.length - 1) {
                                if ((playerIsP1 && match.player1Score > match.player2Score) || (!playerIsP1 && match.player2Score > match.player1Score)) {
                                    clutchPerformerCount++;
                                }
                            }
                        }
                        // Strategist Win: Check set margins
                        const margin = Math.abs(set.player1Score - set.player2Score);
                        if (setMarginsInMatch.has(margin)) {
                            allSetMarginsUnique = false;
                        }
                        setMarginsInMatch.add(margin);
                    });
                    if (match.winner === playerId && allSetMarginsUnique && match.sets.length > 0) {
                        strategistWinsCount++;
                    }
                }

                // Comeback King (win after being 2 sets down - assumes best of 5 for simplicity)
                if (match.winner === playerId && match.sets.length >= 3) { // Must win at least 3 sets
                    let pSets = 0, oSets = 0;
                    let wasTwoSetsDown = false;
                    for (let i = 0; i < match.sets.length; i++) {
                        const set = match.sets[i];
                        const playerIsP1 = match.player1Id === playerId;
                        if ((playerIsP1 && set.player1Score > set.player2Score) || (!playerIsP1 && set.player2Score > set.player1Score)) {
                            pSets++;
                        } else {
                            oSets++;
                        }
                        if (i < match.sets.length - 1) { // Don't check after the last set that player won
                            if (oSets - pSets >= 2) wasTwoSetsDown = true;
                        }
                    }
                    if (wasTwoSetsDown && pSets > oSets) comebackWinsCount++;
                }

                // Marathon Match (5 sets played)
                if (match.sets.length === 5) marathonMatchesPlayedCount++;

                // Heartbreaker Loss (lose 10-12 in deciding set of a 5-set match)
                if (match.winner !== playerId && match.sets.length === 5) {
                    const lastSet = match.sets[4];
                    const playerIsP1 = match.player1Id === playerId;
                    const pScore = playerIsP1 ? lastSet.player1Score : lastSet.player2Score;
                    const oScore = playerIsP1 ? lastSet.player2Score : lastSet.player1Score;
                    if (pScore === 10 && oScore === 12) heartbreakerLossesCount++;
                }

                // SET_COMEBACK_5_POINTS: Check for comebacks within a set
                // This is an approximation as we don't have point-by-point data
                // Assumes if final score is 11-7 or better after being down, it was likely a comeback
                if (match.winner === playerId) {
                    const playerIsP1 = match.player1Id === playerId;
                    match.sets.forEach((set: MatchSet) => {
                        const pScore = playerIsP1 ? set.player1Score : set.player2Score;
                        const oScore = playerIsP1 ? set.player2Score : set.player1Score;
                        if (pScore === 11 && oScore <= 7) {
                            setComeback5PointsCount++;
                        }
                    });
                }

                // TOP_PLAYER_DEFEAT: Check if defeated a top player
                if (match.winner === playerId) {
                    const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;
                    if (topPlayers.includes(opponentId)) {
                        topPlayerDefeatsCount++;
                    }
                }

                // PERFECT_GAME_FLAWLESS: Check if opponent scored 0 in all sets
                if (match.winner === playerId) {
                    let perfectGame = match.sets.length > 0;
                    for (const set of match.sets) {
                        const opponentScore = match.player1Id === playerId ? set.player2Score : set.player1Score;
                        if (opponentScore > 0) {
                            perfectGame = false;
                            break;
                        }
                    }
                    if (perfectGame) perfectGameCount++;
                }
            });

            // Bounce Back Wins (win after a loss - use sortedMatches)
            let bounceBackWinsCount = 0;
            for (let i = 1; i < sortedMatches.length; i++) {
                if (sortedMatches[i - 1].winner !== playerId && sortedMatches[i].winner === playerId) {
                    bounceBackWinsCount++;
                }
            }

            // --- Social & Engagement ---
            const uniqueOpponents = new Set<string>();
            const opponentPlayCounts: Record<string, number> = {};
            playerMatches.forEach((match: Match) => {
                const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;
                if (opponentId) {
                    uniqueOpponents.add(opponentId);
                    opponentPlayCounts[opponentId] = (opponentPlayCounts[opponentId] || 0) + 1;
                }
            });
            const uniqueOpponentsCount = uniqueOpponents.size;
            const maxGamesAgainstOneOpponent = Math.max(0, ...Object.values(opponentPlayCounts));

            // --- Activity ---
            const matchesPerDay: Record<string, number> = {};
            playerMatches.forEach((match: Match) => {
                const matchDate = new Date(match.date).toISOString().split('T')[0];
                matchesPerDay[matchDate] = (matchesPerDay[matchDate] || 0) + 1;
            });
            const maxMatchesInSingleDay = Math.max(0, ...Object.values(matchesPerDay));

            // --- Tournament Stats ---
            const tournamentWinsCount = allTournaments.filter((t: Tournament) => t.winner === playerId).length;
            const tournamentsParticipatedCount = new Set(playerMatches.map((m: Match) => m.tournamentId).filter(Boolean)).size;
            const knockoutWinsCount = allTournaments.filter((t: Tournament) => t.winner === playerId && t.format === TournamentFormat.KNOCKOUT).length;
            const roundRobinWinsCount = allTournaments.filter((t: Tournament) => t.winner === playerId && t.format === TournamentFormat.ROUND_ROBIN).length;
            const groupTournamentWinsCount = allTournaments.filter((t: Tournament) => t.winner === playerId && t.format === TournamentFormat.GROUP).length;

            let championNoLossesCount = 0;
            let runnerUpFinishes = 0;
            let tournamentFinalistCount = 0;
            let quarterFinalistCount = 0;

            allTournaments.forEach((tournament: Tournament) => {
                if (tournament.participants.includes(playerId) && tournament.status === 'completed') {
                    // Champion No Losses
                    if (tournament.winner === playerId) {
                        const matchesInThisTournament = playerMatches.filter(m => m.tournamentId === tournament.id);
                        if (matchesInThisTournament.every(m => m.winner === playerId)) {
                            championNoLossesCount++;
                        }
                    }
                    // Finalist & Runner-up (for Knockout/Group)
                    if (tournament.format === TournamentFormat.KNOCKOUT || tournament.format === TournamentFormat.GROUP) {
                        let maxRound = Math.max(...tournament.matches.map(m => m.round));

                        // Check for finalist (final match)
                        const finalMatches = tournament.matches.filter(m => m.round === maxRound && m.status === 'completed');
                        const playerInFinal = finalMatches.some(m => m.player1Id === playerId || m.player2Id === playerId);
                        if (playerInFinal) {
                            tournamentFinalistCount++;
                            if (tournament.winner !== playerId) {
                                runnerUpFinishes++;
                            }
                        }

                        // Check for quarterfinalist (if tournament has enough rounds)
                        if (maxRound >= 3) { // Assuming round 1 = quarters, 2 = semis, 3 = final in a large tournament
                            const quarterFinalMatches = tournament.matches.filter(m => m.round === maxRound - 2 && m.status === 'completed');
                            const playerInQuarters = quarterFinalMatches.some(m => m.player1Id === playerId || m.player2Id === playerId);
                            if (playerInQuarters) {
                                quarterFinalistCount++;
                            }
                        }
                    }
                }
            });

            // --- Meta Achievements ---
            const currentPlayerAchievements = get().playerAchievements[playerId] || [];

            const metaAchievementTypes = [
                AchievementType.META_UNLOCK_5, AchievementType.META_UNLOCK_10, AchievementType.META_UNLOCK_15,
                AchievementType.META_UNLOCK_20, AchievementType.META_UNLOCK_25, AchievementType.META_UNLOCK_35,
                AchievementType.META_UNLOCK_40, AchievementType.META_UNLOCK_ALL,
            ];
            const unlockedNonMetaCount = currentPlayerAchievements.filter(p => p.unlocked && !metaAchievementTypes.includes(p.type)).length;
            const totalNonMetaAchievements = allAchievementDefinitions.filter(achDef => !metaAchievementTypes.includes(achDef.type)).length;
            const metaUnlockAllProgress = (unlockedNonMetaCount >= totalNonMetaAchievements) ? 1 : 0;

            // --- Progress Updates Array ---
            const progressUpdates = [
                // Basic
                {type: AchievementType.FIRST_WIN, progress: playerWins > 0 ? 1 : 0},
                {type: AchievementType.WINS_10, progress: playerWins},
                {type: AchievementType.WINS_25, progress: playerWins},
                {type: AchievementType.WINS_50, progress: playerWins},
                {type: AchievementType.MATCHES_5, progress: totalMatchesPlayed},
                {type: AchievementType.MATCHES_10, progress: totalMatchesPlayed},
                {type: AchievementType.MATCHES_25, progress: totalMatchesPlayed},
                {type: AchievementType.MATCHES_50, progress: totalMatchesPlayed},
                {type: AchievementType.MATCHES_75, progress: totalMatchesPlayed},
                {type: AchievementType.MATCHES_100, progress: totalMatchesPlayed},
                // Streaks
                {type: AchievementType.WIN_STREAK_3, progress: currentWinStreak},
                {type: AchievementType.WIN_STREAK_5, progress: currentWinStreak},
                {type: AchievementType.WIN_STREAK_10, progress: currentWinStreak},
                {type: AchievementType.LONGEST_STREAK_5, progress: longestWinStreak},
                {type: AchievementType.LONGEST_STREAK_10, progress: longestWinStreak},
                {type: AchievementType.LOSS_STREAK_3, progress: currentLossStreak},
                // Match Specifics
                {type: AchievementType.CLEAN_SWEEP, progress: cleanSweepsCount}, // For Flawless Victory
                {type: AchievementType.CLEAN_SWEEPS_5, progress: cleanSweepsCount},
                {type: AchievementType.CLEAN_SWEEPS_10, progress: cleanSweepsCount},
                {type: AchievementType.PERFECT_SET, progress: perfectSetsCount},
                {type: AchievementType.NEAR_PERFECT_SET, progress: nearPerfectSetsCount},
                {type: AchievementType.DEUCE_SET_WIN, progress: deuceSetWinsCount}, // For Deuce Master
                {type: AchievementType.COMEBACK_KING, progress: comebackWinsCount},
                {type: AchievementType.MARATHON_MATCH, progress: marathonMatchesPlayedCount},
                {type: AchievementType.CLUTCH_PERFORMER, progress: clutchPerformerCount},
                {type: AchievementType.BOUNCE_BACK_WIN, progress: bounceBackWinsCount}, // For Bounce Back
                {type: AchievementType.STRATEGIST_WIN, progress: strategistWinsCount},
                {type: AchievementType.HEARTBREAKER_LOSS, progress: heartbreakerLossesCount},
                {type: AchievementType.GRINDING_IT_OUT_10, progress: marathonMatchesPlayedCount}, // Uses marathon match count
                {type: AchievementType.SET_COMEBACK_5_POINTS, progress: setComeback5PointsCount},
                {type: AchievementType.DEFEAT_TOP_PLAYER, progress: topPlayerDefeatsCount},
                {type: AchievementType.DEFEAT_TOP_PLAYERS_5, progress: topPlayerDefeatsCount},
                {type: AchievementType.DEFEAT_TOP_PLAYERS_10, progress: topPlayerDefeatsCount},
                {type: AchievementType.PERFECT_GAME_FLAWLESS, progress: perfectGameCount},
                // Social & Engagement
                {type: AchievementType.SOCIAL_BUTTERFLY_5, progress: uniqueOpponentsCount},
                {type: AchievementType.SOCIAL_BUTTERFLY_10, progress: uniqueOpponentsCount},
                {type: AchievementType.SOCIAL_BUTTERFLY_15, progress: uniqueOpponentsCount},
                {type: AchievementType.RIVALRY_STARTER_3, progress: maxGamesAgainstOneOpponent},
                {type: AchievementType.RIVALRY_MASTER, progress: maxGamesAgainstOneOpponent},
                // Activity
                {type: AchievementType.DOUBLE_DUTY_MATCHES, progress: maxMatchesInSingleDay},
                // Tournament
                {type: AchievementType.TOURNAMENT_WIN, progress: tournamentWinsCount},
                {type: AchievementType.TOURNAMENT_WINS_3, progress: tournamentWinsCount},
                {type: AchievementType.TOURNAMENT_WINS_5, progress: tournamentWinsCount},
                {type: AchievementType.TOURNAMENT_PARTICIPATE_3, progress: tournamentsParticipatedCount},
                {type: AchievementType.TOURNAMENT_PARTICIPATE_5, progress: tournamentsParticipatedCount},
                {type: AchievementType.KNOCKOUT_WINNER, progress: knockoutWinsCount},
                {type: AchievementType.ROUND_ROBIN_WINNER, progress: roundRobinWinsCount},
                {type: AchievementType.WIN_GROUP_TOURNAMENT, progress: groupTournamentWinsCount},
                {type: AchievementType.CHAMPION_NO_LOSSES, progress: championNoLossesCount},
                {type: AchievementType.TOURNAMENT_FINALIST, progress: tournamentFinalistCount},
                {type: AchievementType.ALWAYS_A_BRIDESMAID, progress: runnerUpFinishes},
                {type: AchievementType.TOURNAMENT_QUARTERFINALIST_3, progress: quarterFinalistCount},
                // Meta
                {type: AchievementType.META_UNLOCK_5, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_10, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_15, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_20, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_25, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_35, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_40, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_ALL, progress: metaUnlockAllProgress},
            ];

            // Apply updates and unlock achievements
            const newlyUnlockedAchievements: Achievement[] = [];

            for (const update of progressUpdates) {
                // Removed: const currentAchievementProgress = playerAchievements[playerId]?.find(p => p.type === update.type);
                // Use currentPlayerAchievements from above
                const currentAchievementProgress = currentPlayerAchievements.find(p => p.type === update.type);
                const definition = allAchievementDefinitions.find(def => def.type === update.type);

                if (definition && (!currentAchievementProgress || !currentAchievementProgress.unlocked)) {
                    updateAchievementProgress(playerId, update.type, update.progress);
                    // Check if this update unlocks the achievement
                    if (update.progress >= definition.target) {
                        const unlockedAchievement = await unlockAchievement(playerId, update.type);
                        if (unlockedAchievement) {
                            newlyUnlockedAchievements.push(unlockedAchievement);
                        }
                    }
                }
            }

            // Special handling for META_UNLOCK_ALL
            // Removed: const currentPlayerAchievements = get().playerAchievements[playerId] || []; // Already declared
            const unlockedCount = currentPlayerAchievements.filter(a => a.unlocked && a.type !== AchievementType.META_UNLOCK_ALL).length;
            const metaAchievementDef = allAchievementDefinitions.find(def => def.type === AchievementType.META_UNLOCK_ALL);
            if (metaAchievementDef) {
                updateAchievementProgress(playerId, AchievementType.META_UNLOCK_ALL, unlockedCount);
                // Use currentPlayerAchievements from above
                const metaProgress = currentPlayerAchievements.find(p => p.type === AchievementType.META_UNLOCK_ALL);
                if (metaProgress && !metaProgress.unlocked && unlockedCount >= metaAchievementDef.target) {
                    const unlockedMeta = await unlockAchievement(playerId, AchievementType.META_UNLOCK_ALL);
                    if (unlockedMeta) {
                        newlyUnlockedAchievements.push(unlockedMeta);
                    }
                }
            }

            set({isLoading: false});
            return newlyUnlockedAchievements;
        },
    }),
);

export const fetchAchievementsFromSupabase = async () => {
    useAchievementStore.setState({isLoading: true, error: null});
    try {
        const {data, error} = await supabaseAsAdmin.from('achievements').select('*');
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
        const channel = supabaseAsAdmin
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
            supabaseAsAdmin.removeChannel(channel).catch((e) => {
                console.error("Error removing channel:", e);
            });
        };
    }, []);
};
