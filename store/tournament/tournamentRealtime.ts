import {useEffect} from 'react';
import {supabase} from '@/app/lib/supabase';
import type {RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient} from '@supabase/supabase-js';
import type {StoreApi, UseBoundStore} from 'zustand';
import type {FullTournamentStore, Tournament, TournamentMatch} from './tournamentTypes';
import {transformMatchData} from './tournamentLogic';

let tournamentChannel: RealtimeChannel | null = null;

const getTournamentChannel = (supabaseInstance: SupabaseClient): RealtimeChannel => {
    if (!tournamentChannel || tournamentChannel.state === 'closed') {
        tournamentChannel = supabaseInstance.channel('tournaments-realtime-channel');
    }
    return tournamentChannel;
};

export const handleTournamentTableUpdate = (
    payload: RealtimePostgresChangesPayload<Tournament>,
    set: StoreApi<FullTournamentStore>['setState'],
    get: StoreApi<FullTournamentStore>['getState']
): void => {
    const {eventType, new: newRecord, old} = payload;
    const recordId = eventType === 'DELETE' ? old.id : newRecord.id;

    set(state => {
        const tournaments = [...state.tournaments]; // Create a mutable copy if not using Immer
        const index = tournaments.findIndex(t => t.id === recordId);

        if (eventType === 'INSERT') {
            if (index === -1) {
                // Ensure new record conforms to Tournament type, especially if matches are expected
                const newTournamentData = {...newRecord, matches: newRecord.matches || []} as Tournament;
                tournaments.push(newTournamentData);
            } else { // Already exists, treat as update or log warning
                tournaments[index] = {...tournaments[index], ...newRecord} as Tournament;
            }
        } else if (eventType === 'UPDATE') {
            if (index !== -1) {
                tournaments[index] = {...tournaments[index], ...newRecord} as Tournament;
            } else { // Does not exist, treat as insert or log warning
                const newTournamentData = {...newRecord, matches: newRecord.matches || []} as Tournament;
                tournaments.push(newTournamentData);
            }
        } else if (eventType === 'DELETE') {
            if (index !== -1) {
                tournaments.splice(index, 1);
            }
        }
        // Re-sort tournaments after update
        tournaments.sort((a, b) => {
            const statusOrder = {ACTIVE: 1, UPCOMING: 2, PENDING: 2, COMPLETED: 3, CANCELLED: 4};
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        return {tournaments};
    });
    // Potentially trigger a fetch or re-validation if complex relations are affected
    // get().fetchTournaments({ force: true }); // Example if a full refresh is desired
};

export const handleTournamentMatchTableUpdate = (
    payload: RealtimePostgresChangesPayload<TournamentMatch>,
    set: StoreApi<FullTournamentStore>['setState']
): void => {
    const {eventType, new: newRecord, old} = payload;
    // newRecord from Supabase will have snake_case, needs transformation
    const transformedNewRecord = newRecord ? transformMatchData(newRecord) : null;
    const recordId = eventType === 'DELETE' ? old.id : transformedNewRecord?.id;
    const tournamentId = eventType === 'DELETE' ? (old as any).tournament_id : transformedNewRecord?.tournamentId;


    if (!recordId || !tournamentId) {
        console.warn('Realtime match update issue: recordId or tournamentId missing', payload);
        return;
    }

    set(state => {
        const tournamentIndex = state.tournaments.findIndex(t => t.id === tournamentId);
        if (tournamentIndex === -1) return state; // Tournament not found

        const tournament = state.tournaments[tournamentIndex];
        let matches = tournament.matches ? [...tournament.matches] : []; // Mutable copy
        const matchIndex = matches.findIndex(m => m.id === recordId);

        if (eventType === 'INSERT') {
            if (matchIndex === -1 && transformedNewRecord) {
                matches.push(transformedNewRecord);
            } else if (transformedNewRecord) { // Already exists, update it
                matches[matchIndex] = transformedNewRecord;
            }
        } else if (eventType === 'UPDATE') {
            if (matchIndex !== -1 && transformedNewRecord) {
                matches[matchIndex] = {...matches[matchIndex], ...transformedNewRecord};
            } else if (transformedNewRecord) { // Does not exist, insert it
                matches.push(transformedNewRecord);
            }
        } else if (eventType === 'DELETE') {
            if (matchIndex !== -1) {
                matches.splice(matchIndex, 1);
            }
        }

        // Sort matches within the tournament
        matches.sort((a, b) => (a.round - b.round) || (a.matchNumber - b.matchNumber));
        state.tournaments[tournamentIndex].matches = matches; // direct mutation allowed
        return state; // return mutated full state to satisfy type system
    });
};

export function useTournamentsRealtimeUpdates(useStore: UseBoundStore<StoreApi<FullTournamentStore>>) {
    useEffect(() => {
        // Get setState and getState from the store instance
        const {setState, getState} = useStore;

        const channel = getTournamentChannel(supabase);

        const subscription = channel
            .on<Tournament>(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'tournaments'},
                (payload) => handleTournamentTableUpdate(payload, setState, getState)
            )
            .on<TournamentMatch>( // Raw type from DB, will be transformed
                'postgres_changes',
                {event: '*', schema: 'public', table: 'tournament_matches'},
                (payload) => handleTournamentMatchTableUpdate(payload, setState)
            )
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Subscribed to tournaments & matches real-time updates!');
                    // Optionally fetch all tournaments on successful subscription to ensure data consistency
                    // This can help if client was offline and missed updates
                    await getState().fetchTournaments({force: true});
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime channel error:', channel.state);
                } else if (status === 'TIMED_OUT') {
                    console.warn('Realtime subscription timed out.');
                }
            });

        // Cleanup function to unsubscribe when the component unmounts or dependencies change
        return () => {
            if (subscription && typeof subscription.unsubscribe === 'function') {
                supabase.removeChannel(subscription);
                tournamentChannel = null; // Reset for potential re-subscription
                console.log('Unsubscribed from tournaments real-time updates.');
            }
        };
    }, [useStore]); // Re-run effect if the store instance itself changes (shouldn't typically happen)
}
