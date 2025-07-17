import { v4 as uuidv4 } from 'uuid';

interface Player {
  id: string;
  name: string;
  ranking: number;
  losses: number;
  currentBracket: 'winner' | 'loser' | 'eliminated';
}

interface Match {
  id: string;
  player1: Player;
  player2: Player;
  winner?: Player;
  loser?: Player;
  round: number;
  bracket: 'winner' | 'loser' | 'final';
  stage?: 'minor' | 'major';
  isIfGame?: boolean;
}

export class EnhancedBrazilianSystem {
  private players: Player[] = [];
  private matches: Match[] = [];
  private currentWinnerRound: number = 1;
  private currentLoserRound: number = 1;
  private winnerBracket: Player[] = [];
  private loserBracket: Player[] = [];
  private eliminated: Player[] = [];
  private tournamentComplete: boolean = false;

  constructor(players: Player[]) {
    this.validateAndInitialize(players);
  }

  private validateAndInitialize(players: Player[]): void {
    if (players.length < 4) {
      throw new Error('Minimum 4 graczy wymagane');
    }
    if (!this.isPowerOfTwo(players.length)) {
      throw new Error('Liczba graczy musi być potęgą 2');
    }

    this.players = players
      .sort((a, b) => a.ranking - b.ranking)
      .map(p => ({ ...p, currentBracket: 'winner' as const }));
    
    this.winnerBracket = [...this.players];
    this.createFirstRound();
  }

  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  private createFirstRound(): void {
    const playerCount = this.players.length;
    
    for (let i = 0; i < playerCount / 2; i++) {
      const player1 = this.players[i];
      const player2 = this.players[playerCount - 1 - i];
      
      this.createMatch(player1, player2, 'winner');
    }
  }

  private createMatch(
    player1: Player, 
    player2: Player, 
    bracket: 'winner' | 'loser' | 'final',
    stage?: 'minor' | 'major',
    isIfGame?: boolean
  ): Match {
    const round = bracket === 'winner' ? this.currentWinnerRound : this.currentLoserRound;
    
    const match: Match = {
      id: `${bracket}-${round}-${this.matches.length}`,
      player1,
      player2,
      round,
      bracket,
      stage,
      isIfGame
    };
    
    this.matches.push(match);
    return match;
  }

  public playMatch(matchId: string, winnerId: string): void {
    const match = this.matches.find(m => m.id === matchId);
    if (!match || match.winner) {
      throw new Error('Nieprawidłowy mecz lub mecz już rozegrany');
    }

    const winner = [match.player1, match.player2].find(p => p.id === winnerId);
    const loser = [match.player1, match.player2].find(p => p.id !== winnerId);

    if (!winner || !loser) {
      throw new Error('Nieprawidłowy ID zwycięzcy');
    }

    match.winner = winner;
    match.loser = loser;
    loser.losses++;

    this.processMatchResult(match);
  }

  private processMatchResult(match: Match): void {
    const winner = match.winner!;
    const loser = match.loser!;

    if (match.bracket === 'winner') {
      loser.currentBracket = 'loser';
      this.loserBracket.push(loser);
      this.winnerBracket = this.winnerBracket.filter(p => p.id !== loser.id);
      
    } else if (match.bracket === 'loser') {
      this.eliminatePlayer(loser);
      this.loserBracket = this.loserBracket.filter(p => p.id !== loser.id);
      
    } else if (match.bracket === 'final') {
      this.handleFinalResult(match);
    }

    this.checkForNextRound();
  }

  private handleFinalResult(match: Match): void {
    const winner = match.winner!;
    const loser = match.loser!;

    if (match.isIfGame) {
      this.tournamentComplete = true;
    } else {
      if (winner.currentBracket === 'winner') {
        this.tournamentComplete = true;
      } else {
        this.createMatch(winner, loser, 'final', undefined, true);
      }
    }
  }

  private eliminatePlayer(player: Player): void {
    player.currentBracket = 'eliminated';
    this.eliminated.push(player);
  }

  private checkForNextRound(): void {
    const pendingMatches = this.matches.filter(m => !m.winner);
    
    if (pendingMatches.length === 0 && !this.tournamentComplete) {
      this.generateNextRound();
    }
  }

  private generateNextRound(): void {
    if (this.winnerBracket.length === 1 && this.loserBracket.length === 1) {
      this.createFinalMatch();
      return;
    }

    if (this.winnerBracket.length > 1) {
      this.currentWinnerRound++;
      this.createWinnerBracketMatches();
    }

    if (this.loserBracket.length > 1) {
      this.currentLoserRound++;
      this.createLoserBracketMatches();
    }
  }

  private createWinnerBracketMatches(): void {
    for (let i = 0; i < this.winnerBracket.length; i += 2) {
      if (i + 1 < this.winnerBracket.length) {
        this.createMatch(this.winnerBracket[i], this.winnerBracket[i + 1], 'winner');
      }
    }
  }

  private createLoserBracketMatches(): void {
    const loserCount = this.loserBracket.length;
    
    if (loserCount >= 2) {
      for (let i = 0; i < Math.floor(loserCount / 2); i++) {
        this.createMatch(
          this.loserBracket[i * 2], 
          this.loserBracket[i * 2 + 1], 
          'loser', 
          'minor'
        );
      }
    }
  }

  private createFinalMatch(): void {
    const winnerChampion = this.winnerBracket[0];
    const loserChampion = this.loserBracket[0];
    
    this.createMatch(winnerChampion, loserChampion, 'final');
  }

  public getExpectedGameCount(): number {
    const n = this.players.length;
    return 2 * n - 2;
  }

  public getTournamentStatus(): {
    winnerBracket: Player[];
    loserBracket: Player[];
    eliminated: Player[];
    isComplete: boolean;
    champion?: Player;
    pendingMatches: Match[];
  } {
    return {
      winnerBracket: this.winnerBracket,
      loserBracket: this.loserBracket,
      eliminated: this.eliminated,
      isComplete: this.tournamentComplete,
      champion: this.tournamentComplete ? this.getChampion() : undefined,
      pendingMatches: this.matches.filter(m => !m.winner)
    };
  }

  private getChampion(): Player | undefined {
    if (!this.tournamentComplete) return undefined;
    
    const finalMatches = this.matches.filter(m => m.bracket === 'final');
    const lastFinal = finalMatches[finalMatches.length - 1];
    
    return lastFinal?.winner;
  }

  public getBracketStructure(): string {
    let structure = "=== DRABINKA ZWYCIĘZCÓW ===\n";
    this.winnerBracket.forEach(p => {
      structure += `${p.name} (${p.ranking})\n`;
    });
    
    structure += "\n=== DRABINKA PRZEGRANEJ ===\n";
    this.loserBracket.forEach(p => {
      structure += `${p.name} (${p.ranking}) - ${p.losses} porażki\n`;
    });
    
    structure += "\n=== ELIMINOWANI ===\n";
    this.eliminated.forEach(p => {
      structure += `${p.name} (${p.ranking}) - ${p.losses} porażki\n`;
    });
    
    return structure;
  }

  public getMatches(): Match[] {
    return [...this.matches];
  }

  public getPlayers(): Player[] {
    return [...this.players];
  }
}
