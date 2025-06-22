import {create} from 'zustand';
import {
    Achievement,
    AchievementProgress,
    AchievementType,
    DisplayAchievement,
    Match,
    Set as MatchSet,
    Tournament,
    TournamentFormat,
} from '@/backend/types';
import {usePlayerStore} from './playerStore';
import {useTournamentStore} from './tournamentStore';
import {achievements as allAchievementDefinitions} from '@/constants/achievements';
import {supabase} from '@/backend/server/lib/supabase';
import {useEffect} from 'react';
import {useMatchStore} from './matchStore';
import {dispatchSystemNotification} from '@/backend/server/trpc/services/notificationService';

interface AchievementState {
    playerAchievements: Record<string, AchievementProgress[]>;
    isLoading: boolean;
    error: string | null;
    initializePlayerAchievements: (playerId: string) => Promise<void>;
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

        initializePlayerAchievements: async (playerId: string) => {
            if (get().playerAchievements[playerId]) return;

            set({isLoading: true});
            try {
                const {data, error} = await supabase
                    .from('achievements')
                    .select('type, progress, unlocked, unlocked_at')
                    .eq('player_id', playerId);
                if (error) throw error;

                const achievementsProgress = data.map((dbAchievement: any) => ({
                    type: dbAchievement.type as AchievementType,
                    progress: dbAchievement.progress,
                    unlocked: dbAchievement.unlocked,
                    unlockedAt: dbAchievement.unlocked_at,
                }));

                set((state) => ({
                    playerAchievements: {
                        ...state.playerAchievements,
                        [playerId]: achievementsProgress,
                    },
                    isLoading: false,
                }));
            } catch (error) {
                console.error('Failed to initialize achievements:', error);
                set({isLoading: false, error: error instanceof Error ? error.message : "Unknown error"});
            }
        },

        unlockAchievement: async (playerId, achievementType) => {
            const achievementDef = allAchievementDefinitions.find(a => a.type === achievementType);
            if (!achievementDef) {
                console.warn(`Attempted to unlock unknown achievement type: ${achievementType}`);
                return null;
            }

            set({isLoading: true, error: null});
            let unlockedAchievementProgress: AchievementProgress | null = null;

            try {
                const achievementRecord = {
                    player_id: playerId,
                    type: achievementType,
                    progress: achievementDef.target,
                    unlocked: true,
                    unlocked_at: new Date().toISOString(),
                };

                const {data: upsertData, error: upsertError} = await supabase
                    .from('achievements')
                    .upsert(achievementRecord, {onConflict: 'player_id,type'})
                    .select()
                    .single();

                if (upsertError) {
                    console.error('Error upserting achievement:', upsertError);
                    throw upsertError;
                }

                unlockedAchievementProgress = {
                    type: upsertData.type as AchievementType,
                    progress: upsertData.progress,
                    unlocked: upsertData.unlocked,
                    unlockedAt: upsertData.unlocked_at,
                };

                set((state) => {
                    const currentAchievements = state.playerAchievements[playerId] || [];
                    const existingIndex = currentAchievements.findIndex(a => a.type === achievementType);
                    const newAchievements = [...currentAchievements];
                    if (existingIndex > -1) {
                        newAchievements[existingIndex] = unlockedAchievementProgress!;
                    } else {
                        newAchievements.push(unlockedAchievementProgress!);
                    }
                    return {
                        playerAchievements: {...state.playerAchievements, [playerId]: newAchievements},
                    };
                });

                try {
                    const player = usePlayerStore.getState().getPlayerById(playerId);
                    await dispatchSystemNotification(
                        'achievement_unlocked',
                        {
                            notification_type: 'achievement_unlocked',
                            achieverNickname: player?.nickname || player?.name || 'Player',
                            achievementName: achievementDef.name,
                            achievementId: achievementDef.id
                        }
                    );
                } catch (notificationError) {
                    console.error(`Failed to dispatch achievement notification for ${achievementType}:`, notificationError);
                }

                set({isLoading: false});
                return achievementDef;
            } catch (error) {
                console.error('Exception during achievement unlock (database operation failed):', error);
                set({isLoading: false, error: error instanceof Error ? error.message : "Failed to unlock achievement"});
                return null;
            }
        },

        getPlayerAchievements: (playerId) => {
            return get().playerAchievements[playerId] || [];
        },

        getUnlockedAchievements: (playerId) => {
            const playerAchievements = get().getPlayerAchievements(playerId);
            const unlockedTypes = playerAchievements.filter(a => a.unlocked).map(a => a.type);
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
            const {unlockAchievement} = get();
            const playerStore = usePlayerStore.getState();
            const matchStore = useMatchStore.getState();
            const tournamentStore = useTournamentStore.getState();

            const player = playerStore.getPlayerById(playerId);
            if (!player) {
                set({isLoading: false, error: "Player not found"});
                return [];
            }

            const {data: dbAchievements, error: dbError} = await supabase
                .from('achievements')
                .select('type')
                .eq('player_id', playerId)
                .eq('unlocked', true);

            if (dbError) {
                set({isLoading: false, error: "Failed to fetch achievements from DB"});
                return [];
            }
            const unlockedAchievementTypes = new Set(dbAchievements.map((a) => a.type));

            const playerMatches = matchStore.getMatchesByPlayerId(playerId);
            const allTournaments = tournamentStore.tournaments;
            const allPlayers = playerStore.players;
            const playerWins = player.wins;
            const totalMatchesPlayed = playerMatches.length;
            const topPlayers = [...allPlayers].sort((a, b) => b.eloRating - a.eloRating).slice(0, 3).map(p => p.id).filter(id => id !== playerId);

            const sortedMatches = [...playerMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let currentWinStreak = 0, longestWinStreak = 0, currentLossStreak = 0, longestLossStreak = 0,
                tempCurrentWins = 0, tempCurrentLosses = 0;
            for (const match of sortedMatches) {
                if (match.winner === playerId) {
                    tempCurrentWins++;
                    tempCurrentLosses = 0;
                    if (tempCurrentWins > longestWinStreak) longestWinStreak = tempCurrentWins;
                } else {
                    tempCurrentLosses++;
                    tempCurrentWins = 0;
                    if (tempCurrentLosses > longestLossStreak) longestLossStreak = tempCurrentLosses;
                }
            }
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

            let cleanSweepsCount = 0, perfectSetsCount = 0, nearPerfectSetsCount = 0, deuceSetWinsCount = 0,
                comebackWinsCount = 0, marathonMatchesPlayedCount = 0, clutchPerformerCount = 0,
                strategistWinsCount = 0, heartbreakerLossesCount = 0, setComeback5PointsCount = 0,
                topPlayerDefeatsCount = 0, perfectGameCount = 0;
            playerMatches.forEach((match: Match) => {
                const playerIsP1 = match.player1Id === playerId;
                if (match.winner === playerId) {
                    if (match.sets.length === 3 && ((playerIsP1 && match.player1Score === 3 && match.player2Score === 0) || (!playerIsP1 && match.player2Score === 3 && match.player1Score === 0))) cleanSweepsCount++;
                    let setMarginsInMatch = new Set<number>(), allSetMarginsUnique = true;
                    match.sets.forEach((set: MatchSet, index: number) => {
                        const p1WonSet = set.player1Score > set.player2Score,
                            p2WonSet = set.player2Score > set.player1Score;
                        const playerWonThisSet = (playerIsP1 && p1WonSet) || (!playerIsP1 && p2WonSet);
                        if (playerWonThisSet) {
                            const pScore = playerIsP1 ? set.player1Score : set.player2Score,
                                oScore = playerIsP1 ? set.player2Score : set.player1Score;
                            if (pScore === 11 && oScore === 0) perfectSetsCount++;
                            if (pScore === 11 && oScore === 1) nearPerfectSetsCount++;
                            if (pScore >= 11 && oScore >= 10 && pScore - oScore === 2) deuceSetWinsCount++;
                            if ((match.player1Score + match.player2Score) % 2 !== 0 && index === match.sets.length - 1) {
                                if ((playerIsP1 && match.player1Score > match.player2Score) || (!playerIsP1 && match.player2Score > match.player1Score)) clutchPerformerCount++;
                            }
                        }
                        const margin = Math.abs(set.player1Score - set.player2Score);
                        if (setMarginsInMatch.has(margin)) allSetMarginsUnique = false;
                        setMarginsInMatch.add(margin);
                    });
                    if (match.winner === playerId && allSetMarginsUnique && match.sets.length > 0) strategistWinsCount++;
                    if (match.sets.length >= 3) {
                        let pSets = 0, oSets = 0, wasTwoSetsDown = false;
                        for (let i = 0; i < match.sets.length; i++) {
                            const set = match.sets[i];
                            if ((playerIsP1 && set.player1Score > set.player2Score) || (!playerIsP1 && set.player2Score > set.player1Score)) pSets++; else oSets++;
                            if (i < match.sets.length - 1 && oSets - pSets >= 2) wasTwoSetsDown = true;
                        }
                        if (wasTwoSetsDown && pSets > oSets) comebackWinsCount++;
                    }
                    match.sets.forEach((set: MatchSet) => {
                        if ((playerIsP1 ? set.player1Score : set.player2Score) === 11 && (playerIsP1 ? set.player2Score : set.player1Score) <= 7) setComeback5PointsCount++;
                    });
                    const opponentId = playerIsP1 ? match.player2Id : match.player1Id;
                    if (topPlayers.includes(opponentId)) topPlayerDefeatsCount++;
                    let perfectGame = match.sets.length > 0;
                    for (const set of match.sets) {
                        if ((playerIsP1 ? set.player2Score : set.player1Score) > 0) {
                            perfectGame = false;
                            break;
                        }
                    }
                    if (perfectGame) perfectGameCount++;
                }
                if (match.sets.length === 5) marathonMatchesPlayedCount++;
                if (match.winner !== playerId && match.sets.length === 5) {
                    const lastSet = match.sets[4], pScore = playerIsP1 ? lastSet.player1Score : lastSet.player2Score,
                        oScore = playerIsP1 ? lastSet.player2Score : lastSet.player1Score;
                    if (pScore === 10 && oScore === 12) heartbreakerLossesCount++;
                }
            });
            let bounceBackWinsCount = 0;
            for (let i = 1; i < sortedMatches.length; i++) {
                if (sortedMatches[i - 1].winner !== playerId && sortedMatches[i].winner === playerId) bounceBackWinsCount++;
            }
            const uniqueOpponents = new Set<string>(), opponentPlayCounts: Record<string, number> = {};
            playerMatches.forEach((match: Match) => {
                const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;
                if (opponentId) {
                    uniqueOpponents.add(opponentId);
                    opponentPlayCounts[opponentId] = (opponentPlayCounts[opponentId] || 0) + 1;
                }
            });
            const uniqueOpponentsCount = uniqueOpponents.size,
                maxGamesAgainstOneOpponent = Math.max(0, ...Object.values(opponentPlayCounts));
            const matchesPerDay: Record<string, number> = {};
            playerMatches.forEach((match: Match) => {
                const matchDate = new Date(match.date).toISOString().split('T')[0];
                matchesPerDay[matchDate] = (matchesPerDay[matchDate] || 0) + 1;
            });
            const maxMatchesInSingleDay = Math.max(0, ...Object.values(matchesPerDay));
            const tournamentWinsCount = allTournaments.filter((t: Tournament) => t.winner === playerId).length,
                tournamentsParticipatedCount = new Set(playerMatches.map((m: Match) => m.tournamentId).filter(Boolean)).size,
                knockoutWinsCount = allTournaments.filter((t: Tournament) => t.winner === playerId && t.format === TournamentFormat.KNOCKOUT).length,
                roundRobinWinsCount = allTournaments.filter((t: Tournament) => t.winner === playerId && t.format === TournamentFormat.ROUND_ROBIN).length,
                groupTournamentWinsCount = allTournaments.filter((t: Tournament) => t.winner === playerId && t.format === TournamentFormat.GROUP).length;
            let championNoLossesCount = 0, runnerUpFinishes = 0, tournamentFinalistCount = 0, quarterFinalistCount = 0;
            allTournaments.forEach((tournament: Tournament) => {
                if (tournament.participants.includes(playerId) && tournament.status === 'completed') {
                    if (tournament.winner === playerId) {
                        if (playerMatches.filter(m => m.tournamentId === tournament.id).every(m => m.winner === playerId)) championNoLossesCount++;
                    }
                    if (tournament.format === TournamentFormat.KNOCKOUT || tournament.format === TournamentFormat.GROUP) {
                        let maxRound = Math.max(...tournament.matches.map(m => m.round));
                        if (tournament.matches.filter(m => m.round === maxRound && m.status === 'completed').some(m => m.player1Id === playerId || m.player2Id === playerId)) {
                            tournamentFinalistCount++;
                            if (tournament.winner !== playerId) runnerUpFinishes++;
                        }
                        if (maxRound >= 3 && tournament.matches.filter(m => m.round === maxRound - 2 && m.status === 'completed').some(m => m.player1Id === playerId || m.player2Id === playerId)) quarterFinalistCount++;
                    }
                }
            });
            const metaAchievementTypes = [AchievementType.META_UNLOCK_5, AchievementType.META_UNLOCK_10, AchievementType.META_UNLOCK_15, AchievementType.META_UNLOCK_20, AchievementType.META_UNLOCK_25, AchievementType.META_UNLOCK_35, AchievementType.META_UNLOCK_40, AchievementType.META_UNLOCK_ALL];
            const unlockedNonMetaCount = get().playerAchievements[playerId]?.filter(p => p.unlocked && !metaAchievementTypes.includes(p.type)).length || 0;
            const totalNonMetaAchievements = allAchievementDefinitions.filter(achDef => !metaAchievementTypes.includes(achDef.type)).length;
            const metaUnlockAllProgress = (unlockedNonMetaCount >= totalNonMetaAchievements) ? 1 : 0;
            const progressUpdates = [
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
                {type: AchievementType.WIN_STREAK_3, progress: currentWinStreak},
                {type: AchievementType.WIN_STREAK_5, progress: currentWinStreak},
                {type: AchievementType.WIN_STREAK_10, progress: currentWinStreak},
                {type: AchievementType.LONGEST_STREAK_5, progress: longestWinStreak},
                {type: AchievementType.LONGEST_STREAK_10, progress: longestWinStreak},
                {type: AchievementType.LOSS_STREAK_3, progress: currentLossStreak},
                {type: AchievementType.CLEAN_SWEEP, progress: cleanSweepsCount},
                {type: AchievementType.CLEAN_SWEEPS_5, progress: cleanSweepsCount},
                {type: AchievementType.CLEAN_SWEEPS_10, progress: cleanSweepsCount},
                {type: AchievementType.PERFECT_SET, progress: perfectSetsCount},
                {type: AchievementType.NEAR_PERFECT_SET, progress: nearPerfectSetsCount},
                {type: AchievementType.DEUCE_SET_WIN, progress: deuceSetWinsCount},
                {type: AchievementType.COMEBACK_KING, progress: comebackWinsCount},
                {type: AchievementType.MARATHON_MATCH, progress: marathonMatchesPlayedCount},
                {type: AchievementType.CLUTCH_PERFORMER, progress: clutchPerformerCount},
                {type: AchievementType.BOUNCE_BACK_WIN, progress: bounceBackWinsCount},
                {type: AchievementType.STRATEGIST_WIN, progress: strategistWinsCount},
                {type: AchievementType.HEARTBREAKER_LOSS, progress: heartbreakerLossesCount},
                {type: AchievementType.GRINDING_IT_OUT_10, progress: marathonMatchesPlayedCount},
                {type: AchievementType.SET_COMEBACK_5_POINTS, progress: setComeback5PointsCount},
                {type: AchievementType.DEFEAT_TOP_PLAYER, progress: topPlayerDefeatsCount},
                {type: AchievementType.DEFEAT_TOP_PLAYERS_5, progress: topPlayerDefeatsCount},
                {type: AchievementType.DEFEAT_TOP_PLAYERS_10, progress: topPlayerDefeatsCount},
                {type: AchievementType.PERFECT_GAME_FLAWLESS, progress: perfectGameCount},
                {type: AchievementType.SOCIAL_BUTTERFLY_5, progress: uniqueOpponentsCount},
                {type: AchievementType.SOCIAL_BUTTERFLY_10, progress: uniqueOpponentsCount},
                {type: AchievementType.SOCIAL_BUTTERFLY_15, progress: uniqueOpponentsCount},
                {type: AchievementType.RIVALRY_STARTER_3, progress: maxGamesAgainstOneOpponent},
                {type: AchievementType.RIVALRY_MASTER, progress: maxGamesAgainstOneOpponent},
                {type: AchievementType.DOUBLE_DUTY_MATCHES, progress: maxMatchesInSingleDay},
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
                {type: AchievementType.META_UNLOCK_5, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_10, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_15, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_20, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_25, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_35, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_40, progress: unlockedNonMetaCount},
                {type: AchievementType.META_UNLOCK_ALL, progress: metaUnlockAllProgress},
            ];

            const newlyUnlockedAchievements: Achievement[] = [];
            for (const update of progressUpdates) {
                const definition = allAchievementDefinitions.find(def => def.type === update.type);
                if (
                    definition &&
                    update.progress >= definition.target &&
                    !unlockedAchievementTypes.has(update.type)
                ) {
                    const unlockedAchievement = await unlockAchievement(playerId, update.type);
                    if (unlockedAchievement) {
                        newlyUnlockedAchievements.push(unlockedAchievement);
                        unlockedAchievementTypes.add(update.type);
                    }
                }
            }
            set({isLoading: false});
            return newlyUnlockedAchievements;
        },
    }));

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
