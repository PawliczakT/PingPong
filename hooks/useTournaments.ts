//hooks/useTournaments.ts
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import * as tournamentsApi from '@/api/tournamentsApi';
import {Set as MatchSet, TournamentFormat} from '@/backend/types';

export const TOURNAMENTS_QUERY_KEY = ['tournaments'];

export const useTournaments = () => {
    return useQuery({
        queryKey: TOURNAMENTS_QUERY_KEY,
        queryFn: tournamentsApi.fetchTournaments,
    });
};

export const useCreateTournament = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { name: string, date: string, format: TournamentFormat, playerIds: string[] }) =>
            tournamentsApi.createTournament(params),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: TOURNAMENTS_QUERY_KEY});
        },
    });
};

export const useStartTournament = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { tournamentId: string, format: TournamentFormat, playerIds: string[] }) =>
            tournamentsApi.generateAndStartTournament(params),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: TOURNAMENTS_QUERY_KEY});
        }
    });
};

export const useUpdateMatchResult = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            tournamentId: string,
            matchId: string,
            scores: { player1Score: number, player2Score: number, sets?: MatchSet[] }
        }) =>
            tournamentsApi.updateMatchResult(params),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: TOURNAMENTS_QUERY_KEY});
        },
    });
};

export const useTournament = (id: string) => {
    return useQuery({
        queryKey: [...TOURNAMENTS_QUERY_KEY, id],
        queryFn: () => tournamentsApi.fetchTournamentById(id),
        enabled: !!id,
    });
};

export const useSetTournamentWinner = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { tournamentId: string, winnerId: string }) =>
            tournamentsApi.setTournamentWinner(params),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: TOURNAMENTS_QUERY_KEY});
        }
    });
};

export const useGenerateMatches = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { tournamentId: string }) =>
            tournamentsApi.generateTournamentMatches(params),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: TOURNAMENTS_QUERY_KEY});
        }
    });
};
