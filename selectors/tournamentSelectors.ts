//selectors/tournamentSelectors.ts
import {Tournament, TournamentStatus} from "@/backend/types";

export const getPlayerTournamentWins = (
    playerId: string,
    tournaments: Tournament[] | undefined
): number => {
    if (!tournaments || !playerId) {
        return 0;
    }

    return tournaments.filter(t =>
        t.status === TournamentStatus.COMPLETED && t.winner === playerId
    ).length;
};
