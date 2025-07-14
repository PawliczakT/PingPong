import * as tournamentsApi from '@/api/tournamentsApi';
import {supabase} from '@/app/lib/supabase';
import {TournamentFormat, TournamentStatus} from '@/backend/types';
import {usePlayerStore} from '@/store/playerStore';

jest.mock('@/app/lib/supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        rpc: jest.fn(),
    },
}));

jest.mock('@/store/playerStore');
jest.mock('@/store/matchStore');
jest.mock('@/backend/server/trpc/services/notificationService');

const mockedUsePlayerStore = usePlayerStore as jest.Mocked<typeof usePlayerStore>;
const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe('tournamentsApi', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createTournament', () => {
        it('should successfully create a tournament with valid data', async () => {
            const params = {
                name: 'Test Cup',
                date: '2025-07-15',
                format: TournamentFormat.KNOCKOUT,
                playerIds: ['p1', 'p2', 'p3', 'p4'],
            };

            const mockTournamentData = {id: 'new-tournament-id', ...params};

            (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
                if (table === 'tournaments') {
                    return {
                        insert: jest.fn().mockReturnValue({
                            select: jest.fn().mockImplementation(() => ({
                                single: jest.fn().mockResolvedValue({data: mockTournamentData, error: null}),
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({data: mockTournamentData, error: null}),
                                }),
                            }))
                        }),
                        select: jest.fn().mockImplementation(() => ({
                            single: jest.fn().mockResolvedValue({data: mockTournamentData, error: null}),
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({data: mockTournamentData, error: null}),
                            }),
                        })),
                        delete: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({error: null}),
                        }),
                    };
                }
                if (table === 'tournament_participants') {
                    return {
                        insert: jest.fn().mockResolvedValue({error: null}),
                        delete: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({error: null}),
                        }),
                    };
                }
                return {from: jest.fn().mockReturnThis()};
            });

            const newTournament = await tournamentsApi.createTournament(params);

            expect(newTournament.id).toBe('new-tournament-id');
            expect(mockedSupabase.from).toHaveBeenCalledWith('tournaments');
            expect(mockedSupabase.from).toHaveBeenCalledWith('tournament_participants');
        });

        it('should throw an error if less than 2 players are provided', async () => {
            const params = {
                name: 'Small Cup',
                date: '2025-07-15',
                format: TournamentFormat.KNOCKOUT,
                playerIds: ['p1'],
            };

            await expect(tournamentsApi.createTournament(params)).rejects.toThrow('Minimum 2 players required');
        });
    });

    describe('setTournamentWinner', () => {
        it('should update tournament status and winner_id', async () => {
            const params = {tournamentId: 't1', winnerId: 'p1'};

            (mockedUsePlayerStore.getState as jest.Mock).mockReturnValue({
                getPlayerById: (id: string) => ({id, name: 'Test Player'})
            });

            (mockedSupabase.from as jest.Mock).mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({error: null})
                }),
                select: jest.fn().mockImplementation(() => ({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({data: {id: 't1', name: 'Test'}, error: null})
                    })
                }))
            });

            await tournamentsApi.setTournamentWinner(params);

            const updateCall = (mockedSupabase.from as jest.Mock).mock.results[0].value.update;
            expect(updateCall).toHaveBeenCalledWith({
                winner_id: params.winnerId,
                status: TournamentStatus.COMPLETED,
            });
        });
    });

    describe('fetchTournaments', () => {
        it('should fetch and process tournaments correctly', async () => {
            const mockRawData = [
                {
                    id: 't2',
                    name: 'Active Tournament',
                    status: 'active',
                    date: '2025-01-02',
                    tournament_participants: [],
                    tournament_matches: []
                },
                {
                    id: 't1',
                    name: 'Upcoming Tournament',
                    status: 'pending',
                    date: '2025-01-03',
                    tournament_participants: [],
                    tournament_matches: []
                },
                {
                    id: 't3',
                    name: 'Completed Tournament',
                    status: 'completed',
                    date: '2025-01-01',
                    tournament_participants: [],
                    tournament_matches: []
                },
            ];

            (mockedSupabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({data: mockRawData, error: null})
                })
            });

            const tournaments = await tournamentsApi.fetchTournaments();

            expect(tournaments.length).toBe(3);
            expect(tournaments[0].id).toBe('t2');
            expect(tournaments[1].id).toBe('t1');
            expect(tournaments[2].id).toBe('t3');
        });
    });
});
