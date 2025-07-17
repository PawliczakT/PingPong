import { useTournamentStore } from '@/store/tournamentStore';
import { usePlayerStore } from '@/store/playerStore';
import { TournamentFormat } from '@/backend/types';

jest.mock('@/app/lib/supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        rpc: jest.fn().mockReturnThis(),
    },
}));

describe('Tournament Store - Double Elimination', () => {
    beforeEach(() => {
        useTournamentStore.setState({ tournaments: [], loading: false, error: null });
        usePlayerStore.setState({
            players: [
                { id: '1', name: 'Player 1', eloRating: 1000 },
                { id: '2', name: 'Player 2', eloRating: 1000 },
                { id: '3', name: 'Player 3', eloRating: 1000 },
                { id: '4', name: 'Player 4', eloRating: 1000 },
                { id: '5', name: 'Player 5', eloRating: 1000 },
                { id: '6', name: 'Player 6', eloRating: 1000 },
                { id: '7', name: 'Player 7', eloRating: 1000 },
                { id: '8', name: 'Player 8', eloRating: 1000 },
            ],
        });
    });

    it('should generate matches for a double elimination tournament', async () => {
        const { getState } = useTournamentStore;
        const playerIds = ['1', '2', '3', '4', '5', '6', '7', '8'];

        // Mock supabase calls
        const { supabase } = require('@/app/lib/supabase');
        let createdMatches: any[] = [];

        const fromMock = supabase.from as jest.Mock;
        fromMock.mockImplementation((tableName: string) => {
            if (tableName === 'tournaments') {
                return {
                    select: jest.fn().mockResolvedValue({ data: [], error: null }),
                    insert: jest.fn().mockResolvedValue({ data: [{ id: 'test-tournament' }], error: null }),
                };
            }
            if (tableName === 'tournament_participants') {
                return {
                    select: jest.fn().mockResolvedValue({ data: playerIds.map(id => ({ player_id: id })), error: null }),
                    insert: jest.fn().mockResolvedValue({ error: null }),
                };
            }
            if (tableName === 'tournament_matches') {
                return {
                    select: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({data: {}, error: null})
            };
        });

        const rpcMock = supabase.rpc as jest.Mock;
        rpcMock.mockImplementation(async (method: string, args: any) => {
            if (method === 'start_tournament') {
                createdMatches = args.p_matches;
                return { error: null };
            }
            return { error: { message: 'Unknown RPC method' } };
        });

        const tournamentId = await getState().createTournament('Test Tournament', '2024-01-01', TournamentFormat.DOUBLE_ELIMINATION, playerIds);

        useTournamentStore.setState({
            tournaments: [{
                id: tournamentId,
                name: 'Test Tournament',
                format: TournamentFormat.DOUBLE_ELIMINATION,
                participants: playerIds,
                status: 'pending',
                matches: [],
            }],
        });

        const originalFetch = useTournamentStore.getState().fetchTournaments;
        useTournamentStore.getState().fetchTournaments = jest.fn().mockResolvedValue(undefined);

        await getState().generateAndStartTournament(tournamentId);

        useTournamentStore.setState(state => {
            const tournament = state.tournaments.find(t => t.id === tournamentId);
            if (tournament) {
                tournament.matches = createdMatches;
            }
            return state;
        });

        useTournamentStore.getState().fetchTournaments = originalFetch;

        const tournament = getState().getTournamentById(tournamentId);
        expect(tournament).toBeDefined();
        expect(tournament.matches.length).toBe(15); // For 8 players, there should be 14 matches + 1 final
    });
});
