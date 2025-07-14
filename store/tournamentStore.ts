// store/tournamentStore.ts
import {create} from 'zustand';

type ClientSideTournamentState = {
    lastViewedTournamentId: string | null;
    setLastViewedTournamentId: (id: string) => void;
    activeFilterTab: 'upcoming' | 'active' | 'completed';
    setActiveFilterTab: (tab: 'upcoming' | 'active' | 'completed') => void;
};

export const useTournamentStore = create<ClientSideTournamentState>((set) => ({
    lastViewedTournamentId: null,
    setLastViewedTournamentId: (id) => set({lastViewedTournamentId: id}),
    activeFilterTab: 'upcoming',
    setActiveFilterTab: (tab) => set({activeFilterTab: tab}),
}));
