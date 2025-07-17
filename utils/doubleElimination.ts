//utils/doubleElimination.ts
export interface Player {
    id: string;
    name: string;
    seed: number;
}

export interface Match {
    id: string;
    round: number;
    matchNumberInRound: number;
    bracket?: 'winner' | 'loser' | 'final';
    player1: Player | null;
    player2: Player | null;
    state: 'pending' | 'scheduled' | 'completed' | 'bye';
    winnerId?: string;
    loserId?: string;
    scores?: any; // For backward compatibility or simple scores
    sets?: any[]; // To store detailed set scores
    sourceMatch1Id?: string | null;
    sourceMatch2Id?: string | null;
}

export interface TournamentOptions {
    seeded: boolean;
    grandFinalsMode: 'true' | 'single';
}

export interface TournamentState {
    matches: Match[];
    players: Player[];
    champion?: Player;
    isFinished: boolean;
}

/**
 * Implements the logic for a double-elimination tournament.
 */
export class DoubleEliminationTournament {
    private players: Player[];
    matches: Match[] = [];
    private options: TournamentOptions;
    private nextMatchId = 1;
    isFinished = false;
    champion?: Player;

    private readonly DUMMY_PLAYER: Player = {id: 'dummy', name: 'BYE', seed: Infinity};

    /**
     * Creates an instance of a double-elimination tournament.
     * @param players - The list of players participating.
     * @param options - Optional tournament settings.
     */
    constructor(players: Player[], options?: Partial<TournamentOptions>) {
        if (players.length < 4) {
            throw new Error('A minimum of 4 players is required for this tournament format.');
        }

        this.options = {
            seeded: true,
            grandFinalsMode: 'true',
            ...options,
        };

        this.players = this.preparePlayers(players);
        this.generateBrackets();
        this.updatePendingMatches(); // Handle initial BYEs
    }

    /**
     * Reports the result of a match and updates the tournament state.
     * @param matchId - The ID of the match being reported.
     * @param winnerId - The ID of the winning player.
     * @param sets - Optional detailed set scores.
     */
    public reportMatchResult(matchId: string, winnerId: string, sets?: any[]): void {
        const match = this.findMatch(matchId);
        if (!match || match.state !== 'scheduled') {
            throw new Error(`Match with ID ${matchId} not found or not scheduled.`);
        }
        if (winnerId !== match.player1?.id && winnerId !== match.player2?.id) {
            throw new Error('Winner must be one of the players in the match.');
        }

        match.winnerId = winnerId;
        match.loserId = (winnerId === match.player1?.id) ? match.player2?.id : match.player1?.id;
        match.state = 'completed';
        match.sets = sets;

        this.advancePlayers(match);
        this.updatePendingMatches();
        this.checkForTournamentEnd();
    }

    /**
     * Returns a list of matches that are ready to be played.
     * @returns An array of matches in the 'scheduled' state.
     */
    public getUpcomingMatches(): Match[] {
        return this.matches.filter(m => m.state === 'scheduled');
    }

    /**
     * Returns the full, current state of the tournament.
     * @returns A tournament state object.
     */
    public getTournamentState(): TournamentState {
        return {
            matches: JSON.parse(JSON.stringify(this.matches)),
            players: JSON.parse(JSON.stringify(this.players.filter(p => p.id !== 'dummy'))),
            champion: this.champion ? JSON.parse(JSON.stringify(this.champion)) : undefined,
            isFinished: this.isFinished,
        };
    }

    private preparePlayers(initialPlayers: Player[]): Player[] {
        const sortedPlayers = this.options.seeded
            ? [...initialPlayers].sort((a, b) => a.seed - b.seed)
            : [...initialPlayers];

        const targetSize = Math.pow(2, Math.ceil(Math.log2(sortedPlayers.length)));

        while (sortedPlayers.length < targetSize) {
            sortedPlayers.push(this.DUMMY_PLAYER);
        }
        return sortedPlayers;
    }

    private generateBrackets(): void {
        this.generateWinnerBracket();
        this.generateLoserBracket();
        this.setupGrandFinals();
    }

    private generateWinnerBracket(): void {
        const numPlayers = this.players.length;
        const numRounds = Math.log2(numPlayers);

        // Round 1
        let currentPlayers = this.options.seeded ? this.getSeededPairs(this.players) : this.players;
        for (let i = 0; i < numPlayers / 2; i++) {
            const player1 = currentPlayers[i * 2];
            const player2 = currentPlayers[i * 2 + 1];
            const match = this.createMatch(1, i + 1, 'winner', player1, player2);
            this.matches.push(match);
        }

        // Subsequent WB rounds
        for (let round = 2; round <= numRounds; round++) {
            const numMatchesInRound = numPlayers / Math.pow(2, round);
            for (let i = 0; i < numMatchesInRound; i++) {
                const match = this.createMatch(round, i + 1, 'winner', null, null);
                this.matches.push(match);
            }
        }
    }

    private generateLoserBracket(): void {
        const numPlayers = this.players.length;
        const numWBRounds = Math.log2(numPlayers);
        let lbRound = 1;

        for (let wbRound = 1; wbRound < numWBRounds; wbRound++) {
            const numMatchesInRound = numPlayers / Math.pow(2, wbRound + 1);
            // Drop-down matches
            for (let i = 0; i < numMatchesInRound; i++) {
                const match = this.createMatch(lbRound, i + 1, 'loser', null, null);
                this.matches.push(match);
            }
            lbRound++;

            // Elimination matches
            for (let i = 0; i < numMatchesInRound; i++) {
                const match = this.createMatch(lbRound, i + 1, 'loser', null, null);
                this.matches.push(match);
            }
            lbRound++;
        }
    }

    private advancePlayers(match: Match): void {
        if (!match.winnerId || !match.loserId) return;
        const winner = this.findPlayer(match.winnerId!)
        const loser = this.findPlayer(match.loserId!)
        if (!winner || !loser) return;

        if (match.bracket === 'winner') {
            const nextWinnerMatch = this.findNextWinnerBracketMatch(match);
            if (nextWinnerMatch) {
                this.placePlayerInMatch(nextWinnerMatch, winner);
            } else { // Winner of WB final goes to Grand Final
                const finalMatch = this.matches.find(m => m.bracket === 'final' && m.round === 1);
                if (finalMatch) this.placePlayerInMatch(finalMatch, winner);
            }

            // Advance loser to loser's bracket
            if (loser.id !== 'dummy') {
                const nextLoserMatch = this.findNextLoserBracketMatchForWinner(match);
                if (nextLoserMatch) {
                    this.placePlayerInMatch(nextLoserMatch, loser);
                }
            }
        } else if (match.bracket === 'loser') {
            const nextLoserMatch = this.findNextLoserBracketMatchForLoser(match);
            if (nextLoserMatch) {
                this.placePlayerInMatch(nextLoserMatch, winner);
            } else { // Winner of LB final goes to Grand Final
                const finalMatch = this.matches.find(m => m.bracket === 'final' && m.round === 1);
                if (finalMatch) this.placePlayerInMatch(finalMatch, winner);
            }
            // Loser is eliminated
        } else if (match.bracket === 'final') {
            this.handleGrandFinalsResult(match);
        }

        this.updatePendingMatches();
    }

    private setupGrandFinals(): void {
        const finalMatch = this.createMatch(1, 1, 'final', null, null);
        this.matches.push(finalMatch);
    }

    private handleGrandFinalsResult(match: Match): void {
        const winnerId = match.winnerId!;
        const wbFinalist = this.getWinnerBracketFinalist();

        if (this.options.grandFinalsMode === 'single' || winnerId === wbFinalist?.id) {
            this.champion = this.findPlayer(winnerId);
            this.isFinished = true;
        } else {
            // Bracket reset
            const bracketResetMatch = this.matches.find(m => m.bracket === 'final' && m.round === 2);
            if (!bracketResetMatch) {
                const finalMatch2 = this.createMatch(2, 1, 'final', match.player1, match.player2);
                this.matches.push(finalMatch2);
            } else {
                this.champion = this.findPlayer(winnerId);
                this.isFinished = true;
            }
        }
    }

    private updatePendingMatches(): void {
        this.matches
            .filter(m => m.state === 'pending' && m.player1 && m.player2)
            .forEach(m => {
                if (m.player1.id === 'dummy' || m.player2.id === 'dummy') {
                    m.state = 'bye';
                    const winner = m.player1.id !== 'dummy' ? m.player1 : m.player2;
                    const loser = m.player1.id === 'dummy' ? m.player1 : m.player2;
                    m.winnerId = winner!.id;
                    m.loserId = loser!.id;
                    // Directly advance winner from BYE matches
                    this.advancePlayers(m);
                } else {
                    m.state = 'scheduled';
                }
            });
        this.checkForTournamentEnd();
    }

    // --- Helper Methods ---
    private createMatch(round: number, matchNumberInRound: number, bracket: 'winner' | 'loser' | 'final', p1: Player | null, p2: Player | null): Match {
        return {
            id: `M${this.nextMatchId++}`,
            round,
            matchNumberInRound,
            bracket,
            player1: p1,
            player2: p2,
            state: 'pending',
        };
    }

    private placePlayerInMatch(match: Match, player: Player): void {
        if (!match.player1) {
            match.player1 = player;
        } else if (!match.player2) {
            match.player2 = player;
        }
    }

    private getSeededPairs(players: Player[]): Player[] {
        const n = players.length;
        const pairs: Player[] = [];
        const p = [...players];
        while (p.length > 0) {
            pairs.push(p.shift()!);
            pairs.push(p.pop()!);
        }
        return pairs;
    }

    private findMatch(id: string): Match | undefined {
        return this.matches.find(m => m.id === id);
    }

    private findPlayer(id: string): Player | undefined {
        return this.players.find(p => p.id === id);
    }

    private findMatchByPosition(round: number, matchNumberInRound: number, bracket: 'winner' | 'loser'): Match | undefined {
        return this.matches.find(m => m.round === round && m.matchNumberInRound === matchNumberInRound && m.bracket === bracket);
    }

    private findNextWinnerBracketMatch(sourceMatch: Match): Match | undefined {
        const nextRound = sourceMatch.round + 1;
        const nextMatchNumber = Math.ceil(sourceMatch.matchNumberInRound / 2);
        return this.findMatchByPosition(nextRound, nextMatchNumber, 'winner');
    }

    private findNextLoserBracketMatchForWinner(sourceWBMatch: Match): Match | undefined {
        const wbRound = sourceWBMatch.round;
        let lbRound, lbMatchNum;

        // Determine the corresponding round in the loser's bracket
        if (wbRound === 1) {
            lbRound = 1;
            lbMatchNum = Math.ceil(sourceWBMatch.matchNumberInRound / 2);
        } else {
            lbRound = (wbRound - 1) * 2;
            lbMatchNum = sourceWBMatch.matchNumberInRound;
        }
        
        return this.findMatchByPosition(lbRound, lbMatchNum, 'loser');
    }

    private findNextLoserBracketMatchForLoser(sourceLBMatch: Match): Match | undefined {
        const currentRound = sourceLBMatch.round;
        const nextRound = currentRound + 1;
        let nextMatchNumber = sourceLBMatch.matchNumberInRound;

        // In LB, winners from odd rounds play each other in the next match of the same number
        // In LB, winners from even rounds play winners from another match in the next round
        if (currentRound % 2 !== 0) { // Odd round (e.g., 1, 3, 5...)
            nextMatchNumber = Math.ceil(sourceLBMatch.matchNumberInRound / 2);
        }
        // For even rounds, the match number stays the same, as they advance to play a dropdown loser

        return this.findMatchByPosition(nextRound, nextMatchNumber, 'loser');
    }

    private getWinnerBracketFinalist(): Player | undefined {
        const numWBRounds = Math.log2(this.players.length);
        const wbFinal = this.findMatchByPosition(numWBRounds, 1, 'winner');
        return wbFinal && wbFinal.winnerId ? this.findPlayer(wbFinal.winnerId) : undefined;
    }

    private checkForTournamentEnd(): void {
        if (this.isFinished) return;

        const grandFinal = this.matches.find(m => m.bracket === 'final' && m.state === 'completed');
        if (grandFinal && this.champion) {
            this.isFinished = true;
        }

        const ongoingMatches = this.matches.some(m => m.state === 'scheduled' || (m.state === 'pending' && m.bracket !== 'final'));
        if (!ongoingMatches && !this.champion) {
            const finalMatch = this.matches.find(m => m.bracket === 'final' && m.round === 1);
            if (finalMatch && finalMatch.state === 'completed') {
            } else if (!this.matches.some(m => m.state === 'scheduled' || m.state === 'pending')) {
                console.error("Tournament ended without a champion being decided.");
                this.isFinished = true;
            }
        }
    }
}
