import {useTournamentStore} from '@/store/tournamentStore';

const resetTournamentStoreState = () => {
    useTournamentStore.setState({
        lastViewedTournamentId: null,
        activeFilterTab: 'upcoming',
        setLastViewedTournamentId: useTournamentStore.getState().setLastViewedTournamentId,
        setActiveFilterTab: useTournamentStore.getState().setActiveFilterTab,
    }, true);
};

describe('useTournamentStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetTournamentStoreState();
    });

    it('should initialize with default values', () => {
        const state = useTournamentStore.getState();
        expect(state.lastViewedTournamentId).toBeNull();
        expect(state.activeFilterTab).toBe('upcoming');
    });

    it('setLastViewedTournamentId should update the id', () => {
        const {setLastViewedTournamentId} = useTournamentStore.getState();
        setLastViewedTournamentId('tournament-123');

        expect(useTournamentStore.getState().lastViewedTournamentId).toBe('tournament-123');
    });

    it('setActiveFilterTab should update the active tab', () => {
        const {setActiveFilterTab} = useTournamentStore.getState();
        setActiveFilterTab('completed');

        expect(useTournamentStore.getState().activeFilterTab).toBe('completed');

        setActiveFilterTab('active');
        expect(useTournamentStore.getState().activeFilterTab).toBe('active');
    });

    it('should allow setting lastViewedTournamentId back to null', () => {
        const {setLastViewedTournamentId} = useTournamentStore.getState();
        setLastViewedTournamentId('tournament-xyz');
        expect(useTournamentStore.getState().lastViewedTournamentId).toBe('tournament-xyz');

        setLastViewedTournamentId(null as unknown as string); // Casting because the setter expects string
        expect(useTournamentStore.getState().lastViewedTournamentId).toBeNull();
    });
});
