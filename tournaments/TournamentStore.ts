/**
 * Refactored Tournament Store
 * Main class that orchestrates all tournament operations using design patterns
 */
import { create } from 'zustand';
import { supabase } from '../app/lib/supabase';
import { Tournament, TournamentFormat, TournamentMatch, TournamentStatus, Set as MatchSet } from '../backend/types';
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect } from "react";

import { TournamentRepository } from './repositories/TournamentRepository';
import { TournamentFactory, getTournamentFactory } from './factories/TournamentFactory';
import { TournamentEventManager, getTournamentEventManager } from './observers/TournamentObserver';
import { TournamentBuilder, createTournament } from './builders/TournamentBuilder';
import { TournamentHelper } from './utils/TournamentHelper';

class TournamentCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 30000; // 30 seconds

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }
    return null;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export type TournamentStore = {
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  lastFetchTimestamp: number | null;

  fetchTournaments: (options?: { force?: boolean }) => Promise<void>;
  createTournament: (name: string, date: string, format: TournamentFormat, playerIds: string[]) => Promise<string | undefined>;
  updateMatchResult: (tournamentId: string, matchId: string, scores: {
    player1Score: number;
    player2Score: number;
    sets?: MatchSet[]
  }) => Promise<void>;
  generateAndStartTournament: (tournamentId: string) => Promise<void>;
  generateTournamentMatches: (tournamentId: string) => Promise<void>;

  getTournamentById: (id: string) => Tournament | undefined;
  getTournamentMatches: (tournamentId: string) => TournamentMatch[];
  getUpcomingTournaments: () => Tournament[];
  getActiveTournaments: () => Tournament[];
  getCompletedTournaments: () => Tournament[];
  getPlayerTournamentWins: (playerId: string) => number;

  updateTournamentStatus: (tournamentId: string, status: Tournament['status']) => Promise<void>;
  setTournamentWinner: (tournamentId: string, winnerId: string) => Promise<void>;

  handleTournamentUpdate: (payload: RealtimePostgresChangesPayload<any>) => void;
  handleMatchUpdate: (payload: RealtimePostgresChangesPayload<any>) => void;

  createTournamentBuilder: () => TournamentBuilder;
  getTournamentHelper: () => typeof TournamentHelper;
  
  clearCache: () => void;
  getCache: () => TournamentCache;
};

const tournamentCache = new TournamentCache();
const repository = new TournamentRepository();
const factory = getTournamentFactory();
const eventManager = getTournamentEventManager();

let tournamentChannel: RealtimeChannel | null = null;

const getTournamentChannel = () => {
  if (!tournamentChannel) {
    tournamentChannel = supabase.channel('tournaments-realtime');
  }
  return tournamentChannel;
};

const transformMatchData = (match: any): TournamentMatch => {
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
};

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  tournaments: [],
  loading: false,
  error: null,
  lastFetchTimestamp: null,

  handleTournamentUpdate: (payload) => {
    const { eventType, new: newRecord, old } = payload;
    set(state => {
      const tournaments = [...state.tournaments];
      const index = tournaments.findIndex(t => t.id === (eventType === 'DELETE' ? old.id : newRecord.id));

      if (eventType === 'INSERT') {
        if (index === -1) {
          tournaments.push({ ...newRecord, matches: [] });
        }
      } else if (eventType === 'UPDATE') {
        if (index !== -1) {
          tournaments[index] = { ...tournaments[index], ...newRecord };
        }
      } else if (eventType === 'DELETE') {
        if (index !== -1) {
          tournaments.splice(index, 1);
        }
      }
      return { tournaments };
    });

    eventManager.notify({
      type: eventType === 'INSERT' ? 'TOURNAMENT_CREATED' : 
            eventType === 'UPDATE' ? 'TOURNAMENT_STARTED' : 'TOURNAMENT_COMPLETED',
      tournamentId: (eventType === 'DELETE' ? old.id : newRecord.id),
      data: newRecord,
      timestamp: Date.now()
    });
  },

  handleMatchUpdate: (payload) => {
    const { eventType, new: newRecord, old } = payload;
    set(state => {
      const tournaments = state.tournaments.map(t => {
        if (t.id === newRecord.tournament_id) {
          const matches = t.matches ? [...t.matches] : [];
          const matchIndex = matches.findIndex(m => m.id === (eventType === 'DELETE' ? old.id : newRecord.id));

          if (eventType === 'INSERT') {
            if (matchIndex === -1) {
              matches.push(transformMatchData(newRecord));
            }
          } else if (eventType === 'UPDATE') {
            if (matchIndex !== -1) {
              matches[matchIndex] = transformMatchData(newRecord);
            }
          } else if (eventType === 'DELETE') {
            if (matchIndex !== -1) {
              matches.splice(matchIndex, 1);
            }
          }
          return { ...t, matches };
        }
        return t;
      });
      return { tournaments };
    });

    if (eventType === 'UPDATE' && newRecord.status === 'completed') {
      eventManager.notify({
        type: 'MATCH_COMPLETED',
        tournamentId: newRecord.tournament_id,
        data: newRecord,
        timestamp: Date.now()
      });
    }
  },

  fetchTournaments: async (options?: { force?: boolean }) => {
    if (get().loading && !options?.force) {
      return;
    }

    const lastFetchTimestamp = get().lastFetchTimestamp;
    const now = Date.now();
    const FETCH_INTERVAL = 1500;

    if (lastFetchTimestamp && (now - lastFetchTimestamp < FETCH_INTERVAL) && !options?.force) {
      return;
    }

    const cacheKey = 'all_tournaments';
    const cached = tournamentCache.get<Tournament[]>(cacheKey);
    if (cached && !options?.force) {
      set({ tournaments: cached, loading: false, error: null, lastFetchTimestamp: Date.now() });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { data: rawTournaments, error } = await supabase
        .from('tournaments')
        .select(`
          id, name, date, format, status, winner_id, created_at, updated_at,
          tournament_participants ( player_id ),
          tournament_matches ( * ) 
        `)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      if (!rawTournaments) {
        set({
          tournaments: [],
          loading: false,
          error: 'No tournaments data returned',
          lastFetchTimestamp: Date.now()
        });
        return;
      }

      const processedTournaments = rawTournaments.map((t: any) => ({
        id: t.id,
        name: t.name,
        date: t.date,
        format: t.format as TournamentFormat,
        status: t.status as TournamentStatus,
        participants: (t.tournament_participants || []).map((p: any) => p.player_id),
        matches: (t.tournament_matches || []).map((m: any) => transformMatchData(m)),
        winner: t.winner_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));

      processedTournaments.sort((a: Tournament, b: Tournament) => {
        const statusOrder: Record<TournamentStatus, number> = {
          [TournamentStatus.IN_PROGRESS]: 1,
          [TournamentStatus.UPCOMING]: 2,
          [TournamentStatus.COMPLETED]: 3,
        };
        const statusA = a.status as TournamentStatus;
        const statusB = b.status as TournamentStatus;

        if (statusOrder[statusA] !== statusOrder[statusB]) {
          return statusOrder[statusA] - statusOrder[statusB];
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      tournamentCache.set(cacheKey, processedTournaments);

      set({ 
        tournaments: processedTournaments, 
        loading: false, 
        error: null, 
        lastFetchTimestamp: Date.now() 
      });
    } catch (error: any) {
      set({ error: `Failed to fetch tournaments: ${error.message}`, loading: false });
    }
  },

  createTournament: async (name: string, date: string, format: TournamentFormat, playerIds: string[]): Promise<string | undefined> => {
    set({ loading: true, error: null });
    
    try {
      const config = createTournament()
        .setName(name)
        .setDate(date)
        .setFormat(format)
        .setParticipants(playerIds)
        .build();

      const { data: tData, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name: config.name,
          date: config.date,
          format: config.format,
          status: 'pending'
        })
        .select()
        .single();

      if (tErr) throw tErr;
      if (!tData?.id) throw new Error("Failed to retrieve tournament ID after creation.");

      const tournamentId = tData.id;

      const participantsRows = config.playerIds.map(pid => ({
        tournament_id: tournamentId,
        player_id: pid
      }));
      
      const { error: pErr } = await supabase.from('tournament_participants').insert(participantsRows);
      if (pErr) {
        await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
        await supabase.from('tournaments').delete().eq('id', tournamentId);
        throw pErr;
      }

      tournamentCache.clear();
      await get().fetchTournaments({ force: true });
      
      await eventManager.notify({
        type: 'TOURNAMENT_CREATED',
        tournamentId,
        data: { name: config.name, format: config.format, participantCount: config.playerIds.length },
        timestamp: Date.now()
      });

      set({ loading: false });
      return tournamentId;

    } catch (error: any) {
      set({ loading: false, error: error.message || 'Failed to create tournament' });
      return undefined;
    }
  },

  generateAndStartTournament: async (tournamentId: string) => {
    set({ loading: true, error: null });

    try {
      const tournament = get().tournaments.find(t => t.id === tournamentId);
      if (!tournament) throw new Error(`Tournament ${tournamentId} not found.`);
      if (tournament.status !== 'pending') throw new Error(`Tournament ${tournamentId} is not in pending state.`);

      const strategy = factory.createTournamentStrategy(tournament.format);
      const matches = await strategy.generateMatches(tournamentId, tournament.participants);

      await repository.insertMatches(matches);

      await repository.setTournamentStatus(tournamentId, 'active');

      tournamentCache.clear();
      await get().fetchTournaments({ force: true });

      await eventManager.notify({
        type: 'TOURNAMENT_STARTED',
        tournamentId,
        data: { matchCount: matches.length, format: tournament.format },
        timestamp: Date.now()
      });

      set({ loading: false });
    } catch (error: any) {
      set({ loading: false, error: error.message || 'Failed to generate and start tournament' });
    }
  },

  generateTournamentMatches: async (tournamentId: string) => {
    const tournament = get().tournaments.find(t => t.id === tournamentId);
    if (!tournament) return Promise.reject(new Error('Tournament not found'));

    if (tournament.format === TournamentFormat.GROUP) {
      try {
        set({ loading: true, error: null });

        const strategy = factory.createTournamentStrategy(tournament.format);
        await strategy.updateMatchResult(tournamentId, '', { player1Score: 0, player2Score: 0 });

        await get().fetchTournaments();
        set({ loading: false });

        return Promise.resolve();
      } catch (error: any) {
        console.error('Generate Tournament Matches Error:', error);
        set({ loading: false, error: error.message || 'Failed to generate matches' });
        return Promise.reject(error);
      }
    }

    return Promise.resolve();
  },

  updateMatchResult: async (tournamentId: string, matchId: string, scores: {
    player1Score: number;
    player2Score: number;
    sets?: MatchSet[]
  }) => {
    set({ loading: true, error: null });

    try {
      const tournament = get().tournaments.find(t => t.id === tournamentId);
      if (!tournament) throw new Error('Tournament not found');

      const validation = TournamentHelper.validateMatchResult(scores);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const strategy = factory.createTournamentStrategy(tournament.format);
      await strategy.updateMatchResult(tournamentId, matchId, scores);

      const matchData = await repository.getMatchById(matchId);
      if (matchData?.player1_id && matchData?.player2_id) {
        try {
          const { useMatchStore } = await import('../store/matchStore');
          const matchStore = useMatchStore.getState();
          await matchStore.addMatch({
            player1Id: matchData.player1_id,
            player2Id: matchData.player2_id,
            player1Score: scores.player1Score,
            player2Score: scores.player2Score,
            sets: scores.sets || [],
            tournamentId: tournamentId
          });
        } catch (error) {
          console.error("Error adding match to history:", error);
        }
      }

      tournamentCache.clear();
      await get().fetchTournaments({ force: true });
      set({ loading: false });

    } catch (error: any) {
      set({ loading: false, error: error.message || 'Failed to update match result' });
    }
  },

  getTournamentById: (id: string) => {
    const cacheKey = `tournament_${id}`;
    const cached = tournamentCache.get<Tournament>(cacheKey);
    if (cached) return cached;

    const tournament = get().tournaments.find(t => t.id === id);
    if (tournament) {
      tournamentCache.set(cacheKey, tournament);
    }
    return tournament;
  },

  getUpcomingTournaments: () => {
    const cacheKey = 'upcoming_tournaments';
    const cached = tournamentCache.get<Tournament[]>(cacheKey);
    if (cached) return cached;

    const upcoming = get().tournaments.filter(t => t.status === 'pending');
    tournamentCache.set(cacheKey, upcoming);
    return upcoming;
  },

  getActiveTournaments: () => {
    const cacheKey = 'active_tournaments';
    const cached = tournamentCache.get<Tournament[]>(cacheKey);
    if (cached) return cached;

    const active = get().tournaments.filter(t => t.status === 'active');
    tournamentCache.set(cacheKey, active);
    return active;
  },

  getCompletedTournaments: () => {
    const cacheKey = 'completed_tournaments';
    const cached = tournamentCache.get<Tournament[]>(cacheKey);
    if (cached) return cached;

    const completed = get().tournaments.filter(t => t.status === 'completed');
    tournamentCache.set(cacheKey, completed);
    return completed;
  },

  getTournamentMatches: (tournamentId: string) => {
    const tournament = get().getTournamentById(tournamentId);
    if (!tournament || !Array.isArray(tournament.matches)) return [];
    
    return tournament.matches.map((m: any) => ({
      id: m.id,
      tournamentId: m.tournamentId,
      round: m.round,
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      winner: m.winner,
      matchId: m.matchId ?? m.id ?? null,
      status: m.status === 'pending_players' ? 'pending' : m.status,
      player1Score: m.player1Score ?? null,
      player2Score: m.player2Score ?? null,
      nextMatchId: m.nextMatchId ?? null,
      sets: m.sets,
      group: m.group,
      bracket: m.bracket
    }));
  },

  updateTournamentStatus: async (tournamentId: string, status: Tournament['status']) => {
    set(state => ({
      tournaments: state.tournaments.map(t => t.id === tournamentId ? { ...t, status } : t)
    }));
    
    const { error } = await supabase.from('tournaments').update({ status }).eq('id', tournamentId);
    if (error) {
      await get().fetchTournaments();
    } else {
      tournamentCache.invalidate(`tournament_${tournamentId}`);
    }
  },

  setTournamentWinner: async (tournamentId: string, winnerId: string) => {
    if (!winnerId) {
      console.error('No winnerId provided to setTournamentWinner');
      return;
    }

    set({ loading: true, error: null });
    try {
      set(state => ({
        tournaments: state.tournaments.map(t =>
          t.id === tournamentId ? {
            ...t,
            winner: winnerId,
            status: TournamentStatus.COMPLETED
          } : t
        )
      }));

      await repository.setTournamentWinner(tournamentId, winnerId);

      const tournament = get().getTournamentById(tournamentId);
      await eventManager.notify({
        type: 'TOURNAMENT_COMPLETED',
        tournamentId,
        data: { 
          winnerId, 
          tournamentName: tournament?.name,
          format: tournament?.format 
        },
        timestamp: Date.now()
      });

      tournamentCache.clear();
      await get().fetchTournaments();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message || "Failed to set winner", loading: false });
    }
  },

  getPlayerTournamentWins: (playerId: string) => {
    const cacheKey = `player_wins_${playerId}`;
    const cached = tournamentCache.get<number>(cacheKey);
    if (cached !== null) return cached;

    const completedTournaments = get().tournaments.filter(
      t => t.status === TournamentStatus.COMPLETED
    );
    const wins = completedTournaments.filter(t => t.winner === playerId).length;
    
    tournamentCache.set(cacheKey, wins);
    return wins;
  },

  createTournamentBuilder: () => createTournament(),
  getTournamentHelper: () => TournamentHelper,
  clearCache: () => tournamentCache.clear(),
  getCache: () => tournamentCache,
}));

export function useTournamentsRealtime() {
  useEffect(() => {
    const handleChanges = (payload: RealtimePostgresChangesPayload<any>) => {
      if (payload.table === 'tournaments') {
        useTournamentStore.getState().handleTournamentUpdate(payload);
      } else if (payload.table === 'tournament_matches') {
        useTournamentStore.getState().handleMatchUpdate(payload);
      }
    };

    const channel = getTournamentChannel();
    if (channel && channel.state !== 'joined') {
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, handleChanges)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches' }, handleChanges)
        .subscribe();
    }
  }, []);
}

export function generateAndStartTournament(tournamentId: string): Promise<void> {
  return useTournamentStore.getState().generateAndStartTournament(tournamentId);
}

export function generateTournamentMatches(tournamentId: string): Promise<void> {
  return useTournamentStore.getState().generateTournamentMatches(tournamentId);
}

export { TournamentRepository } from './repositories/TournamentRepository';
export { TournamentFactory, getTournamentFactory } from './factories/TournamentFactory';
export { TournamentEventManager, getTournamentEventManager } from './observers/TournamentObserver';
export { TournamentBuilder, createTournament } from './builders/TournamentBuilder';
export { TournamentHelper } from './utils/TournamentHelper';
