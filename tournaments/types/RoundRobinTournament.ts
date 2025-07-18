/**
 * Round Robin Tournament Strategy
 * Implements round-robin tournament logic with advanced ranking
 */
import { TournamentFormat, TournamentMatch, Set as MatchSet } from '../../backend/types';
import { BaseTournamentStrategy, TournamentMatchInsert } from './BaseTournament';
import { TournamentRepository } from '../repositories/TournamentRepository';

interface PlayerStats {
  playerId: string;
  mainPoints: number;
  matchesPlayed: number;
  matchesWon: number;
  setsWon: number;
  setsLost: number;
  smallPointsWon: number;
  smallPointsLost: number;
  headToHead: Record<string, number>;
}

export class RoundRobinTournamentStrategy extends BaseTournamentStrategy {
  readonly format = TournamentFormat.ROUND_ROBIN;
  
  constructor(private repository: TournamentRepository) {
    super();
  }
  
  validateConfiguration(playerIds: string[]): { valid: boolean; error?: string } {
    if (playerIds.length < 2) {
      return { valid: false, error: "Minimum 2 players required" };
    }
    
    return { valid: true };
  }
  
  async generateMatches(tournamentId: string, playerIds: string[]): Promise<TournamentMatchInsert[]> {
    const validation = this.validateConfiguration(playerIds);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const schedule = this.generateRoundRobinSchedule(playerIds);
    
    return schedule.map((match, index) => ({
      id: this.generateMatchId(),
      tournament_id: tournamentId,
      round: 1,
      match_number: index + 1,
      player1_id: match.player1Id,
      player2_id: match.player2Id,
      player1_score: null,
      player2_score: null,
      winner_id: null,
      status: 'scheduled' as const,
      next_match_id: null,
      stage: null,
      bracket: null,
      sets: null,
    }));
  }
  
  private generateRoundRobinSchedule(playerIds: string[]): { player1Id: string, player2Id: string }[] {
    const schedule: { player1Id: string, player2Id: string }[] = [];
    
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        schedule.push({ player1Id: playerIds[i], player2Id: playerIds[j] });
      }
    }
    
    return schedule;
  }
  
  async updateMatchResult(
    tournamentId: string,
    matchId: string,
    scores: { player1Score: number; player2Score: number; sets?: MatchSet[] }
  ): Promise<void> {
    if (scores.player1Score === scores.player2Score) {
      throw new Error('Scores cannot be equal');
    }
    
    const matchData = await this.repository.getMatchById(matchId);
    if (!matchData) {
      throw new Error('Match not found');
    }
    
    const winnerId = scores.player1Score > scores.player2Score
      ? matchData.player1_id
      : matchData.player2_id;
    
    await this.repository.updateMatch(matchId, {
      player1_score: scores.player1Score,
      player2_score: scores.player2Score,
      winner_id: winnerId,
      status: 'completed',
      sets: scores.sets ? JSON.stringify(scores.sets) : null
    });
    
    const allMatches = await this.repository.getTournamentMatches(tournamentId);
    const allCompleted = allMatches.every(m => m.status === 'completed');
    
    if (allCompleted) {
      const winner = await this.determineWinner(tournamentId, allMatches);
      if (winner) {
        await this.repository.setTournamentWinner(tournamentId, winner);
      }
    }
  }
  
  async determineWinner(tournamentId: string, matches: TournamentMatch[]): Promise<string | null> {
    const allMatchesCompleted = matches.every(m => m.status === 'completed');
    if (!allMatchesCompleted || matches.length === 0) {
      return null;
    }
    
    const playerStats: Record<string, PlayerStats> = {};
    const playerIds = new Set<string>();
    
    matches.forEach(match => {
      if (match.player1Id) playerIds.add(match.player1Id);
      if (match.player2Id) playerIds.add(match.player2Id);
    });
    
    playerIds.forEach(playerId => {
      playerStats[playerId] = {
        playerId,
        mainPoints: 0,
        matchesPlayed: 0,
        matchesWon: 0,
        setsWon: 0,
        setsLost: 0,
        smallPointsWon: 0,
        smallPointsLost: 0,
        headToHead: {}
      };
    });
    
    matches.forEach(match => {
      if (match.status !== 'completed' || !match.player1Id || !match.player2Id) return;
      
      const player1 = playerStats[match.player1Id];
      const player2 = playerStats[match.player2Id];
      
      player1.matchesPlayed++;
      player2.matchesPlayed++;
      
      let p1SetsWon = 0;
      let p2SetsWon = 0;
      
      if (match.sets && Array.isArray(match.sets)) {
        match.sets.forEach((set: any) => {
          const p1Score = set.player1Score || 0;
          const p2Score = set.player2Score || 0;
          
          player1.smallPointsWon += p1Score;
          player1.smallPointsLost += p2Score;
          player2.smallPointsWon += p2Score;
          player2.smallPointsLost += p1Score;
          
          if (p1Score > p2Score) {
            p1SetsWon++;
          } else if (p2Score > p1Score) {
            p2SetsWon++;
          }
        });
      }
      
      player1.setsWon += p1SetsWon;
      player1.setsLost += p2SetsWon;
      player2.setsWon += p2SetsWon;
      player2.setsLost += p1SetsWon;
      
      if (match.winner === match.player1Id) {
        player1.mainPoints += 2;
        player1.matchesWon++;
        player2.mainPoints += 1;
        player1.headToHead[match.player2Id] = 1;
        player2.headToHead[match.player1Id] = -1;
      } else if (match.winner === match.player2Id) {
        player2.mainPoints += 2;
        player2.matchesWon++;
        player1.mainPoints += 1;
        player2.headToHead[match.player1Id] = 1;
        player1.headToHead[match.player2Id] = -1;
      }
    });
    
    const rankedPlayers = Object.values(playerStats).sort((a, b) => {
      if (a.mainPoints !== b.mainPoints) {
        return b.mainPoints - a.mainPoints;
      }
      
      const aMatchRatio = a.matchesWon / (a.matchesPlayed || 1);
      const bMatchRatio = b.matchesWon / (b.matchesPlayed || 1);
      if (aMatchRatio !== bMatchRatio) {
        return bMatchRatio - aMatchRatio;
      }
      
      const aSetRatio = a.setsWon / (a.setsWon + a.setsLost || 1);
      const bSetRatio = b.setsWon / (b.setsWon + b.setsLost || 1);
      if (aSetRatio !== bSetRatio) {
        return bSetRatio - aSetRatio;
      }
      
      const aPointRatio = a.smallPointsWon / (a.smallPointsWon + a.smallPointsLost || 1);
      const bPointRatio = b.smallPointsWon / (b.smallPointsWon + b.smallPointsLost || 1);
      if (aPointRatio !== bPointRatio) {
        return bPointRatio - aPointRatio;
      }
      
      if (a.headToHead[b.playerId] !== undefined) {
        return a.headToHead[b.playerId] > 0 ? -1 : 1;
      }
      
      return 0;
    });
    
    return rankedPlayers.length > 0 ? rankedPlayers[0].playerId : null;
  }
}
