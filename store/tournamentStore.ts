//store/tournamentStore.ts
import {create} from 'zustand';
import {supabase} from '@/app/lib/supabase';
import {v4 as uuidv4} from 'uuid';
import type {Set as MatchSet} from '@/backend/types';
import {Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/backend/types';
import type {TournamentWonMetadata} from '@/services/notificationService';
import {dispatchSystemNotification} from '@/services/notificationService';
import {useEffect} from "react";
import {usePlayerStore} from './playerStore';
import {useMatchStore} from "@/store/matchStore";
import {RealtimeChannel, RealtimePostgresChangesPayload} from "@supabase/supabase-js";

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
        group: match.group
    };
};

type TournamentStore = {
    handleTournamentUpdate(payload: RealtimePostgresChangesPayload<any>): unknown;
    handleMatchUpdate(payload: RealtimePostgresChangesPayload<any>): unknown;
    generateTournamentMatches: (tournamentId: string) => Promise<void>;
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
    getTournamentById: (id: string) => Tournament | undefined;
    getTournamentMatches: (tournamentId: string) => TournamentMatch[];
    updateTournamentStatus: (tournamentId: string, status: Tournament['status']) => Promise<void>;
    setTournamentWinner: (tournamentId: string, winnerId: string) => Promise<void>;
    generateAndStartTournament: (tournamentId: string) => Promise<void>;
    getUpcomingTournaments: () => Tournament[];
    getActiveTournaments: () => Tournament[];
    getCompletedTournaments: () => Tournament[];
    getPlayerTournamentWins: (playerId: string) => number;
};

let tournamentChannel: RealtimeChannel | null = null;

const getTournamentChannel = () => {
    if (!tournamentChannel) {
        tournamentChannel = supabase.channel('tournaments-realtime');
    }
    return tournamentChannel;
}

function shuffleArray<T>(array: T[]): T[] {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

function generateRoundRobinSchedule(playerIds: string[]): { player1Id: string, player2Id: string }[] {
    const schedule: { player1Id: string, player2Id: string }[] = [];
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            schedule.push({player1Id: playerIds[i], player2Id: playerIds[j]});
        }
    }
    return schedule;
}

function generateGroups(playerIds: string[], numGroups: number): string[][] {
    const shuffledPlayers = shuffleArray([...playerIds]);
    const groups: string[][] = Array.from({length: numGroups}, () => []);

    shuffledPlayers.forEach((playerId, index) => {
        const groupIndex = index % numGroups;
        groups[groupIndex].push(playerId);
    });

    return groups;
}

function generateGroupMatches(tournamentId: string, groups: string[][]): {
    player1Id: string,
    player2Id: string,
    group: number
}[] {
    const matches: { player1Id: string, player2Id: string, group: number }[] = [];

    groups.forEach((group, groupIndex) => {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                matches.push({
                    player1Id: group[i],
                    player2Id: group[j],
                    group: groupIndex + 1
                });
            }
        }
    });

    return matches;
}

function getTopPlayersFromGroups(groups: string[][], matches: TournamentMatch[]): string[] {
    const qualifiers: string[] = [];

    groups.forEach((group, groupIndex) => {
        const groupMatches = matches.filter(m => m.group === groupIndex + 1 && m.status === 'completed');
        const playerStats: Record<string, { played: number, wins: number, points: number, pointsDiff: number }> = {};

        group.forEach(playerId => {
            playerStats[playerId] = {played: 0, wins: 0, points: 0, pointsDiff: 0};
        });

        groupMatches.forEach(match => {
            if (!match.player1Id || !match.player2Id || match.player1Score === null || match.player2Score === null) return;

            const p1 = match.player1Id;
            const p2 = match.player2Id;

            playerStats[p1].played++;
            playerStats[p2].played++;
            playerStats[p1].points += match.player1Score;
            playerStats[p2].points += match.player2Score;
            playerStats[p1].pointsDiff += match.player1Score - match.player2Score;
            playerStats[p2].pointsDiff += match.player2Score - match.player1Score;

            if (match.player1Score > match.player2Score) {
                playerStats[p1].wins++;
            } else {
                playerStats[p2].wins++;
            }
        });

        const sortedPlayers = group.sort((a, b) => {
            const statsA = playerStats[a];
            const statsB = playerStats[b];

            if (statsA.wins !== statsB.wins) return statsB.wins - statsA.wins;
            if (statsA.pointsDiff !== statsB.pointsDiff) return statsB.pointsDiff - statsA.pointsDiff;
            return statsB.points - statsA.points;
        });

        if (sortedPlayers.length > 0) {
            qualifiers.push(sortedPlayers[0]);
        }
    });

    return qualifiers;
}

async function generateKnockoutPhase(tournamentId: string, qualifiedPlayers: string[]): Promise<void> {
    const numPlayers = qualifiedPlayers.length;
    const numRounds = Math.ceil(Math.log2(numPlayers));

    const nextPowerOf2 = Math.pow(2, numRounds);
    let playersWithByes: (string | null)[] = [...qualifiedPlayers];

    while (playersWithByes.length < nextPowerOf2) {
        playersWithByes.push(null);
    }

    playersWithByes = shuffleArray(playersWithByes);

    type KnockoutMatchInsert = {
        id: string;
        tournament_id: string;
        round: number;
        match_number: number;
        player1_id: string | null;
        player2_id: string | null;
        player1_score: number | null;
        player2_score: number | null;
        winner_id: string | null;
        status: TournamentMatch['status'];
        next_match_id: string | null;
        sets?: MatchSet[] | null;
    };

    let matchesToInsert: KnockoutMatchInsert[] = [];
    let matchIdMatrix: string[][] = [];
    let firstRoundMatches: string[] = [];
    for (let i = 0; i < playersWithByes.length; i += 2) {
        const matchId = uuidv4();
        firstRoundMatches.push(matchId);

        const p1 = playersWithByes[i];
        const p2 = playersWithByes[i + 1];
        let status: TournamentMatch['status'] = 'pending';
        let winner = null;

        if (p1 && p2) {
            status = 'scheduled';
        } else if (p1 && !p2) {
            status = 'completed';
            winner = p1;
        } else if (!p1 && p2) {
            status = 'completed';
            winner = p2;
        }

        matchesToInsert.push({
            id: matchId,
            tournament_id: tournamentId,
            round: 2,
            match_number: i / 2 + 1,
            player1_id: p1,
            player2_id: p2,
            player1_score: winner === p1 ? 1 : null,
            player2_score: winner === p2 ? 1 : null,
            winner_id: winner,
            status: status,
            next_match_id: null,
            sets: null,
        });
    }
    matchIdMatrix.push(firstRoundMatches);

    for (let round = 3; round <= numRounds + 1; round++) {
        const prevRoundMatches = matchIdMatrix[round - 3];
        const currRoundMatches: string[] = [];

        for (let i = 0; i < prevRoundMatches.length; i += 2) {
            const matchId = uuidv4();
            currRoundMatches.push(matchId);

            const match1 = matchesToInsert.find(m => m.id === prevRoundMatches[i]);
            if (match1) match1.next_match_id = matchId;

            if (i + 1 < prevRoundMatches.length) {
                const match2 = matchesToInsert.find(m => m.id === prevRoundMatches[i + 1]);
                if (match2) match2.next_match_id = matchId;
            }

            matchesToInsert.push({
                id: matchId,
                tournament_id: tournamentId,
                round: round,
                match_number: i / 2 + 1,
                player1_id: null,
                player2_id: null,
                player1_score: null,
                player2_score: null,
                winner_id: null,
                status: 'pending',
                next_match_id: null,
                sets: null,
            });
        }

        matchIdMatrix.push(currRoundMatches);
    }

    const {error: mErr} = await supabase.from('tournament_matches').insert(
        matchesToInsert.map(match => ({
            ...match,
            sets: match.sets ? JSON.stringify(match.sets) : null,
        }))
    );
    if (mErr) throw mErr;

    return;
}

async function autoSelectRoundRobinWinner(tournamentId: string): Promise<string | null> {
    try {
        const {data: tournamentData, error: tournamentError} = await supabase
            .from('tournaments')
            .select('*, tournament_matches(*)')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournamentData) {
            console.error(`Error fetching tournament:`, tournamentError);
            return null;
        }

        const matches: TournamentMatch[] = tournamentData.tournament_matches?.map((m: any) => ({
            id: m.id,
            tournamentId: m.tournament_id,
            round: m.round,
            player1Id: m.player1_id,
            player2Id: m.player2_id,
            player1Score: m.player1_score,
            player2Score: m.player2_score,
            status: m.status,
            winnerId: m.winner_id,
            sets: m.sets,
            nextMatchId: m.next_match_id,
            group: m.group,
            matchId: m.match_id,
        })) || [];

        const allMatchesCompleted = matches.every(m => m.status === 'completed');
        if (!allMatchesCompleted || matches.length === 0) {
            return null;
        }

        // Statystyki zawodników
        const playerStats: Record<string, {
            playerId: string,
            mainPoints: number,      // punkty główne (2 za wygraną, 1 za przegraną)
            matchesPlayed: number,
            matchesWon: number,
            setsWon: number,
            setsLost: number,
            smallPointsWon: number,  // małe punkty (punkty w setach)
            smallPointsLost: number,
            headToHead: Record<string, number>  // wyniki bezpośrednich spotkań
        }> = {};

        // Inicjalizacja statystyk
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

        // Przetwarzanie meczów
        matches.forEach(match => {
            if (match.status !== 'completed' || !match.player1Id || !match.player2Id) return;

            const player1 = playerStats[match.player1Id];
            const player2 = playerStats[match.player2Id];

            player1.matchesPlayed++;
            player2.matchesPlayed++;

            // Liczenie setów wygranych/przegranych
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

            // Punkty główne i wyniki bezpośrednie
            if (match.winner === match.player1Id) {
                player1.mainPoints += 2;  // 2 punkty za wygraną
                player1.matchesWon++;
                player2.mainPoints += 1;  // 1 punkt za przegraną!
                player1.headToHead[match.player2Id] = 1;
                player2.headToHead[match.player1Id] = -1;
            } else if (match.winner === match.player2Id) {
                player2.mainPoints += 2;  // 2 punkty za wygraną
                player2.matchesWon++;
                player1.mainPoints += 1;  // 1 punkt za przegraną!
                player2.headToHead[match.player1Id] = 1;
                player1.headToHead[match.player2Id] = -1;
            }
        });

        // Sortowanie według przepisów PZTS
        const rankedPlayers = Object.values(playerStats).sort((a, b) => {
            // 1. Punkty główne
            if (a.mainPoints !== b.mainPoints) {
                return b.mainPoints - a.mainPoints;
            }

            // 2. Stosunek meczów wygranych do rozegranych
            const aMatchRatio = a.matchesWon / (a.matchesPlayed || 1);
            const bMatchRatio = b.matchesWon / (b.matchesPlayed || 1);
            if (aMatchRatio !== bMatchRatio) {
                return bMatchRatio - aMatchRatio;
            }

            // 3. Stosunek setów
            const aSetRatio = a.setsWon / (a.setsWon + a.setsLost || 1);
            const bSetRatio = b.setsWon / (b.setsWon + b.setsLost || 1);
            if (aSetRatio !== bSetRatio) {
                return bSetRatio - aSetRatio;
            }

            // 4. Stosunek małych punktów
            const aPointRatio = a.smallPointsWon / (a.smallPointsWon + a.smallPointsLost || 1);
            const bPointRatio = b.smallPointsWon / (b.smallPointsWon + b.smallPointsLost || 1);
            if (aPointRatio !== bPointRatio) {
                return bPointRatio - aPointRatio;
            }

            // 5. Wynik bezpośredniego meczu
            if (a.headToHead[b.playerId] !== undefined) {
                return a.headToHead[b.playerId] > 0 ? -1 : 1;
            }

            return 0;
        });

        // Aktualizacja zwycięzcy
        if (rankedPlayers.length > 0) {
            const winner = rankedPlayers[0];
            const {error} = await supabase
                .from('tournaments')
                .update({
                    winner_id: winner.playerId,
                    status: 'completed'
                })
                .eq('id', tournamentId);

            if (error) {
                console.error(`Error updating tournament winner:`, error);
                return null;
            } else {
                // Powiadomienie o zwycięstwie...
                try {
                    const playerStore = usePlayerStore.getState();
                    const winnerPlayer = playerStore.getPlayerById(winner.playerId);
                    const tournamentStore = useTournamentStore.getState();
                    const tournament = tournamentStore.getTournamentById(tournamentId);

                    if (winnerPlayer && tournament) {
                        const winnerNickname = winnerPlayer.nickname || 'Unknown Player';
                        const metadata: TournamentWonMetadata = {
                            notification_type: 'tournament_won',
                            winnerNickname: winnerNickname,
                            tournamentName: tournament.name,
                            tournamentId: tournament.id,
                        };
                        await dispatchSystemNotification('tournament_won', metadata);
                    }
                } catch (e) {
                    console.warn("Failed to dispatch tournament_won notification", e);
                }

                return winner.playerId;
            }
        }

        return null;
    } catch (error) {
        console.error(`Error selecting winner:`, error);
        return null;
    }
}

const _addMatchToHistory = async (
    match: TournamentMatch,
    scores: { player1Score: number; player2Score: number; sets?: MatchSet[] },
    tournamentId: string
): Promise<void> => {
    const {addMatch} = useMatchStore.getState();
    if (match.player1Id && match.player2Id) {
        await addMatch({
            player1Id: match.player1Id,
            player2Id: match.player2Id,
            player1Score: scores.player1Score,
            player2Score: scores.player2Score,
            sets: scores.sets || [],
            tournamentId,
        });
    }
};

export const useTournamentStore = create<TournamentStore>((set, get) => ({
    handleTournamentUpdate: (payload) => {
        const {eventType, new: newRecord, old} = payload;
        set(state => {
            const tournaments = [...state.tournaments];
            const index = tournaments.findIndex(t => t.id === (eventType === 'DELETE' ? old.id : newRecord.id));

            if (eventType === 'INSERT') {
                if (index === -1) {
                    tournaments.push({...newRecord, matches: []});
                }
            } else if (eventType === 'UPDATE') {
                if (index !== -1) {
                    tournaments[index] = {...tournaments[index], ...newRecord};
                }
            } else if (eventType === 'DELETE') {
                if (index !== -1) {
                    tournaments.splice(index, 1);
                }
            }
            return {tournaments};
        });
    },
    handleMatchUpdate: (payload) => {
        const {eventType, new: newRecord, old} = payload;
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
                    return {...t, matches};
                }
                return t;
            });
            return {tournaments};
        });
    },
    generateTournamentMatches: async (tournamentId: string) => {
        const tournament = get().tournaments.find(t => t.id === tournamentId);
        if (!tournament) return Promise.reject(new Error('Tournament not found'));

        if (tournament.format === TournamentFormat.GROUP) {
            try {
                set({loading: true, error: null});

                const groupMatches = get().getTournamentMatches(tournamentId).filter(m => m.round === 1);

                const {data: participantsData, error: pErr} = await supabase
                    .from('tournament_participants')
                    .select('player_id')
                    .eq('tournament_id', tournamentId);

                if (pErr) throw pErr;
                const playerIds = participantsData.map((p: { player_id: string }) => p.player_id);

                const groups = Array.from(new Set(groupMatches.map(m => m.group).filter(Boolean))).map(groupNum => {
                    const groupPlayerIds = new Set<string>();
                    groupMatches.forEach(match => {
                        if (match.group === groupNum) {
                            if (match.player1Id) groupPlayerIds.add(match.player1Id);
                            if (match.player2Id) groupPlayerIds.add(match.player2Id);
                        }
                    });
                    return Array.from(groupPlayerIds);
                });

                const qualifiedPlayers = getTopPlayersFromGroups(groups, groupMatches);

                await generateKnockoutPhase(tournamentId, qualifiedPlayers);

                await get().fetchTournaments();
                set({loading: false});

                return Promise.resolve();
            } catch (error: any) {
                console.error('Generate Tournament Matches Error:', error);
                set({loading: false, error: error.message || 'Failed to generate matches'});
                return Promise.reject(error);
            }
        }

        return Promise.resolve();
    },
    tournaments: [],
    loading: false,
    error: null,
    lastFetchTimestamp: null,

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

        set({loading: true, error: null});

        try {
            const {data: rawTournaments, error} = await supabase
                .from('tournaments')
                .select(`
                    id, name, date, format, status, winner_id, created_at, updated_at,
                    tournament_participants ( player_id ),
                    tournament_matches ( * ) 
                `)
                .order('date', {ascending: false});

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

            type RawTournamentFromDB = {
                id: string;
                name: string;
                date: string;
                format: string;
                status: string;
                winner_id?: string | null;
                created_at: string;
                updated_at: string;
                tournament_participants: { player_id: string }[];
                tournament_matches: any[];
            };

            const processedTournaments = rawTournaments.map((t: RawTournamentFromDB) => {
                const participantsData = Array.isArray(t.tournament_participants) ? t.tournament_participants : [];
                const matchesData = Array.isArray(t.tournament_matches) ? t.tournament_matches : [];

                return {
                    id: t.id,
                    name: t.name,
                    date: t.date,
                    format: t.format as TournamentFormat,
                    status: t.status as TournamentStatus,
                    participants: participantsData.map((p: { player_id: string }) => p.player_id),
                    matches: matchesData.map((m: any) => ({
                        id: m.id,
                        tournamentId: m.tournament_id,
                        round: m.round,
                        group: m.group,
                        matchNumber: m.match_number,
                        player1Id: m.player1_id,
                        player2Id: m.player2_id,
                        player1Score: m.player1_score,
                        player2Score: m.player2_score,
                        winner: m.winner_id,
                        matchId: m.match_id,
                        nextMatchId: m.next_match_id,
                        status: m.status as TournamentMatch['status'],
                        sets: m.sets || [],
                        roundName: m.round_name,
                        startTime: m.start_time,
                        isUpdating: false,
                    })),
                    winner: t.winner_id,
                    createdAt: t.created_at,
                    updatedAt: t.updated_at,
                };
            });

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

            set({tournaments: processedTournaments, loading: false, error: null, lastFetchTimestamp: Date.now()});
        } catch (error: any) {
            set({error: `Failed to fetch tournaments: ${error.message}`, loading: false});
        }
    },

    createTournament: async (name: string, date: string, format: TournamentFormat, playerIds: string[]): Promise<string | undefined> => {
        set({loading: true, error: null});
        let tournamentId: string | undefined = undefined;
        try {
            if (playerIds.length < 2) {
                throw new Error("Minimum 2 players required");
            }

            if (format === TournamentFormat.KNOCKOUT && playerIds.length % 4 !== 0) {
                throw new Error("Knockout tournaments require an even number of players");
            }

            let finalName = name?.trim();
            if (!finalName) {
                const {data: existingTournaments, error: fetchErr} = await supabase
                    .from('tournaments')
                    .select('name')
                    .ilike('name', 'Tournament %');

                if (fetchErr) {
                    finalName = "Tournament 1";
                } else {
                    let maxNumber = 0;
                    existingTournaments?.forEach((t: { name: string }) => {
                        const match = t.name.match(/Tournament (\d+)/);
                        if (match && match[1]) {
                            const num = parseInt(match[1]);
                            if (!isNaN(num) && num > maxNumber) {
                                maxNumber = num;
                            }
                        }
                    });
                    finalName = `Tournament ${maxNumber + 1}`;
                }
            }

            const {data: tData, error: tErr} = await supabase
                .from('tournaments')
                .insert({name: finalName, date, format, status: 'pending'})
                .select()
                .single();

            if (tErr) throw tErr;
            if (!tData?.id) throw new Error("Failed to retrieve tournament ID after creation.");

            tournamentId = tData.id;

            const participantsRows = playerIds.map(pid => ({
                tournament_id: tournamentId!,
                player_id: pid
            }));
            const {error: pErr} = await supabase.from('tournament_participants').insert(participantsRows);
            if (pErr) {
                await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
                await supabase.from('tournaments').delete().eq('id', tournamentId);
                throw pErr;
            }

            await get().fetchTournaments({force: true});
            set({loading: false});
            return tournamentId;

        } catch (error: any) {
            if (tournamentId) {
                await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
                await supabase.from('tournaments').delete().eq('id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to create tournament'});
            return undefined;
        }
    },

    generateAndStartTournament: async (tournamentId: string) => {
        set({loading: true, error: null});
        let generatedMatchesInserted = false;

        try {
            const existingTournament = get().tournaments.find(t => t.id === tournamentId);
            if (!existingTournament) throw new Error(`Tournament ${tournamentId} not found.`);
            if (existingTournament.status !== 'pending') throw new Error(`Tournament ${tournamentId} is not in pending state.`);

            const {count: existingMatchesCount, error: countError} = await supabase
                .from('tournament_matches')
                .select('*', {count: 'exact', head: true})
                .eq('tournament_id', tournamentId);

            if (countError) throw countError;
            if (existingMatchesCount && existingMatchesCount > 0) {
                throw new Error('Matches for this tournament have already been generated.');
            }

            const {data: participantsData, error: pFetchErr} = await supabase
                .from('tournament_participants')
                .select('player_id')
                .eq('tournament_id', tournamentId);

            if (pFetchErr) throw pFetchErr;
            if (!participantsData || participantsData.length < 2) {
                throw new Error("Not enough participants found for this tournament.");
            }
            const playerIds = participantsData.map((p: { player_id: string }) => p.player_id);

            if (existingTournament.format === TournamentFormat.KNOCKOUT && playerIds.length % 4 !== 0) {
                throw new Error("Knockout tournaments require an even number of players");
            }

            type TournamentMatchInsert = {
                id: string;
                tournament_id: string;
                round: number;
                match_number: number;
                player1_id: string | null;
                player2_id: string | null;
                player1_score: number | null;
                player2_score: number | null;
                winner_id: string | null;
                status: TournamentMatch['status'];
                next_match_id: string | null;
                sets?: MatchSet[];
                group?: number;
            };

            if (existingTournament.format === 'ROUND_ROBIN') {
                const schedule = generateRoundRobinSchedule(playerIds);
                const matchesToInsert = schedule.map((match, index) => ({
                    id: uuidv4(),
                    tournament_id: tournamentId,
                    round: 1,
                    match_number: index + 1,
                    player1_id: match.player1Id,
                    player2_id: match.player2Id,
                    status: 'scheduled',
                }));

                const {error} = await supabase.rpc('start_tournament', {
                    p_tournament_id: tournamentId,
                    p_matches: matchesToInsert,
                });

                if (error) throw error;

                await get().fetchTournaments({force: true});
                set({loading: false});
            } else if (existingTournament.format === 'GROUP') {
                const numGroups = Math.min(4, Math.ceil(playerIds.length / 3));
                const groups = generateGroups(playerIds, numGroups);
                const groupMatches = generateGroupMatches(tournamentId, groups);

                const matchesToInsert = groupMatches.map((match, index) => ({
                    id: uuidv4(),
                    tournament_id: tournamentId,
                    round: 1,
                    match_number: index + 1,
                    player1_id: match.player1Id,
                    player2_id: match.player2Id,
                    status: 'scheduled',
                    group: match.group
                }));

                const {error} = await supabase.rpc('start_tournament', {
                    p_tournament_id: tournamentId,
                    p_matches: matchesToInsert,
                });

                if (error) throw error;

                await get().fetchTournaments({force: true});
                set({loading: false});
            } else {
                const numPlayers = playerIds.length;
                const numRounds = Math.ceil(Math.log2(numPlayers));
                let matchesToInsert: TournamentMatchInsert[] = [];
                let matchIdMatrix: string[][] = [];
                let shuffledPlayers: (string | null)[] = shuffleArray([...playerIds]);

                if (shuffledPlayers.length % 2 !== 0) shuffledPlayers.push(null);
                let firstRoundMatches: string[] = [];
                for (let i = 0; i < shuffledPlayers.length; i += 2) {
                    const matchId = uuidv4();
                    firstRoundMatches.push(matchId);
                    const p1 = shuffledPlayers[i];
                    const p2 = shuffledPlayers[i + 1] ?? null;
                    let status: TournamentMatch['status'] = 'pending';
                    let winner = null;

                    if (p1 && p2) {
                        status = 'scheduled';
                    } else if (p1 && !p2) {
                        status = 'completed';
                        winner = p1;
                    } else if (!p1 && p2) {
                        status = 'completed';
                        winner = p2;
                    }

                    matchesToInsert.push({
                        id: matchId,
                        tournament_id: tournamentId,
                        round: 1,
                        match_number: i / 2 + 1,
                        player1_id: p1,
                        player2_id: p2,
                        player1_score: winner === p1 ? 1 : null,
                        player2_score: winner === p2 ? 1 : null,
                        winner_id: winner,
                        status: status,
                        next_match_id: null,
                    });
                }
                matchIdMatrix.push(firstRoundMatches);

                for (let round = 2; round <= numRounds; round++) {
                    const prevRoundMatches = matchIdMatrix[round - 2];
                    const currRoundMatches: string[] = [];

                    for (let i = 0; i < prevRoundMatches.length; i += 2) {
                        const matchId = uuidv4();
                        currRoundMatches.push(matchId);

                        const match1 = matchesToInsert.find(m => m.id === prevRoundMatches[i]);
                        if (match1) match1.next_match_id = matchId;

                        if (i + 1 < prevRoundMatches.length) {
                            const match2 = matchesToInsert.find(m => m.id === prevRoundMatches[i + 1]);
                            if (match2) match2.next_match_id = matchId;
                        }

                        matchesToInsert.push({
                            id: matchId,
                            tournament_id: tournamentId,
                            round,
                            match_number: i / 2 + 1,
                            player1_id: null,
                            player2_id: null,
                            player1_score: null,
                            player2_score: null,
                            winner_id: null,
                            status: 'pending',
                            next_match_id: null,
                        });
                    }

                    matchIdMatrix.push(currRoundMatches);
                }

                const {error} = await supabase.rpc('start_tournament', {
                    p_tournament_id: tournamentId,
                    p_matches: matchesToInsert,
                });

                if (error) throw error;

                await get().fetchTournaments({force: true});
                set({loading: false});
            }

        } catch (error: any) {
            if (generatedMatchesInserted) {
                await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to generate and start tournament'});
        }
    },

    updateMatchResult: async (tournamentId: string, matchId: string, scores: {
        player1Score: number;
        player2Score: number;
        sets?: MatchSet[]
    }) => {
        const originalTournaments = get().tournaments;
        const tournament = originalTournaments.find(t => t.id === tournamentId);
        const match = tournament?.matches.find(m => m.id === matchId);

        if (!tournament || !match) {
            set({error: "Tournament or match not found"});
            return;
        }

        set(state => ({
            tournaments: state.tournaments.map(t =>
                t.id === tournamentId
                    ? {
                        ...t,
                        matches: t.matches.map(m =>
                            m.id === matchId ? {...m, isUpdating: true} : m
                        ),
                    }
                    : t
            ),
        }));

        try {
            let p1FinalScore = scores.player1Score;
            let p2FinalScore = scores.player2Score;
            if (scores.sets && scores.sets.length > 0) {
                p1FinalScore = scores.sets.filter(s => s.player1Score > s.player2Score).length;
                p2FinalScore = scores.sets.filter(s => s.player2Score > s.player1Score).length;
            }

            if (p1FinalScore === p2FinalScore) throw new Error("Match score cannot be a draw");

            const winnerId = p1FinalScore > p2FinalScore ? match.player1Id : match.player2Id;

            const matchStore = useMatchStore.getState();
            const newMatch = await matchStore.addMatch({
                player1Id: match.player1Id!,
                player2Id: match.player2Id!,
                player1Score: scores.player1Score,
                player2Score: scores.player2Score,
                sets: scores.sets || [],
                tournamentId,
            });

            const updateData: any = {
                player1_score: scores.player1Score,
                player2_score: scores.player2Score,
                winner_id: winnerId,
                status: 'completed',
                sets: scores.sets,
                match_id: newMatch?.id,
            };

            const {error: updateMatchError} = await supabase.from('tournament_matches').update(updateData).eq('id', matchId);

            if (updateMatchError) {
                console.error('Error updating tournament match:', updateMatchError);
            }

            if (match.nextMatchId) {
                const nextMatch = tournament.matches.find(m => m.id === match.nextMatchId);
                if (nextMatch) {
                    const nextMatchUpdate: {
                        player1_id?: string;
                        player2_id?: string;
                        status?: TournamentMatch['status']
                    } = {};
                    if (winnerId) {
                        if (nextMatch.player1Id === null) nextMatchUpdate.player1_id = winnerId;
                        else if (nextMatch.player2Id === null) nextMatchUpdate.player2_id = winnerId;
                    }

                    if ((nextMatchUpdate.player1_id || nextMatch.player1Id) && (nextMatchUpdate.player2_id || nextMatch.player2Id)) {
                        nextMatchUpdate.status = 'scheduled';
                    }

                    if (Object.keys(nextMatchUpdate).length > 0) {
                        await supabase.from('tournament_matches').update(nextMatchUpdate).eq('id', match.nextMatchId);
                    }
                }
            } else {
                const {data: freshTournament} = await supabase
                    .from('tournaments')
                    .select('*, tournament_matches(status)')
                    .eq('id', tournamentId)
                    .single();

                const allMatchesCompleted = freshTournament?.tournament_matches.every((m: any) => m.status === 'completed');

                if (allMatchesCompleted) {
                    if (tournament.format === TournamentFormat.KNOCKOUT) {
                        await get().setTournamentWinner(tournamentId, winnerId!);
                    } else if (tournament.format === TournamentFormat.ROUND_ROBIN) {
                        await autoSelectRoundRobinWinner(tournamentId);
                    }
                }
            }

            await get().fetchTournaments({force: true});

        } catch (error: any) {
            set({tournaments: originalTournaments, error: error.message || 'Failed to update match'});
        } finally {
            set(state => ({
                tournaments: state.tournaments.map(t =>
                    t.id === tournamentId
                        ? {
                            ...t,
                            matches: t.matches.map(m =>
                                m.id === matchId ? {...m, isUpdating: false} : m
                            ),
                        }
                        : t
                ),
            }));
        }
    },

    getTournamentById: (id: string) => {
        return get().tournaments.find(t => t.id === id);
    },

    getUpcomingTournaments: () => {
        return get().tournaments.filter(t => t.status === 'pending');
    },
    getActiveTournaments: () => {
        return get().tournaments.filter(t => t.status === 'active');
    },
    getCompletedTournaments: () => {
        return get().tournaments.filter(t => t.status === 'completed');
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
            group: m.group
        }));
    },

    updateTournamentStatus: async (tournamentId: string, status: Tournament['status']) => {
        set(state => ({
            tournaments: state.tournaments.map(t => t.id === tournamentId ? {...t, status} : t)
        }));
        const {error} = await supabase.from('tournaments').update({status}).eq('id', tournamentId);
        if (error) {
            await get().fetchTournaments();
        }
    },

    setTournamentWinner: async (tournamentId: string, winnerId: string) => {
        console.log('🔄 setTournamentWinner called with:', {tournamentId, winnerId});
        if (!winnerId) {
            console.error('❌ No winnerId provided to setTournamentWinner');
            return;
        }

        set({loading: true, error: null});
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

            const {error} = await supabase.from('tournaments').update({
                winner_id: winnerId,
                status: TournamentStatus.COMPLETED
            }).eq('id', tournamentId);

            if (error) throw error;

            try {
                const tournament = get().getTournamentById(tournamentId);
                console.log('🔍 Tournament data:', tournament ? 'Found' : 'Not found');

                const playerStore = usePlayerStore.getState();
                const winner = playerStore.getPlayerById(winnerId);
                console.log('🔍 Player data:', winner ? 'Found' : 'Not found', {winnerId});

                console.log('🏆 Tournament winner data:', {
                    tournamentId,
                    winnerId,
                    tournamentName: tournament?.name,
                    tournamentStatus: tournament?.status,
                    winnerNickname: winner?.nickname,
                    winnerExists: !!winner,
                    tournamentExists: !!tournament
                });

                if (tournament && winner) {
                    const winnerNickname = winner.nickname || 'Unknown Player';

                    console.log('🚀 Dispatching tournament_won notification', {
                        winnerNickname,
                        tournamentName: tournament.name,
                        tournamentId: tournament.id,
                    });

                    try {
                        console.log('📤 Attempting to dispatch tournament_won notification with:', {
                            winnerNickname,
                            tournamentName: tournament.name,
                            tournamentId: tournament.id
                        });

                        await dispatchSystemNotification('tournament_won', {
                            notification_type: 'tournament_won',
                            winnerNickname: winnerNickname,
                            tournamentName: tournament.name,
                            tournamentId: tournament.id,
                        });

                        console.log('✅ Tournament won notification dispatched successfully');
                    } catch (e) {
                        console.error('❌ Failed to dispatch tournament won notification:', e);
                        if (e instanceof Error) {
                            console.error('Error details:', {
                                message: e.message,
                                stack: e.stack,
                                name: e.name
                            });
                        }
                        throw e;
                    }
                }
            } catch (e) {
                console.warn("Failed to dispatch tournament_won system notification", e);
                if (e instanceof Error) {
                    console.error('Error details:', {
                        message: e.message,
                        stack: e.stack,
                        name: e.name
                    });
                }
                throw e;
            }

            await get().fetchTournaments();
            set({loading: false});
        } catch (error: any) {
            set({error: error.message || "Failed to set winner"});
            set({loading: false});
        }
    },
    getPlayerTournamentWins: (playerId: string) => {
        const completedTournaments = get().tournaments.filter(
            t => t.status === TournamentStatus.COMPLETED
        );
        return completedTournaments.filter(t => t.winner === playerId).length;
    },
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
                .on('postgres_changes', {event: '*', schema: 'public', table: 'tournaments'}, handleChanges)
                .on('postgres_changes', {event: '*', schema: 'public', table: 'tournament_matches'}, handleChanges)
                .subscribe();
        }
    }, []);
}
