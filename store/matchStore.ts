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
    ) => Promise<Match>; // Will resolve with the optimistically created match
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
            //isLoading can be true for the background processing, but the initial return is fast.
            //set({isLoading: true, error: null}); 
            const tempId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const winnerId = player1Score > player2Score ? player1Id : player2Id;

            const optimisticMatch: Match = {
                id: tempId, // Temporary ID, will be replaced by Supabase ID
                tempId: tempId,
                player1Id,
                player2Id,
                player1Score,
                player2Score,
                sets,
                winner: winnerId,
                date: new Date().toISOString(),
                tournamentId,
                status: 'pending',
            };

            // Optimistically add to store
            set(state => ({
                matches: [...state.matches, optimisticMatch],
                isLoading: true, // Still loading in background
                error: null 
            }));

            // Return the optimistic match immediately
            // The promise now resolves much faster.
            //后续处理将在后台进行
            
            // Background processing:
            try {
                // Get stores - ensure they are accessed correctly, possibly passed or re-fetched if needed
                const playerStore = usePlayerStore.getState();
                const statsStore = require("./statsStore").useStatsStore.getState(); // Using require for potentially circular dependencies
                const notificationStore = useNotificationStore.getState();
                const achievementStore = require("./achievementStore").useAchievementStore.getState(); // Using require

                const player1 = playerStore.getPlayerById(player1Id);
                const player2 = playerStore.getPlayerById(player2Id);

                if (!player1 || !player2) {
                    // This error is critical and should stop the process.
                    // Update the optimistic match to 'failed' status
                    set(state => ({
                        matches: state.matches.map(m => 
                            m.tempId === tempId ? { ...m, status: 'failed', error: "Player not found" } : m
                        ),
                        isLoading: false,
                        error: "Player not found for match " + tempId,
                    }));
                    // No need to throw here as we're handling it by updating status
                    return optimisticMatch; // Or throw, depending on desired handling for caller
                }

                const {player1NewRating, player2NewRating} = calculateEloRating(
                    player1.eloRating,
                    player2.eloRating,
                    winnerId === player1Id
                );
                
                // 1. Insert match into Supabase (Primary Operation)
                const {data: dbMatchData, error: insertError} = await supabase.from('matches').insert([
                    {
                        player1_id: player1Id,
                        player2_id: player2Id,
                        player1_score: player1Score,
                        player2_score: player2Score,
                        sets: sets, // ensure sets are in JSON format if required by Supabase
                        winner: winnerId,
                        tournament_id: tournamentId,
                        date: optimisticMatch.date, // Use date from optimistic match
                    }
                ]).select().single();

                if (insertError) {
                    console.error("Error inserting match to Supabase:", insertError);
                    // Remove the optimistic match from the store if Supabase insert fails
                    set(state => ({
                        matches: state.matches.filter(m => m.tempId !== tempId),
                        isLoading: false,
                        error: `Failed to save match ${tempId} to server: ${insertError.message}. Optimistic match removed.`,
                    }));
                    // Do not proceed with other operations if Supabase insert fails.
                    // The function already returned the optimistic match. The UI will see it disappear.
                    // The error is set in the store, which can be observed by the UI.
                    return optimisticMatch; // Still returning the (now-removed) optimistic match as per current structure
                }
                
                const confirmedMatch: Match = {
                    id: dbMatchData.id, // Real ID from Supabase
                    player1Id: dbMatchData.player1_id,
                    player2Id: dbMatchData.player2_id,
                    player1Score: dbMatchData.player1_score,
                    player2Score: dbMatchData.player2_score,
                    sets: dbMatchData.sets, // Supabase might transform/validate this
                    winner: dbMatchData.winner,
                    date: dbMatchData.date,
                    tournamentId: dbMatchData.tournament_id,
                    status: 'confirmed', // Mark as confirmed
                    tempId: tempId, // Keep tempId for finding it
                };

                // Update the store with the confirmed match data
                set(state => ({
                    matches: state.matches.map(m => (m.tempId === tempId ? confirmedMatch : m)),
                    isLoading: true, // Still loading for secondary operations
                }));

                // 2. Secondary Operations (run these after successful insert)
                // These operations use the confirmedMatch.id
                const secondaryOperations = [
                    playerStore.updatePlayerRating(player1Id, player1NewRating),
                    playerStore.updatePlayerRating(player2Id, player2NewRating),
                    playerStore.updatePlayerStats(player1Id, winnerId === player1Id),
                    playerStore.updatePlayerStats(player2Id, winnerId === player2Id),
                    statsStore.updatePlayerStreak(player1Id, winnerId === player1Id),
                    statsStore.updatePlayerStreak(player2Id, winnerId === player2Id),
                    statsStore.addRankingChange({
                        playerId: player1Id,
                        oldRating: player1.eloRating,
                        newRating: player1NewRating,
                        change: player1NewRating - player1.eloRating,
                        date: confirmedMatch.date,
                        matchId: confirmedMatch.id 
                    }),
                    statsStore.addRankingChange({
                        playerId: player2Id,
                        oldRating: player2.eloRating,
                        newRating: player2NewRating,
                        change: player2NewRating - player2.eloRating,
                        date: confirmedMatch.date,
                        matchId: confirmedMatch.id
                    })
                ];

                const results = await Promise.allSettled(secondaryOperations);
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`Secondary operation ${index} failed for match ${confirmedMatch.id}:`, result.reason);
                        // Optionally, update the match object with partial failure info if needed
                        // Or dispatch specific error notifications/updates
                    }
                });
                
                // Notifications and Achievements (can also be part of allSettled if truly independent)
                // For simplicity, running them after the core stats updates.
                // Ensure players are refreshed if their data might have changed by above operations
                const updatedPlayer1 = playerStore.getPlayerById(player1Id) || player1;
                const updatedPlayer2 = playerStore.getPlayerById(player2Id) || player2;

                await notificationStore.sendMatchResultNotification(confirmedMatch, updatedPlayer1, updatedPlayer2);

                if (Math.abs(player1NewRating - player1.eloRating) >= 15) { // Use originally calculated ratings
                    await notificationStore.sendRankingChangeNotification(updatedPlayer1, player1.eloRating, player1NewRating);
                }
                if (Math.abs(player2NewRating - player2.eloRating) >= 15) {
                    await notificationStore.sendRankingChangeNotification(updatedPlayer2, player2.eloRating, player2NewRating);
                }

                const [player1Achievements, player2Achievements] = await Promise.allSettled([
                    achievementStore.checkAndUpdateAchievements(player1Id),
                    achievementStore.checkAndUpdateAchievements(player2Id)
                ]);

                if (player1Achievements.status === 'fulfilled' && Array.isArray(player1Achievements.value)) {
                    player1Achievements.value.forEach((achievement: Achievement) => {
                        notificationStore.sendAchievementNotification(updatedPlayer1, achievement);
                    });
                } else if (player1Achievements.status === 'rejected') {
                     console.error(`Error checking achievements for player ${player1Id}:`, player1Achievements.reason);
                }

                if (player2Achievements.status === 'fulfilled' && Array.isArray(player2Achievements.value)) {
                    player2Achievements.value.forEach((achievement: Achievement) => {
                        notificationStore.sendAchievementNotification(updatedPlayer2, achievement);
                    });
                } else if (player2Achievements.status === 'rejected') {
                     console.error(`Error checking achievements for player ${player2Id}:`, player2Achievements.reason);
                }
                
                set({isLoading: false, error: null}); // All background tasks initiated/done
                // The function already returned optimisticMatch.
                // No need to return here again.

            } catch (error) { // Catch any unexpected errors during background processing AFTER Supabase insert was successful
                console.error("Critical error in addMatch background processing (after confirmation):", error);
                // The match IS confirmed on the server. Do not remove it.
                // Set an error state that indicates partial failure of background tasks.
                // The `dbMatchData` should be available here if insert was successful.
                const confirmedMatchId = dbMatchData?.id || tempId; // Use actual ID if available
                set(state => ({
                    // Optionally, find the confirmed match and add an 'errorProcessing' field if your Match type supports it.
                    // matches: state.matches.map(m =>
                    //   m.id === confirmedMatchId ? { ...m, errorProcessing: (error as Error).message } : m
                    // ),
                    isLoading: false, // Stop general loading for this addMatch context
                    error: `Match ${confirmedMatchId} confirmed, but error during background processing: ${error instanceof Error ? error.message : "Unknown error"}. Some stats/notifications may be affected.`,
                }));
                // The original promise with optimisticMatch has already resolved.
                // This error handling is for store consistency.
            }
            return optimisticMatch; // Ensure this is the final return for the outer function scope.
        },

        getMatchById: (matchId) => {
            // Try finding by actual ID first, then by tempId if it's a pending match
            return get().matches.find((match) => match.id === matchId || match.tempId === matchId);
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
        const incomingMatches: Match[] = data.map((item: any) => ({
            id: item.id,
            player1Id: item.player1_id,
            player2Id: item.player2_id,
            player1Score: item.player1_score,
            player2Score: item.player2_score,
            sets: typeof item.sets === 'string' ? JSON.parse(item.sets) : item.sets, // Ensure sets are parsed
            winner: item.winner,
            date: item.date,
            tournamentId: item.tournament_id,
            status: 'confirmed', // Matches from DB are confirmed
        }));

// Helper function to transform Supabase match object to local Match type
const transformSupabaseMatch = (supabaseMatch: any): Match => {
    return {
        id: supabaseMatch.id,
        player1Id: supabaseMatch.player1_id,
        player2Id: supabaseMatch.player2_id,
        player1Score: supabaseMatch.player1_score,
        player2Score: supabaseMatch.player2_score,
        sets: typeof supabaseMatch.sets === 'string' ? JSON.parse(supabaseMatch.sets) : supabaseMatch.sets || [],
        winner: supabaseMatch.winner,
        date: supabaseMatch.date,
        tournamentId: supabaseMatch.tournament_id,
        status: 'confirmed', // Matches from DB are always confirmed
        // tempId is not present in direct DB records unless specifically added for some reason
    };
};

        // Refined merge logic for incoming matches (from Supabase) with local state
        useMatchStore.setState(state => {
            const localMatches = state.matches;
            const incomingMatchesMap = new Map<string, Match>();
            incomingMatches.forEach(match => incomingMatchesMap.set(match.id, match));

            const finalMatches: Match[] = [];
            const processedTempIds = new Set<string>(); // To track tempIds that have been replaced by confirmed matches

            // 1. Add all incoming matches (server is source of truth for these IDs)
            // And identify local pending matches that are now confirmed by an incoming match.
            incomingMatches.forEach(incomingMatch => {
                finalMatches.push(incomingMatch); // Add confirmed match
                // Check if this incoming match confirms a local pending match (via tempId)
                const localPendingMatch = localMatches.find(
                    lm => lm.tempId === incomingMatch.id && lm.status === 'pending'
                );
                if (localPendingMatch && localPendingMatch.tempId) {
                    processedTempIds.add(localPendingMatch.tempId);
                }
                 // Also check if the incomingMatch.id (which is the true db id) matches any local match's tempId
                 // This is crucial for when a pending match (id = tempId) gets confirmed.
                 const originalPendingMatch = localMatches.find(lm => lm.tempId === incomingMatch.id);
                 if (originalPendingMatch && originalPendingMatch.tempId) {
                    processedTempIds.add(originalPendingMatch.tempId);
                 }
            });

            // 2. Add local matches that were not part of the incoming batch
            // These are typically optimistic 'pending' matches not yet confirmed,
            // or matches that were confirmed but somehow not in the current fetch (less likely with select *).
            localMatches.forEach(localMatch => {
                // If the local match's ID is in the incoming map, it's already added/updated.
                if (incomingMatchesMap.has(localMatch.id)) {
                    return; 
                }
                // If the local match is a pending item and its tempId was processed (meaning it got confirmed), skip it.
                if (localMatch.tempId && processedTempIds.has(localMatch.tempId)) {
                    return;
                }
                // If a local match has status 'pending' and its ID (which might be a tempId) is now confirmed, skip it.
                if (localMatch.status === 'pending' && incomingMatchesMap.has(localMatch.id)) {
                     // This case should ideally be covered by processedTempIds if tempId was correctly used.
                     // However, if id was used as tempId directly for pending items.
                    return;
                }

                // Otherwise, it's a local match not affected by this fetch, keep it.
                finalMatches.push(localMatch);
            });
            
            // Deduplicate: Ensure each match (by ID) is unique. Server version takes precedence.
            // The logic above should largely prevent duplicates, but this is a safeguard.
            const uniqueMatches = Array.from(new Map(finalMatches.map(match => [match.id, match])).values());

            return {matches: uniqueMatches, isLoading: false, error: null};
        });
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
                (payload) => {
                    console.log('Realtime match change received:', payload);
                    const {set, getState} = useMatchStore;

                    try {
                        switch (payload.eventType) {
                            case 'INSERT':
                                const newMatchData = transformSupabaseMatch(payload.new);
                                set(state => {
                                    const matches = [...state.matches];
                                    const existingMatchIndex = matches.findIndex(
                                        m => m.id === newMatchData.id || (m.tempId && m.tempId === newMatchData.id)
                                    );

                                    if (existingMatchIndex !== -1) {
                                        // This means the incoming new match might be a confirmation of an optimistic one
                                        // or a direct insert that somehow has a duplicate ID (less likely with DB constraints)
                                        // If it was a tempId match, update tempId, id, and status.
                                        console.log(`Realtime INSERT: Updating existing match (possibly pending) with ID ${newMatchData.id}`);
                                        matches[existingMatchIndex] = {
                                            ...matches[existingMatchIndex], // keep original tempId if it was one
                                            ...newMatchData, // server data takes precedence
                                            id: newMatchData.id, // ensure actual db id is used
                                            status: 'confirmed',
                                        };
                                        return {matches};
                                    } else {
                                        // Genuinely new match
                                        console.log(`Realtime INSERT: Adding new match with ID ${newMatchData.id}`);
                                        return {matches: [...matches, newMatchData]};
                                    }
                                });
                                break;

                            case 'UPDATE':
                                const updatedMatchData = transformSupabaseMatch(payload.new);
                                set(state => ({
                                    matches: state.matches.map(match =>
                                        match.id === updatedMatchData.id
                                            ? {...match, ...updatedMatchData, status: 'confirmed'} // Ensure status is confirmed
                                            : match
                                    ),
                                }));
                                console.log(`Realtime UPDATE: Updated match with ID ${updatedMatchData.id}`);
                                break;

                            case 'DELETE':
                                const oldMatchId = payload.old.id;
                                if (!oldMatchId) {
                                    console.warn("Realtime DELETE: No ID found in payload.old. Refetching.", payload);
                                    fetchMatchesFromSupabase().catch(e => console.warn("Error refetching matches:", e));
                                    break;
                                }
                                set(state => ({
                                    matches: state.matches.filter(match => match.id !== oldMatchId),
                                }));
                                console.log(`Realtime DELETE: Removed match with ID ${oldMatchId}`);
                                break;

                            default:
                                console.log(`Unknown event type: ${payload.eventType}. Refetching matches.`);
                                fetchMatchesFromSupabase().catch(e => console.warn("Error refetching matches:", e));
                        }
                    } catch (error) {
                        console.error("Error processing realtime match update:", error, payload);
                        fetchMatchesFromSupabase().catch(e => console.warn("Error refetching matches after processing error:", e));
                    }
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel).then(r =>
                console.error("Error removing matches channel:", r));
        };
    }, []);
};
