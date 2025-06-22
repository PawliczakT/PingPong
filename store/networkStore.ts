//store/networkStore.ts
import {create} from "zustand";
import {createJSONStorage, persist} from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {Set} from "@/backend/types";
import {useMatchStore} from "./matchStore";

interface PendingMatch {
    id: string;
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    sets: Set[];
    createdAt: string;
}

interface NetworkState {
    isOnline: boolean;
    pendingMatches: PendingMatch[];
    lastSyncAttempt: string | null;
    setOnlineStatus: (status: boolean) => void;
    addPendingMatch: (match: PendingMatch) => void;
    removePendingMatch: (matchId: string) => void;
    getPendingMatches: () => PendingMatch[];
    syncPendingMatches: () => Promise<void>;
    checkNetworkStatus: () => Promise<boolean>;
    setLastSyncAttempt: (timestamp: string | null) => void;
}

export const useNetworkStore = create<NetworkState>()(
    persist(
        (set, get) => ({
            isOnline: true,
            pendingMatches: [],
            lastSyncAttempt: null,

            setOnlineStatus: (status) => {
                set({isOnline: status});
            },

            addPendingMatch: (match) => {
                set((state) => ({
                    pendingMatches: [...state.pendingMatches, match],
                }));
            },

            removePendingMatch: (matchId) => {
                set((state) => ({
                    pendingMatches: state.pendingMatches.filter(match => match.id !== matchId),
                }));
            },

            getPendingMatches: () => {
                return get().pendingMatches;
            },

            syncPendingMatches: async () => {
                const isOnline = await get().checkNetworkStatus();
                if (!isOnline || get().pendingMatches.length === 0) return;

                const matchStore = useMatchStore.getState();
                const pendingMatches = [...get().pendingMatches];

                for (const pendingMatch of pendingMatches) {
                    try {
                        await matchStore.addMatch(
                            pendingMatch.player1Id,
                            pendingMatch.player2Id,
                            pendingMatch.player1Score,
                            pendingMatch.player2Score,
                            pendingMatch.sets
                        );

                        get().removePendingMatch(pendingMatch.id);
                    } catch (error) {
                        console.error("Failed to sync match:", error);
                    }
                }

                get().setLastSyncAttempt(new Date().toISOString());
            },

            checkNetworkStatus: async () => {
                try {
                    const state = await NetInfo.fetch();
                    const isConnected = state.isConnected ?? false;
                    get().setOnlineStatus(isConnected);
                    return isConnected;
                } catch (error) {
                    console.error("Failed to check network status:", error);
                    return false;
                }
            },

            setLastSyncAttempt: (timestamp) => {
                set({lastSyncAttempt: timestamp});
            },
        }),
        {
            name: "pingpong-network",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
