//hooks/useTournamentsRealtime.ts
import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/app/lib/supabase';
import {TOURNAMENTS_QUERY_KEY} from './useTournaments';

export function useTournamentsRealtime() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleChanges = () => {
            queryClient.invalidateQueries({queryKey: TOURNAMENTS_QUERY_KEY});
        };

        const channel = supabase
            .channel('public-tournaments-realtime')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'tournaments'},
                handleChanges
            )
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'tournament_matches'},
                handleChanges
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);
}
