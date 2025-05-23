import {create} from 'zustand';
import {supabase} from '@/lib/supabase';
import {v4 as uuidv4} from 'uuid';
import {Tournament, TournamentFormat, TournamentMatch, TournamentStatus} from '@/types';
import type {Set as MatchSet} from '@/types';
import {useEffect} from "react";

type TournamentStore = {
    generateTournamentMatches: (tournamentId: string) => Promise<void>;
    tournaments: Tournament[];
    loading: boolean;
    error: string | null;
    lastFetchTimestamp: number | null;
    fetchTournaments: () => Promise<void>;
    createTournament: (name: string, date: string, format: TournamentFormat, playerIds: string[]) => Promise<string | undefined>;
    updateMatchResult: (
        tournamentId: string,
        matchId: string,
        scores: { player1Score: number; player2Score: number; sets?: MatchSet[] }
    ) => Promise<void>;
    getTournamentById: (id: string) => Tournament | undefined;
    getTournamentMatches: (tournamentId: string) => TournamentMatch[];
    updateTournamentStatus: (tournamentId: string, status: Tournament['status']) => Promise<void>;
    setTournamentWinner: (tournamentId: string, winnerId: string) => Promise<void>;
    generateAndStartTournament: (tournamentId: string) => Promise<void>;
    getUpcomingTournaments: () => Tournament[];
    getActiveTournaments: () => Tournament[];
    getCompletedTournaments: () => Tournament[];
};

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
            // Tylko jeden mecz dla kau017cdej pary graczy
            schedule.push({player1Id: playerIds[i], player2Id: playerIds[j]});
        }
    }
    return schedule;
}

function generateGroups(playerIds: string[], numGroups: number): string[][] {
    const shuffledPlayers = shuffleArray([...playerIds]);
    const groups: string[][] = Array.from({ length: numGroups }, () => []);
    
    shuffledPlayers.forEach((playerId, index) => {
        const groupIndex = index % numGroups;
        groups[groupIndex].push(playerId);
    });
    
    return groups;
}

function generateGroupMatches(tournamentId: string, groups: string[][]): { player1Id: string, player2Id: string, group: number }[] {
    const matches: { player1Id: string, player2Id: string, group: number }[] = [];
    
    groups.forEach((group, groupIndex) => {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                matches.push({
                    player1Id: group[i],
                    player2Id: group[j],
                    group: groupIndex + 1 // Groups are 1-indexed
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
            playerStats[playerId] = { played: 0, wins: 0, points: 0, pointsDiff: 0 };
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
        sets?: MatchSet[];
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
            round: 2, // Start knockout at round 2 (round 1 is for groups)
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
    
    for (let round = 3; round <= numRounds + 1; round++) { // +1 because we start knockout at round 2
        const prevRoundMatches = matchIdMatrix[round - 3]; // -3 to adjust for our offset
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
            });
        }
        
        matchIdMatrix.push(currRoundMatches);
    }
    
    const {error: mErr} = await supabase.from('tournament_matches').insert(matchesToInsert);
    if (mErr) throw mErr;
    
    return;
}

async function autoSelectRoundRobinWinner(tournamentId: string): Promise<string | null> {
    console.log(`[autoSelectRoundRobinWinner] Rozpoczynanie wyboru zwyciu0119zcy dla turnieju ${tournamentId}`);
    
    try {
        // Pobierz dane turnieju
        const { data: tournamentData, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*, tournament_matches(*)')
            .eq('id', tournamentId)
            .single();

        if (tournamentError) {
            console.error(`[autoSelectRoundRobinWinner] Bu0142u0105d podczas pobierania turnieju:`, tournamentError);
            return null;
        }

        if (!tournamentData) {
            console.error(`[autoSelectRoundRobinWinner] Nie znaleziono turnieju o ID ${tournamentId}`);
            return null;
        }
        
        console.log(`[autoSelectRoundRobinWinner] Pobrano dane turnieju:`, tournamentData);
        
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

        console.log(`[autoSelectRoundRobinWinner] Znaleziono ${matches.length} meczu00f3w w turnieju`);

        // Sprawdu017a czy wszystkie mecze su0105 zakou0144czone
        const allMatchesCompleted = matches.every(m => m.status === 'completed');
        console.log(`[autoSelectRoundRobinWinner] Czy wszystkie mecze su0105 zakou0144czone: ${allMatchesCompleted}`);
        if (!allMatchesCompleted || matches.length === 0) {
            console.log(`[autoSelectRoundRobinWinner] Nie wszystkie mecze su0105 zakou0144czone lub brak meczu00f3w, przerywam.`);
            return null;
        }

        // Oblicz punkty dla kau017cdego gracza
        const playerStats: Record<string, {
            playerId: string,
            points: number,     // zwyciu0119stwa
            matches: number,    // liczba rozegranych meczu00f3w
            smallPoints: number, // suma mau0142ych punktu00f3w (ru00f3u017cnica punktu00f3w w setach)
            wins: number,        // liczba zwyciu0119stw
            losses: number,      // liczba porau017cek
            headToHead: Record<string, number> // wyniki bezpou015brednich starau0144
        }> = {};

        // Inicjalizuj statystyki dla kau017cdego gracza
        const playerIds = new Set<string>();
        matches.forEach(match => {
            if (match.player1Id) playerIds.add(match.player1Id);
            if (match.player2Id) playerIds.add(match.player2Id);
        });

        console.log(`[autoSelectRoundRobinWinner] Zidentyfikowano ${playerIds.size} graczy`);

        playerIds.forEach(playerId => {
            playerStats[playerId] = {
                playerId,
                points: 0,
                matches: 0,
                smallPoints: 0,
                wins: 0,
                losses: 0,
                headToHead: {}
            };
        });

        // Oblicz statystyki na podstawie meczu00f3w
        matches.forEach(match => {
            if (match.status !== 'completed' || !match.player1Id || !match.player2Id) return;

            const player1 = playerStats[match.player1Id];
            const player2 = playerStats[match.player2Id];

            player1.matches++;
            player2.matches++;

            const p1Score = match.player1Score || 0;
            const p2Score = match.player2Score || 0;

            console.log(`[autoSelectRoundRobinWinner] Mecz: ${match.player1Id} vs ${match.player2Id}, Wynik: ${p1Score}:${p2Score}`);

            // Dodaj wyniki bezpou015brednich starau0144
            if (p1Score > p2Score) {
                player1.points += 2; // 2 punkty za zwyciu0119stwo
                player1.wins++;
                player2.losses++;
                player1.headToHead[match.player2Id] = 1;
                player2.headToHead[match.player1Id] = -1;
            } else if (p2Score > p1Score) {
                player2.points += 2; // 2 punkty za zwyciu0119stwo
                player2.wins++;
                player1.losses++;
                player2.headToHead[match.player1Id] = 1;
                player1.headToHead[match.player2Id] = -1;
            }

            // Oblicz mau0142e punkty (ru00f3u017cnica punktu00f3w w setach)
            player1.smallPoints += p1Score - p2Score;
            player2.smallPoints += p2Score - p1Score;
        });

        console.log(`[autoSelectRoundRobinWinner] Statystyki graczy:`, playerStats);

        // Posortuj graczy wg punktu00f3w, bezpou015brednich starau0144 i mau0142ych punktu00f3w
        const rankedPlayers = Object.values(playerStats).sort((a, b) => {
            // 1. Najpierw po punktach (wiu0119cej punktu00f3w = wyu017csza pozycja)
            if (a.points !== b.points) return b.points - a.points;

            // 2. Jeu015bli punkty su0105 ru00f3wne, sprawdu017a bezpou015brednie starcie
            if (a.headToHead[b.playerId] !== undefined) {
                return a.headToHead[b.playerId] > 0 ? -1 : 1;
            }

            // 3. Jeu015bli nie ma bezpou015bredniego starcia lub jest remis, sprawdu017a mau0142e punkty
            return b.smallPoints - a.smallPoints;
        });

        console.log(`[autoSelectRoundRobinWinner] Posortowani gracze:`, rankedPlayers);

        // Jeu015bli jest chociau017c jeden gracz, wybierz zwyciu0119zcu0119
        if (rankedPlayers.length > 0) {
            const winner = rankedPlayers[0];
            console.log(`[autoSelectRoundRobinWinner] Zwyciu0119zca: ${winner.playerId}`);
            
            try {
                // Ustaw zwyciu0119zcu0119 turnieju - uu017cywamy timeout, u017ceby uniknu0105u0107 blokowania gu0142u00f3wnego wu0105tku
                const { error } = await new Promise<{error?: any}>((resolve) => {
                    setTimeout(async () => {
                        const result = await supabase
                            .from('tournaments')
                            .update({ 
                                winner_id: winner.playerId,
                                status: 'completed' 
                            })
                            .eq('id', tournamentId);
                        resolve(result);
                    }, 100); // Opu00f3u017anienie 100ms
                });

                if (error) {
                    console.error(`[autoSelectRoundRobinWinner] Bu0142u0105d podczas ustawiania zwyciu0119zcy:`, error);
                    return null;
                } else {
                    console.log(`[autoSelectRoundRobinWinner] Turniej ${tournamentId} zakou0144czony. Zwyciu0119zca: ${winner.playerId}`);
                    // Po wyłonieniu zwycięzcy odśwież dane turnieju
                    return winner.playerId;
                }
            } catch (error) {
                console.error(`[autoSelectRoundRobinWinner] Bu0142u0105d podczas aktualizacji turnieju:`, error);
                return null;
            }
        } else {
            console.error(`[autoSelectRoundRobinWinner] Brak graczy do wybrania zwyciu0119zcy`);
            return null;
        }
    } catch (error) {
        console.error(`[autoSelectRoundRobinWinner] Bu0142u0105d podczas wyau0142aniania zwyciu0119zcy:`, error);
        return null;
    }
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
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
                const playerIds = participantsData.map(p => p.player_id);

                const numGroups = Math.min(4, Math.ceil(playerIds.length / 3)); // Aim for 3-4 players per group
                
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

    fetchTournaments: async () => {
        // Sprawdź, czy ostatnie odświeżenie było wystarczająco dawno
        const now = Date.now();
        const lastFetch = get().lastFetchTimestamp || 0;
        const minInterval = 1500; // Zwiększam interwał do 1.5 sekundy

        if (now - lastFetch < minInterval) {
            console.log(`[STORE] Pomijanie fetchTournaments - zbyt krótki interwał (${now - lastFetch}ms)`);
            return;
        }

        set({loading: true, error: null});
        console.log('[STORE] set loading: true (fetchTournaments)');
        try {
            const {data: tournamentsData, error: tErr} = await supabase
                .from('tournaments')
                .select('*');
            if (tErr) throw tErr;

            const {data: participantsData, error: pErr} = await supabase
                .from('tournament_participants')
                .select('tournament_id, player_id');
            if (pErr) throw pErr;

            const {data: matchesData, error: mErr} = await supabase
                .from('tournament_matches')
                .select('*');
            if (mErr) throw mErr;

            const participantsByTournament: Record<string, string[]> = {};
            (participantsData || []).forEach((p: any) => {
                if (!participantsByTournament[p.tournament_id]) {
                    participantsByTournament[p.tournament_id] = [];
                }
                participantsByTournament[p.tournament_id].push(p.player_id);
            });

            const matchesByTournament: Record<string, TournamentMatch[]> = {};
            (matchesData || []).forEach((m: any) => {
                if (!matchesByTournament[m.tournament_id]) {
                    matchesByTournament[m.tournament_id] = [];
                }
                matchesByTournament[m.tournament_id].push({
                    id: m.id,
                    tournamentId: m.tournament_id,
                    round: m.round,
                    player1Id: m.player1_id,
                    player2Id: m.player2_id,
                    winner: m.winner_id ?? null,
                    matchId: m.id ?? null,
                    status: m.status === 'pending_players' ? 'pending' : m.status,
                    player1Score: m.player1_score ?? null,
                    player2Score: m.player2_score ?? null,
                    nextMatchId: m.next_match_id ?? null,
                    sets: m.sets,
                    group: m.group
                });
            });

            const tournaments: Tournament[] = (tournamentsData || []).map((t: any) => {
                const matches = matchesByTournament[t.id] || [];
                return {
                    id: t.id,
                    name: t.name,
                    format: t.format ?? 'KNOCKOUT',
                    date: t.date,
                    status: t.status,
                    createdAt: t.created_at,
                    updatedAt: t.updated_at,
                    participants: participantsByTournament[t.id] || [],
                    matches,
                    tournamentMatches: matches,
                    winner: t.winner_id,
                };
            });

            set({tournaments, loading: false, lastFetchTimestamp: Date.now()});
            console.log('[STORE] set loading: false (fetchTournaments)');
        } catch (error: any) {
            console.error("Fetch Tournaments Error:", error);
            set({loading: false, error: error.message || 'Failed to fetch tournaments'});
            console.log('[STORE] set loading: false (catch fetchTournaments)');
        }
    },

    createTournament: async (name: string, date: string, format: TournamentFormat, playerIds: string[]): Promise<string | undefined> => {
        set({loading: true, error: null});
        console.log('[STORE] set loading: true (createTournament)');
        let tournamentId: string | undefined = undefined;
        try {
            if (playerIds.length < 2) {
                throw new Error("Minimum 2 players required");
            }

            const {data: tData, error: tErr} = await supabase
                .from('tournaments')
                .insert({name, date, format, status: 'pending'})
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
                await supabase.from('tournaments').delete().eq('id', tournamentId);
                throw pErr;
            }

            await get().fetchTournaments();
            set({loading: false});
            console.log('[STORE] set loading: false (createTournament)');
            return tournamentId;

        } catch (error: any) {
            console.error("Create Tournament Error:", error);
            if (tournamentId) {
                await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId);
                await supabase.from('tournaments').delete().eq('id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to create tournament'});
            console.log('[STORE] set loading: false (catch createTournament)');
            return undefined;
        }
    },

    generateAndStartTournament: async (tournamentId: string) => {
        set({loading: true, error: null});
        console.log('[STORE] set loading: true (generateAndStartTournament)');
        let generatedMatchesInserted = false;

        try {
            const existingTournament = get().tournaments.find(t => t.id === tournamentId);
            if (!existingTournament) throw new Error(`Tournament ${tournamentId} not found.`);
            if (existingTournament.status !== 'pending') throw new Error(`Tournament ${tournamentId} is not in pending state.`);

            const {data: participantsData, error: pFetchErr} = await supabase
                .from('tournament_participants')
                .select('player_id')
                .eq('tournament_id', tournamentId);

            if (pFetchErr) throw pFetchErr;
            if (!participantsData || participantsData.length < 2) {
                throw new Error("Not enough participants found for this tournament.");
            }
            const playerIds = participantsData.map(p => p.player_id);

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
                const matchesToInsert: TournamentMatchInsert[] = schedule.map((match, index) => ({
                    id: uuidv4(),
                    tournament_id: tournamentId,
                    round: 1,
                    match_number: index + 1,
                    player1_id: match.player1Id,
                    player2_id: match.player2Id,
                    player1_score: null,
                    player2_score: null,
                    winner_id: null,
                    status: 'scheduled',
                    next_match_id: null,
                }));

                const {error: mErr} = await supabase.from('tournament_matches').insert(matchesToInsert);
                if (mErr) throw mErr;
                generatedMatchesInserted = true;

                const {error: statusErr} = await supabase
                    .from('tournaments')
                    .update({status: 'active'})
                    .eq('id', tournamentId);
                if (statusErr) throw statusErr;

                await get().fetchTournaments();
                set({loading: false});
                console.log('[STORE] set loading: false (generateAndStartTournament)');
            } else if (existingTournament.format === 'GROUP') {
                const numGroups = Math.min(4, Math.ceil(playerIds.length / 3)); // Aim for 3-4 players per group
                const groups = generateGroups(playerIds, numGroups);
                const groupMatches = generateGroupMatches(tournamentId, groups);
                
                const matchesToInsert: TournamentMatchInsert[] = groupMatches.map((match, index) => ({
                    id: uuidv4(),
                    tournament_id: tournamentId,
                    round: 1, // Group stage is round 1
                    match_number: index + 1,
                    player1_id: match.player1Id,
                    player2_id: match.player2Id,
                    player1_score: null,
                    player2_score: null,
                    winner_id: null,
                    status: 'scheduled',
                    next_match_id: null,
                    group: match.group
                }));
                
                const {error: mErr} = await supabase.from('tournament_matches').insert(matchesToInsert);
                if (mErr) throw mErr;
                generatedMatchesInserted = true;
                
                const {error: statusErr} = await supabase
                    .from('tournaments')
                    .update({status: 'active'})
                    .eq('id', tournamentId);
                if (statusErr) throw statusErr;
                
                await get().fetchTournaments();
                set({loading: false});
                console.log('[STORE] set loading: false (generateAndStartTournament)');
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

                const {error: mErr} = await supabase.from('tournament_matches').insert(matchesToInsert);
                if (mErr) throw mErr;
                generatedMatchesInserted = true;

                const {error: statusErr} = await supabase
                    .from('tournaments')
                    .update({status: 'active'})
                    .eq('id', tournamentId);
                if (statusErr) throw statusErr;

                await get().fetchTournaments();
                set({loading: false});
                console.log('[STORE] set loading: false (generateAndStartTournament)');
            }

        } catch (error: any) {
            console.error("Generate and Start Tournament Error:", error);
            if (generatedMatchesInserted) {
                await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
            }
            set({loading: false, error: error.message || 'Failed to generate and start tournament'});
            console.log('[STORE] set loading: false (catch generateAndStartTournament)');
        }
    },

    updateMatchResult: async (tournamentId: string, matchId: string, scores: {
        player1Score: number;
        player2Score: number;
        sets?: MatchSet[]
    }) => {
        set({loading: true, error: null});
        console.log('[STORE] set loading: true (updateMatchResult)');
        try {
            // Uu017cywamy timeout, aby uniknu0105u0107 blokowania gu0142u00f3wnego wu0105tku
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const currentMatch = get().tournaments.find(t => t.id === tournamentId)
                ?.matches.find(m => m.id === matchId);

            if (!currentMatch) throw new Error(`Match ${matchId} not found in tournament ${tournamentId}`);
            if (currentMatch.status === 'completed') {
                console.warn(`Match ${matchId} is already completed.`);
                set({loading: false});
                return;
            }
            if (!currentMatch.player1Id || !currentMatch.player2Id) throw new Error(`Match ${matchId} lacks players.`);

            let p1FinalScore = scores.player1Score;
            let p2FinalScore = scores.player2Score;
            if (scores.sets && scores.sets.length > 0) {
                p1FinalScore = 0;
                p2FinalScore = 0;
                scores.sets.forEach(set => {
                    if (set.player1Score > set.player2Score) p1FinalScore++;
                    else if (set.player2Score > set.player1Score) p2FinalScore++;
                });
            }

            if (p1FinalScore === p2FinalScore) throw new Error("Match score cannot be a draw in knockout");

            const winnerId = p1FinalScore > p2FinalScore ? currentMatch.player1Id : currentMatch.player2Id;

            const updateData = {
                player1_score: scores.player1Score,
                player2_score: scores.player2Score,
                winner_id: winnerId,
                status: 'completed',
                sets: scores.sets,
            };

            // Aktualizacja danych meczu z opu00f3u017anieniem, aby uniknu0105u0107 blokowania interfejsu
            const {error: updateErr} = await new Promise<{error?: any}>(resolve => {
                setTimeout(async () => {
                    const result = await supabase
                        .from('tournament_matches')
                        .update(updateData)
                        .eq('id', matchId);
                    resolve(result);
                }, 50);
            });
            
            if (updateErr) throw updateErr;

            if (currentMatch.nextMatchId) {
                const nextMatchId = currentMatch.nextMatchId;
                const nextMatch = get().tournaments.find(t => t.id === tournamentId)
                    ?.matches.find(m => m.id === nextMatchId);

                if (nextMatch) {
                    const updateData: {
                        player1_id?: string;
                        player2_id?: string;
                        status?: TournamentMatch['status'];
                    } = {};

                    if (nextMatch.player1Id === null) {
                        updateData.player1_id = winnerId;
                    } else if (nextMatch.player2Id === null) {
                        updateData.player2_id = winnerId;
                    }

                    if ((updateData.player1_id || nextMatch.player1Id) &&
                        (updateData.player2_id || nextMatch.player2Id)) {
                        updateData.status = 'scheduled';
                    }

                    if (Object.keys(updateData).length > 0) {
                        // Aktualizacja nastu0119pnego meczu z opu00f3u017anieniem
                        await new Promise(resolve => {
                            setTimeout(async () => {
                                await supabase
                                    .from('tournament_matches')
                                    .update(updateData)
                                    .eq('id', nextMatchId);
                                resolve(null);
                            }, 50);
                        });
                    }
                }
            } else {
                console.log(`[updateMatchResult] Brak nastu0119pnego meczu - sprawdzanie czy turniej siu0119 zakou0144czyu0142`);
                const tournament = get().tournaments.find(t => t.id === tournamentId);
                
                if (tournament?.format === TournamentFormat.KNOCKOUT) {
                    console.log(`[updateMatchResult] Turniej w formacie KNOCKOUT - ustawianie zwyciu0119zcy ${winnerId}`);
                    // Dla formatu KNOCKOUT, ostatni mecz (finau0142) kou0144czy turniej
                    try {
                        await new Promise(resolve => {
                            setTimeout(async () => {
                                await get().setTournamentWinner(tournamentId, winnerId);
                                resolve(null);
                            }, 100);
                        });
                        console.log(`[updateMatchResult] Ustawiono zwyciu0119zcu0119 turnieju KNOCKOUT`);
                    } catch (error) {
                        console.error(`[updateMatchResult] Bu0142u0105d podczas ustawiania zwyciu0119zcy:`, error);
                    } finally {
                        set({loading: false});
                    }
                } else if (tournament?.format === TournamentFormat.ROUND_ROBIN) {
                    console.log(`[updateMatchResult] Turniej w formacie ROUND_ROBIN - sprawdzanie czy wszystkie mecze zakou0144czone`);
                    // Dla formatu ROUND_ROBIN sprawdzamy, czy wszystkie mecze zostau0142y rozegrane
                    try {
                        // Pobieramy dane z opu00f3u017anieniem
                        const { data: freshTournament, error: tournamentError } = await new Promise<{data?: any, error?: any}>(resolve => {
                            setTimeout(async () => {
                                const result = await supabase
                                    .from('tournaments')
                                    .select('*, tournament_matches(status)')
                                    .eq('id', tournamentId)
                                    .single();
                                resolve(result);
                            }, 50);
                        });

                        if (tournamentError) {
                            console.error("Bu0142u0105d podczas pobierania danych turnieju:", tournamentError);
                            set({loading: false});
                            return;
                        }

                        const tournamentMatches = freshTournament?.tournament_matches || [];
                        console.log(`Sprawdzanie ${tournamentMatches.length} meczu00f3w w turnieju ${tournamentId}`);
                        
                        const allMatchesCompleted = tournamentMatches.every((m: any) => m.status === 'completed');
                        console.log(`Czy wszystkie mecze su0105 zakou0144czone: ${allMatchesCompleted}`);

                        if (allMatchesCompleted && tournamentMatches.length > 0) {
                            console.log(`Wszystkie mecze zakou0144czone (${tournamentMatches.length}). Wybieranie zwyciu0119zcy...`);
                            try {
                                const winnerId = await autoSelectRoundRobinWinner(tournamentId);
                                console.log(`Zakou0144czono turniej. Zwyciu0119zca: ${winnerId}`);
                                // Po wyłonieniu zwycięzcy odśwież dane turnieju
                                await get().fetchTournaments();
                            } catch (error) {
                                console.error("Bu0142u0105d podczas wybierania zwyciu0119zcy:", error);
                            } finally {
                                // Zawsze zresetuj stan ładowania, niezależnie od wyniku
                                set({loading: false});
                            }
                        } else {
                            console.log(`Turniej trwa dalej. Zakou0144czonych meczu00f3w: ${tournamentMatches.filter((m: any) => m.status === 'completed').length}/${tournamentMatches.length}`);
                            set({loading: false});
                        }
                    } catch (error) {
                        console.error("Bu0142u0105d podczas sprawdzania stanu turnieju:", error);
                        set({loading: false});
                        return;
                    }
                } else if (tournament?.format === TournamentFormat.GROUP) {
                    // Dla formatu GROUP nie kou0144czymy turnieju automatycznie
                    console.log(`[updateMatchResult] Turniej w formacie GROUP - nie wybieramy zwyciu0119zcy automatycznie`);
                    set({loading: false});
                } else {
                    // Resetowanie stanu u0142adowania dla innych przypadku00f3w
                    set({loading: false});
                }
            }

            // Na kou0144cu operacji zawsze odu015bwieu017camy dane z bazy
            await new Promise(resolve => {
                setTimeout(async () => {
                    await get().fetchTournaments();
                    resolve(null);
                }, 100);
            });
            
            // Dodatkowe zabezpieczenie - ustawiamy loading na false na kou0144cu funkcji
            set({loading: false});
            console.log('[STORE] set loading: false (finally updateMatchResult)');

        } catch (error: any) {
            console.error("Update Match Result Error:", error);
            set({loading: false, error: error.message || 'Failed to update match'});
            console.log('[STORE] set loading: false (catch updateMatchResult)');
        } finally {
            // Zawsze resetujemy stan u0142adowania
            console.log("[updateMatchResult] Finalizacja - resetowanie stanu u0142adowania");
            set({loading: false});
            console.log('[STORE] set loading: false (finally updateMatchResult)');
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
            winner: m.winner ?? null,
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
            console.error("DB Status Update Error:", error);
            get().fetchTournaments();
        }
    },

    setTournamentWinner: async (tournamentId: string, winnerId: string) => {
        if (!winnerId) {
            console.warn("Cannot set tournament winner - no winner ID provided");
            return;
        }

        console.log(`[setTournamentWinner] Setting winner ${winnerId} for tournament ${tournamentId}`);
        set({loading: true, error: null});
        console.log('[STORE] set loading: true (setTournamentWinner)');
        try {
            // Najpierw aktualizujemy stan lokalny
            set(state => ({
                tournaments: state.tournaments.map(t =>
                    t.id === tournamentId ? {
                        ...t,
                        winner: winnerId,
                        status: TournamentStatus.COMPLETED
                    } : t
                )
            }));

            // Nastu0119pnie aktualizujemy bazu0119 danych
            const {error} = await supabase.from('tournaments').update({
                winner_id: winnerId,
                status: TournamentStatus.COMPLETED
            }).eq('id', tournamentId);

            if (error) throw error;
            
            // Odu015bwieu017c dane turnieju aby mieu0107 pewnou015bu0107, u017ce wszystko jest aktualne
            await get().fetchTournaments();
            console.log(`[setTournamentWinner] Successfully set winner ${winnerId} for tournament ${tournamentId}`);
            set({loading: false});
            console.log('[STORE] set loading: false (setTournamentWinner)');
        } catch (error: any) {
            console.error("Failed to set tournament winner:", error);
            set({error: error.message || "Failed to set winner"});
            set({loading: false});
            console.log('[STORE] set loading: false (catch setTournamentWinner)');
        }
    },
}));

// Dodanie zmiennej do śledzenia ostatniego stanu turniejów
let lastTournamentsState: {
    tournamentId: string;
    isCompleted: boolean;
    hasWinner: boolean;
}[] = [];

export function useTournamentsRealtime() {
    useEffect(() => {
        const channel = supabase
            .channel('tournaments-changes')
            .on(
                'postgres_changes',
                {event: '*', schema: 'public', table: 'tournaments'},
                () => {
                    // Blokada: nie fetchuj, jeśli loading już jest true
                    if (useTournamentStore.getState().loading) {
                        console.log(`[STORE] Pomijanie odświeżania (loading już aktywny)`);
                        return;
                    }

                    // Sprawdź czy minęła minimalna przerwa między odświeżeniami
                    const now = Date.now();
                    const lastFetch = useTournamentStore.getState().lastFetchTimestamp || 0;
                    const minInterval = 2000; // Zwiększam minimalny interwał do 2 sekund dla subskrypcji

                    if (now - lastFetch < minInterval) {
                        console.log(`[STORE] Pomijanie odświeżania (za wcześnie, przerwa: ${now - lastFetch}ms)`);
                        return;
                    }

                    // Sprawdź czy stan turniejów znacząco się zmienił, aby uniknąć niepotrzebnych odświeżeń
                    const currentTournaments = useTournamentStore.getState().tournaments;
                    const currentState = currentTournaments.map(t => ({
                        tournamentId: t.id,
                        isCompleted: t.status === 'completed',
                        hasWinner: Boolean(t.winner)
                    }));

                    // Sprawdzanie, czy jedyną zmianą jest zakończenie turnieju, który już ma zwycięzcę
                    const significantChange = !lastTournamentsState.length || currentState.some((curr, i) => {
                        const prev = lastTournamentsState[i];
                        // Jeśli turniej już był zakończony i miał zwycięzcę, to nie ma potrzeby odświeżania
                        if (prev && prev.tournamentId === curr.tournamentId && 
                            prev.isCompleted && prev.hasWinner && 
                            curr.isCompleted && curr.hasWinner) {
                            return false;
                        }
                        return !prev || prev.tournamentId !== curr.tournamentId || 
                               prev.isCompleted !== curr.isCompleted ||
                               prev.hasWinner !== curr.hasWinner;
                    });

                    lastTournamentsState = currentState;

                    if (!significantChange) {
                        console.log(`[STORE] Pomijanie odświeżania (brak istotnych zmian w turniejach)`);
                        return;
                    }

                    console.log(`[STORE] Odświeżanie danych przez subskrypcję (przerwa: ${now - lastFetch}ms)`);
                    useTournamentStore.getState().fetchTournaments().catch((e) =>
                        console.error("Error fetching tournaments:", e));
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel).catch((e) =>
                console.error("Error removing channel:", e));
        };
    }, []);
}
