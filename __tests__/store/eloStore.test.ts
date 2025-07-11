import {useEloStore} from '@/store/eloStore';
import {usePlayerStore} from '@/store/playerStore';
import {act} from '@testing-library/react-native';
import {Player} from "@/backend/types";

// Mockowanie store'u graczy
jest.mock('@/store/playerStore');

const mockUpdatePlayer = jest.fn();

const mockPlayers: Player[] = [
    {
        id: '1',
        name: 'Player A',
        eloRating: 1500,
        gamesPlayed: 10,
        wins: 5,
        losses: 5,
        winStreak: 0,
        lossStreak: 0,
        // @ts-ignore
        rank: {id: 1, name: 'Bronze', icon: 'bronze-icon'},
        dailyDelta: 0,
        lastMatchDay: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true,
    },
    {
        id: '2',
        name: 'Player B',
        eloRating: 1500,
        gamesPlayed: 10,
        wins: 5,
        losses: 5,
        winStreak: 0,
        lossStreak: 0,
        // @ts-ignore
        rank: {id: 1, name: 'Bronze', icon: 'bronze-icon'},
        dailyDelta: 0,
        lastMatchDay: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true,
    },
    {
        id: '3',
        name: 'Player C',
        eloRating: 1600,
        gamesPlayed: 20,
        wins: 10,
        losses: 10,
        winStreak: 0,
        lossStreak: 0,
        // @ts-ignore
        rank: {id: 2, name: 'Silver', icon: 'silver-icon'},
        dailyDelta: 0,
        lastMatchDay: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true,
    },
];

const mockedUsePlayerStore = usePlayerStore as unknown as jest.Mock;

describe('useEloStore', () => {
    let updatePlayerSpy: jest.SpyInstance;

    beforeEach(() => {
        // Reset mocków i stanu store przed każdym testem
        jest.clearAllMocks();

        // Ustawienie implementacji mocka dla usePlayerStore
        mockedUsePlayerStore.mockReturnValue({
            players: mockPlayers,
            getPlayerById: (id: string) => mockPlayers.find(p => p.id === id),
            updatePlayer: mockUpdatePlayer,
        });

        // Mockowanie `getState` jest kluczowe dla akcji, które go używają wewnątrz store'a
        (usePlayerStore as any).getState = () => ({
            players: mockPlayers,
            getPlayerById: (id: string) => mockPlayers.find(p => p.id === id),
            updatePlayer: mockUpdatePlayer,
        });

        // Szpiegowanie metody updatePlayer, aby móc ją weryfikować
        updatePlayerSpy = jest.spyOn(usePlayerStore.getState(), 'updatePlayer');

        // Reset stanu eloStore
        act(() => {
            useEloStore.setState(useEloStore.getInitialState(), true);
        });
    });

    afterEach(() => {
        updatePlayerSpy.mockRestore();
    });

    it('powinien poprawnie inicjalizować się z danymi graczy', () => {
        act(() => {
            useEloStore.getState().initialize(mockPlayers);
        });

        const {elo, isInitialized} = useEloStore.getState();
        expect(isInitialized).toBe(true);
        expect(elo.getPlayerStats('1')?.rating).toBe(1500);
        expect(elo.getPlayerStats('2')?.rating).toBe(1500);
        expect(elo.getPlayerStats('3')?.rating).toBe(1600);
    });

    it('powinien aktualizować rankingi po meczu', async () => {
        act(() => {
            useEloStore.getState().initialize(mockPlayers);
        });

        const winnerId = '1'; // ELO 1500
        const loserId = '3';  // ELO 1600
        const matchDate = new Date();

        await act(async () => {
            await useEloStore.getState().updateRatingsAfterMatch(winnerId, loserId, matchDate);
        });

        const {elo} = useEloStore.getState();
        const winnerStats = elo.getPlayerStats(winnerId);
        const loserStats = elo.getPlayerStats(loserId);

        // Gracz 1 (niższy ranking) wygrał, więc jego ELO powinno wzrosnąć
        expect(winnerStats?.rating).toBeGreaterThan(1500);
        // Gracz 3 (wyższy ranking) przegrał, więc jego ELO powinno spaść
        expect(loserStats?.rating).toBeLessThan(1600);

        // Sprawdzenie, czy playerStore.updatePlayer zostało wywołane z poprawnymi danymi
        expect(updatePlayerSpy).toHaveBeenCalledTimes(2);

        // Sprawdzenie wywołania dla zwycięzcy
        expect(updatePlayerSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                id: winnerId,
                eloRating: expect.any(Number),
            }),
        );

        // Sprawdzenie wywołania dla przegranego
        expect(updatePlayerSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                id: loserId,
                eloRating: expect.any(Number),
            }),
        );
    });

    it('powinien zwracać posortowaną tablicę wyników', () => {
        act(() => {
            useEloStore.getState().initialize(mockPlayers);
        });

        const leaderboard = useEloStore.getState().getLeaderboard();

        // Oczekiwana kolejność: Gracz C (1600), Gracz A (1500), Gracz B (1500)
        expect(leaderboard.map(p => p.id)).toEqual(['3', '1', '2']);
        expect(leaderboard[0].stats.rating).toBe(1600);
    });

    it('nie powinien aktualizować rankingu, jeśli gracz nie zostanie znaleziony', async () => {
        act(() => {
            useEloStore.getState().initialize(mockPlayers);
        });

        const winnerId = '1';
        const loserId = '4'; // Nieistniejący gracz

        // Mock, że getPlayerById zwraca undefined dla nieistniejącego gracza
        const getPlayerByIdMock = (id: string) => {
            if (id === loserId) return undefined;
            return mockPlayers.find(p => p.id === id);
        };
        (usePlayerStore as any).getState = () => ({
            players: mockPlayers,
            getPlayerById: getPlayerByIdMock,
            updatePlayer: mockUpdatePlayer,
        });

        await act(async () => {
            await useEloStore.getState().updateRatingsAfterMatch(winnerId, loserId, new Date());
        });

        // updatePlayer nie powinno zostać wywołane
        expect(updatePlayerSpy).not.toHaveBeenCalled();
    });
});
