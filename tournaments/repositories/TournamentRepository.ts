/**
 * Tournament Repository
 * Implements the Repository Pattern for tournament data access
 */
import { supabase } from '../../app/lib/supabase';
import { TournamentMatch, Tournament, Set as MatchSet } from '../../backend/types';
import { TournamentMatchInsert } from '../types/BaseTournament';

export interface ITournamentRepository {
  getTournamentById(id: string): Promise<Tournament | null>;
  getTournamentMatches(tournamentId: string): Promise<TournamentMatch[]>;
  getMatchById(matchId: string): Promise<any>;
  updateMatch(matchId: string, updates: Partial<any>): Promise<void>;
  createMatch(match: TournamentMatchInsert): Promise<void>;
  advancePlayerToNextMatch(nextMatchId: string, playerId: string): Promise<void>;
  setTournamentWinner(tournamentId: string, winnerId: string): Promise<void>;
  setTournamentStatus(tournamentId: string, status: string): Promise<void>;
  insertMatches(matches: TournamentMatchInsert[]): Promise<void>;
}

export class TournamentRepository implements ITournamentRepository {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  async getTournamentById(id: string): Promise<Tournament | null> {
    const cacheKey = `tournament_${id}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        id, name, date, format, status, winner_id, created_at, updated_at,
        tournament_participants ( player_id ),
        tournament_matches ( * )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching tournament:', error);
      return null;
    }

    const tournament: Tournament = {
      id: data.id,
      name: data.name,
      date: data.date,
      format: data.format,
      status: data.status,
      participants: data.tournament_participants?.map((p: any) => p.player_id) || [],
      matches: data.tournament_matches?.map((m: any) => this.transformMatchData(m)) || [],
      winner: data.winner_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    this.cache.set(cacheKey, { data: tournament, timestamp: Date.now() });
    return tournament;
  }

  async getTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
    const cacheKey = `matches_${tournamentId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round', { ascending: true })
      .order('match_number', { ascending: true });

    if (error) {
      console.error('Error fetching tournament matches:', error);
      return [];
    }

    const matches = data.map(m => this.transformMatchData(m));
    this.cache.set(cacheKey, { data: matches, timestamp: Date.now() });
    return matches;
  }

  async getMatchById(matchId: string): Promise<any> {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (error) {
      console.error('Error fetching match:', error);
      return null;
    }

    return data;
  }

  async updateMatch(matchId: string, updates: Partial<any>): Promise<void> {
    const { error } = await supabase
      .from('tournament_matches')
      .update(updates)
      .eq('id', matchId);

    if (error) {
      console.error('Error updating match:', error);
      throw error;
    }

    this.invalidateMatchCaches(matchId);
  }

  async createMatch(match: TournamentMatchInsert): Promise<void> {
    const { error } = await supabase
      .from('tournament_matches')
      .insert({
        ...match,
        sets: match.sets ? JSON.stringify(match.sets) : null,
      });

    if (error) {
      console.error('Error creating match:', error);
      throw error;
    }

    this.cache.delete(`matches_${match.tournament_id}`);
    this.cache.delete(`tournament_${match.tournament_id}`);
  }

  async advancePlayerToNextMatch(nextMatchId: string, playerId: string): Promise<void> {
    const nextMatch = await this.getMatchById(nextMatchId);
    if (!nextMatch) {
      throw new Error('Next match not found');
    }

    let updateData: { player1_id?: string; player2_id?: string } = {};
    if (!nextMatch.player1_id) {
      updateData = { player1_id: playerId };
    } else if (!nextMatch.player2_id) {
      updateData = { player2_id: playerId };
    } else {
      throw new Error('Next match already has both players assigned');
    }

    await this.updateMatch(nextMatchId, updateData);

    if ((nextMatch.player1_id && updateData.player2_id) || 
        (nextMatch.player2_id && updateData.player1_id)) {
      await this.updateMatch(nextMatchId, { status: 'scheduled' });
    }
  }

  async setTournamentWinner(tournamentId: string, winnerId: string): Promise<void> {
    const { error } = await supabase
      .from('tournaments')
      .update({
        winner_id: winnerId,
        status: 'completed'
      })
      .eq('id', tournamentId);

    if (error) {
      console.error('Error setting tournament winner:', error);
      throw error;
    }

    this.cache.delete(`tournament_${tournamentId}`);
  }
  async setTournamentStatus(tournamentId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('tournaments')
      .update({ status })
      .eq('id', tournamentId);

    if (error) {
      console.error('Error setting tournament status:', error);
      throw error;
    }

    this.cache.delete(`tournament_${tournamentId}`);
  }



  async insertMatches(matches: TournamentMatchInsert[]): Promise<void> {
    const { error } = await supabase
      .from('tournament_matches')
      .insert(
        matches.map(match => ({
          ...match,
          sets: match.sets ? JSON.stringify(match.sets) : null,
        }))
      );

    if (error) {
      console.error('Error inserting matches:', error);
      throw error;
    }

    const tournamentIds = new Set(matches.map(m => m.tournament_id));
    tournamentIds.forEach(tournamentId => {
      this.cache.delete(`matches_${tournamentId}`);
      this.cache.delete(`tournament_${tournamentId}`);
    });
  }

  private transformMatchData(match: any): TournamentMatch {
    return {
      id: match.id,
      tournamentId: match.tournament_id,
      round: match.round,
      matchNumber: match.match_number,
      matchId: match.match_id,
      player1Id: match.player1_id,
      player2Id: match.player2_id,
      player1Score: match.player1_score,
      player2Score: match.player2_score,
      winner: match.winner_id,
      status: match.status,
      nextMatchId: match.next_match_id,
      sets: match.sets,
      group: match.group,
      bracket: match.bracket
    };
  }

  private invalidateMatchCaches(matchId: string): void {
    this.cache.clear();
  }

  clearCache(): void {
    this.cache.clear();
  }
}
