import {Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/backend/types';
import {useTournamentStore} from '@/tournaments/TournamentStore';

// Mock supabase and its chained methods to avoid real network calls
jest.mock('@/app/lib/supabase', () => ({
    supabase: {
        channel: jest.fn(() => ({on: jest.fn(), subscribe: jest.fn()})),
        from: jest.fn(() => ({
            select: jest.fn(() => ({order: jest.fn(), eq: jest.fn()})),
            insert: jest.fn(),
            delete: jest.fn(),
            order: jest.fn(),
            update: jest.fn(),
            rpc: jest.fn(),
            eq: jest.fn(),
            single: jest.fn(),
            count: jest.fn(),
        })),
    },
}));

// Utility to generate a simple TournamentMatch
const createMatch = (id: string, status: TournamentMatch['status'] = 'scheduled'): TournamentMatch => ({
    id,
    tournamentId: 't1',
    round: 1,
    player1Id: 'p1',
    player2Id: 'p2',
    player1Score: null,
    player2Score: null,
    winner: null,
    matchId: id,
    nextMatchId: null,
    status,
    sets: [],
    group: undefined,
});

// Utility to generate a simple Tournament
const createTournament = (
    id: string,
    status: TournamentStatus,
    winner: string | undefined = undefined,
): Tournament => ({
    id,
    name: `Tournament ${id}`,
    date: new Date().toISOString(),
    format: TournamentFormat.KNOCKOUT,
    status,
    participants: ['p1', 'p2'],
    matches: [createMatch(`m_${id}`)],
    winner,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});

describe('tournamentStore selectors', () => {
    beforeEach(() => {
        // Reset store state before each test
        useTournamentStore.setState({tournaments: []});
    });

    it('getUpcomingTournaments should return only pending tournaments', () => {
        const tournaments = [
            createTournament('1', TournamentStatus.UPCOMING),
            createTournament('2', TournamentStatus.IN_PROGRESS),
            createTournament('3', TournamentStatus.COMPLETED),
        ];
        useTournamentStore.setState({tournaments});

        const result = useTournamentStore.getState().getUpcomingTournaments();
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe(TournamentStatus.UPCOMING);
    });

    it('getActiveTournaments should return only active tournaments', () => {
        const tournaments = [
            createTournament('1', TournamentStatus.UPCOMING),
            createTournament('2', TournamentStatus.IN_PROGRESS),
            createTournament('3', TournamentStatus.IN_PROGRESS),
        ];
        useTournamentStore.setState({tournaments});

        const result = useTournamentStore.getState().getActiveTournaments();
        expect(result).toHaveLength(2);
        result.forEach(t => expect(t.status).toBe('active'));
    });

    it('getCompletedTournaments should return only completed tournaments', () => {
        const tournaments = [
            createTournament('1', TournamentStatus.COMPLETED),
            createTournament('2', TournamentStatus.COMPLETED),
            createTournament('3', TournamentStatus.IN_PROGRESS),
        ];
        useTournamentStore.setState({tournaments});

        const result = useTournamentStore.getState().getCompletedTournaments();
        expect(result).toHaveLength(2);
        result.forEach(t => expect(t.status).toBe('completed'));
    });

    it('getTournamentById should return the correct tournament', () => {
        const tournaments = [
            createTournament('1', TournamentStatus.UPCOMING),
            createTournament('2', TournamentStatus.IN_PROGRESS),
        ];
        useTournamentStore.setState({tournaments});

        const tournament = useTournamentStore.getState().getTournamentById('2');
        expect(tournament).toBeDefined();
        expect(tournament?.id).toBe('2');
    });

    it('getTournamentMatches should map matches correctly', () => {
        const match = {...createMatch('match1', 'pending'), player1Score: 1, player2Score: 0};
        const tournaments = [
            {
                ...createTournament('1', TournamentStatus.IN_PROGRESS),
                matches: [match],
            },
        ];
        useTournamentStore.setState({tournaments});

        const mappedMatches = useTournamentStore.getState().getTournamentMatches('1');
        expect(mappedMatches).toHaveLength(1);
        expect(mappedMatches[0].status).toBe('pending'); // transformed from 'pending_players'
        expect(mappedMatches[0].matchId).toBe('match1');
        expect(mappedMatches[0].player1Score).toBe(1);
    });

    it('getPlayerTournamentWins should return the correct count of wins', () => {
        const tournaments = [
            createTournament('1', TournamentStatus.COMPLETED, 'winnerId'),
            createTournament('2', TournamentStatus.COMPLETED, 'winnerId'),
            createTournament('3', TournamentStatus.COMPLETED, 'otherPlayer'),
        ];
        useTournamentStore.setState({tournaments});

        const wins = useTournamentStore.getState().getPlayerTournamentWins('winnerId');
        expect(wins).toBe(2);
    });
});
