// store/tournamentStore.ts
import {create} from 'zustand';
import {Tournament} from "@/backend/types";

type ClientSideTournamentState = {
    lastViewedTournamentId: string | null;
    setLastViewedTournamentId: (id: string) => void;
    activeFilterTab: 'upcoming' | 'active' | 'completed';
    setActiveFilterTab: (tab: 'upcoming' | 'active' | 'completed') => void;
    tournaments: Tournament[];
    setTournaments: (tournaments: Tournament[]) => void;
    getPlayerTournamentWins: (playerId: string) => number;
};

export const useTournamentStore = create<ClientSideTournamentState>((set) => ({
    lastViewedTournamentId: null,
    setLastViewedTournamentId: (id) => set({lastViewedTournamentId: id}),
    activeFilterTab: 'upcoming',
    setActiveFilterTab: (tab) => set({activeFilterTab: tab}),
    tournaments: [],
    setTournaments: (tournaments) => set({tournaments}),
    getPlayerTournamentWins: (playerId) => {
        if (!playerId) return 0;
        const {tournaments} = useTournamentStore.getState();
        return tournaments.filter(
            (t) => t.status === 'completed' && t.winner === playerId
        ).length;
    },
}));
