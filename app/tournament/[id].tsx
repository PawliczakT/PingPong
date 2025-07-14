//app/tournament/[id].tsx
import React, {useEffect, useState} from "react";
import {Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from "react-native";
import {Stack, useLocalSearchParams, useRouter} from "expo-router";
import {Ionicons} from '@expo/vector-icons';
import {BarChart, Calendar, Home, Play, PlusCircle, Trophy, Users} from "lucide-react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import {Player, Tournament, TournamentFormat, TournamentMatch} from "@/backend/types";
import {formatDate} from "@/utils/formatters";
import Button from "@/components/Button";
import PlayerAvatar from "@/components/PlayerAvatar";
import TournamentBracket from "@/components/TournamentBracket";
import {
    TOURNAMENTS_QUERY_KEY,
    useGenerateMatches,
    useSetTournamentWinner,
    useStartTournament,
    useTournament
} from "@/hooks/useTournaments";
import {getPlayerTournamentWins} from "@/selectors/tournamentSelectors";
import {useQueryClient} from "@tanstack/react-query";

export default function TournamentDetailScreen() {
    const {id} = useLocalSearchParams();
    const router = useRouter();
    const [showConfirmComplete, setShowConfirmComplete] = useState(false);
    const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"bracket" | "matches" | "players">("bracket");
    const {data: tournament, isLoading, refetch} = useTournament(id as string);
    const queryClient = useQueryClient();
    const startTournamentMutation = useStartTournament();
    const setTournamentWinnerMutation = useSetTournamentWinner();
    const generateMatchesMutation = useGenerateMatches();
    const playerStore = usePlayerStore();
    const tournamentMatches = tournament?.matches || [];
    const winner = tournament?.winner ? playerStore.getPlayerById(tournament.winner) : null;

    useEffect(() => {
        if (!tournament || tournament.status === 'completed') return;
        if (tournament.format !== TournamentFormat.GROUP) return;

        const groupMatches = tournamentMatches.filter(m => m.round === 1);
        const allGroupCompleted = groupMatches.length > 0 && groupMatches.every(m => m.status === 'completed');
        const hasKnockout = tournamentMatches.some(m => m.round > 1);

        if (allGroupCompleted && !hasKnockout && !generateMatchesMutation.isPending) {
            generateMatchesMutation.mutate({tournamentId: tournament.id}, {
                onSuccess: () => Alert.alert('Knockout Phase', 'Knockout phase has been automatically created!'),
                onError: (err: any) => console.error('[KO] Error generating knockout:', err.message)
            });
        }
    }, [tournamentMatches, tournament, generateMatchesMutation]);

    useEffect(() => {
        setShowConfirmComplete(false);
        setSelectedWinnerId(null);
    }, [tournament?.status]);

    const onRefresh = async () => {
        await refetch();
    };

    if (isLoading && !tournament) {
        return <SafeAreaView style={styles.container}><View style={styles.notFound}><Text style={styles.notFoundText}>Loading
            Tournament...</Text></View></SafeAreaView>;
    }

    if (!tournament) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{title: "Tournament Not Found"}}/>
                <View style={styles.notFound}>
                    <Text style={styles.notFoundText}>Tournament not found</Text>
                    <Button title="Go Back" onPress={() => router.back()} variant="outline"/>
                </View>
            </SafeAreaView>
        );
    }

    const participants = (tournament.participants || [])
        .map((pId) => playerStore.getPlayerById(pId))
        .filter((player): player is Player => player !== undefined);

    const handleStartTournament = () => {
        startTournamentMutation.mutate(
            {
                tournamentId: tournament.id,
                format: tournament.format,
                playerIds: tournament.participants
            },
            {onError: (error: any) => Alert.alert("Error", error.message || "Failed to start tournament.")}
        );
    };

    const handleCompleteTournament = async () => {
        if (!selectedWinnerId) {
            Alert.alert("Error", "Please select a winner before confirming.");
            return;
        }

        if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setTournamentWinnerMutation.mutate(
            {tournamentId: tournament.id, winnerId: selectedWinnerId},
            {
                onSuccess: () => Alert.alert("Success", "Tournament completed successfully"),
                onError: (error: any) => Alert.alert("Error", error.message || "Failed to complete tournament.")
            }
        );
    };

    const toggleWinnerSelection = () => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(e => console.error("Haptics error:", e));
        }
        const allMatchesCompleted = tournamentMatches.every(match => match.status === 'completed');
        const hasKnockout = tournamentMatches.some(m => m.round > 1);
        const allGroupCompleted = tournamentMatches.filter(m => m.round === 1).every(m => m.status === 'completed');

        if (tournament.format === TournamentFormat.ROUND_ROBIN) {
            if (!allMatchesCompleted) {
                Alert.alert("Tournament incomplete", "All matches must be played before selecting a winner.");
                return;
            }
        } else if (tournament.format === TournamentFormat.GROUP) {
            if (!allGroupCompleted) {
                Alert.alert("Group stage incomplete", "All group matches must be played before selecting a winner.");
                return;
            }
            if (!hasKnockout) {
                Alert.alert("Knockout phase not generated", "You must generate the knockout phase before selecting a winner.");
                return;
            }
            if (!allMatchesCompleted) {
                Alert.alert("Tournament incomplete", "All matches must be played before selecting a winner.");
                return;
            }
        } else {
            const finalMatch = tournamentMatches.find(match => {
                const maxRound = Math.max(...tournamentMatches.map(m => m.round));
                return match.round === maxRound;
            });
            if (finalMatch && finalMatch.status !== 'completed') {
                Alert.alert("Final not played", "The final match must be played before selecting a winner.");
                return;
            }
        }

        setShowConfirmComplete(!showConfirmComplete);
        if (!showConfirmComplete) {
            setActiveTab("players");
            setSelectedWinnerId(null);
        }
    };

    const handleMatchPress = (match: TournamentMatch) => {
        if (match.status === 'completed') {
            if (match.matchId) router.push(`/match/${match.matchId}`);
            else Alert.alert('Match finished', 'You can no longer play or edit this match.');
            return;
        }
        if (tournament.status !== 'active') {
            Alert.alert('Tournament inactive', 'The tournament must be started to play matches.');
            return;
        }
        if (match.status === "scheduled" && match.player1Id && match.player2Id) {
            router.push({
                pathname: "/tournament/record-match",
                params: {
                    tournamentId: tournament.id,
                    matchId: match.id,
                    player1Id: match.player1Id,
                    player2Id: match.player2Id,
                },
            });
            return;
        }
        Alert.alert("Match Info", "Waiting for players from previous rounds.");
    };

    const getStatusColor = () => {
        switch (tournament.status) {
            case 'pending':
                return colors.primary;
            case 'active':
                return colors.warning;
            case 'completed':
                return colors.success;
            default:
                return colors.textLight;
        }
    };

    const getStatusText = () => {
        switch (tournament.status) {
            case 'pending':
                return "Upcoming";
            case 'active':
                return "In Progress";
            case 'completed':
                return "Completed";
            default:
                return "Unknown";
        }
    };

    function calculateRoundRobinStandings(participants: Player[], matches: TournamentMatch[]) {
        const standings = participants.map(player => ({
            player,
            matches: 0,
            wins: 0,
            losses: 0,
            tournamentPoints: 0,
            points: 0,
            pointsAgainst: 0,
            pointsDiff: 0
        }));

        matches.forEach(match => {
            if (match.status !== 'completed' || !match.player1Id || !match.player2Id) return;
            const player1Index = standings.findIndex(s => s.player.id === match.player1Id);
            const player2Index = standings.findIndex(s => s.player.id === match.player2Id);
            if (player1Index === -1 || player2Index === -1) return;

            standings[player1Index].matches++;
            standings[player2Index].matches++;

            if (match.sets && Array.isArray(match.sets)) {
                match.sets.forEach((set: any) => {
                    const p1Score = set.player1Score || 0;
                    const p2Score = set.player2Score || 0;
                    standings[player1Index].points += p1Score;
                    standings[player1Index].pointsAgainst += p2Score;
                    standings[player2Index].points += p2Score;
                    standings[player2Index].pointsAgainst += p1Score;
                });
            }

            if (match.player1Score !== null && match.player2Score !== null) {
                if (match.player1Score > match.player2Score) {
                    standings[player1Index].wins++;
                    standings[player1Index].tournamentPoints += 2;
                    standings[player2Index].losses++;
                    standings[player2Index].tournamentPoints += 1;
                } else if (match.player2Score > match.player1Score) {
                    standings[player2Index].wins++;
                    standings[player2Index].tournamentPoints += 2;
                    standings[player1Index].losses++;
                    standings[player1Index].tournamentPoints += 1;
                }
            }
        });

        standings.forEach(s => s.pointsDiff = s.points - s.pointsAgainst);

        return standings.sort((a, b) => {
            if (a.tournamentPoints !== b.tournamentPoints) return b.tournamentPoints - a.tournamentPoints;
            if (a.wins !== b.wins) return b.wins - a.wins;
            if (a.pointsDiff !== b.pointsDiff) return b.pointsDiff - a.pointsDiff;
            return b.points - a.points;
        });
    }

    function calculateGroupStandings(participants: Player[], matches: TournamentMatch[]) {
        const groupNumbers = Array.from(new Set(matches.filter(m => m.group != null).map(m => m.group!)));
        const groupStandings: Record<number, ReturnType<typeof calculateRoundRobinStandings>> = {};

        groupNumbers.forEach(groupNum => {
            const groupMatches = matches.filter(m => m.group === groupNum);
            const playerIds = new Set<string>();
            groupMatches.forEach(match => {
                if (match.player1Id) playerIds.add(match.player1Id);
                if (match.player2Id) playerIds.add(match.player2Id);
            });
            const groupParticipants = Array.from(playerIds).map(id => participants.find(p => p.id === id)).filter((p): p is Player => !!p);
            groupStandings[groupNum] = calculateRoundRobinStandings(groupParticipants, groupMatches);
        });

        return groupStandings;
    }

    function groupMatchesByRound(matches: TournamentMatch[]): TournamentMatch[][] {
        if (!matches || matches.length === 0) return [];
        const grouped: { [round: number]: TournamentMatch[] } = {};
        matches.forEach(match => {
            if (!grouped[match.round]) grouped[match.round] = [];
            grouped[match.round].push(match);
        });
        return Object.keys(grouped)
            .sort((a, b) => Number(a) - Number(b))
            .map(round => grouped[Number(round)]);
    }

    const bracketRounds = groupMatchesByRound(tournamentMatches);

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <Stack.Screen
                options={{
                    title: tournament.name,
                    headerShadowVisible: false,
                    headerStyle: {backgroundColor: colors.card},
                    headerTitleStyle: {color: colors.text},
                    headerTintColor: colors.primary,
                }}
            />

            <ScrollView contentContainerStyle={{paddingBottom: 70}}
                        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh}
                                                        tintColor={colors.primary}/>}>
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{tournament.name}</Text>
                        <View style={[styles.statusBadge, {backgroundColor: getStatusColor()}]}>
                            <Text style={styles.statusText}>{getStatusText()}</Text>
                        </View>
                    </View>

                    <View style={styles.infoContainer}>
                        <View style={styles.infoItem}><Calendar size={16} color={colors.textLight}/><Text
                            style={styles.infoText}>{formatDate(tournament.date)}</Text></View>
                        <View style={styles.infoItem}><Users size={16} color={colors.textLight}/><Text
                            style={styles.infoText}>{participants.length} players</Text></View>
                        <View style={styles.infoItem}><Trophy size={16} color={colors.textLight}/><Text
                            style={styles.infoText}>{tournament.format}</Text></View>
                    </View>

                    {tournament.status === 'completed' && winner && (
                        <View style={styles.winnerContainer}>
                            <Text style={styles.winnerLabel}>Tournament Winner</Text>
                            <View style={styles.winnerContent}>
                                <Trophy size={24} color={colors.success}/>
                                <Text style={styles.winnerName}>{winner.name || "Unknown"}</Text>
                            </View>
                        </View>
                    )}

                    {tournament.status === 'pending' && (
                        <Button
                            title="Start Tournament"
                            onPress={handleStartTournament}
                            loading={startTournamentMutation.isPending}
                            style={styles.startButton}
                        />
                    )}

                    {tournament.status === 'active' && (
                        <Button
                            title={showConfirmComplete ? "Cancel Completion" : "Complete Tournament"}
                            variant={showConfirmComplete ? "secondary" : "outline"}
                            icon={<Trophy size={16} color={showConfirmComplete ? "#fff" : colors.primary}/>}
                            onPress={toggleWinnerSelection}
                            style={styles.actionButton}
                        />
                    )}
                </View>

                <View style={styles.tabs}>
                    <Pressable style={[styles.tab, activeTab === "bracket" && styles.activeTab]}
                               onPress={() => setActiveTab("bracket")}>
                        <Text style={[styles.tabText, activeTab === "bracket" && styles.activeTabText]}>Bracket</Text>
                    </Pressable>
                    <Pressable style={[styles.tab, activeTab === "matches" && styles.activeTab]}
                               onPress={() => setActiveTab("matches")}>
                        <Text style={[styles.tabText, activeTab === "matches" && styles.activeTabText]}>Matches</Text>
                    </Pressable>
                    <Pressable style={[styles.tab, activeTab === "players" && styles.activeTab]}
                               onPress={() => setActiveTab("players")}>
                        <Text style={[styles.tabText, activeTab === "players" && styles.activeTabText]}>Players</Text>
                    </Pressable>
                </View>

                {activeTab === "bracket" && (
                    <View style={styles.section}>
                        {(() => {
                            if (tournament.format === TournamentFormat.ROUND_ROBIN) {
                                const standings = calculateRoundRobinStandings(participants, tournamentMatches);
                                return (
                                    <View style={styles.roundRobinContainer}>
                                        <Text style={styles.standingsTitle}>Standings</Text>
                                        <View style={styles.standingsHeader}>
                                            <Text
                                                style={[styles.standingsHeaderCell, styles.playerNameColumn]}>Player</Text>
                                            <Text style={styles.standingsHeaderCell}>P</Text>
                                            <Text style={styles.standingsHeaderCell}>W</Text>
                                            <Text style={styles.standingsHeaderCell}>L</Text>
                                            <Text style={styles.standingsHeaderCell}>Pts</Text>
                                            <Text style={styles.standingsHeaderCell}>+/-</Text>
                                        </View>
                                        {standings.map((standing, index) => (
                                            <View key={standing.player.id}
                                                  style={[styles.standingsRow, index % 2 === 0 ? styles.standingsRowEven : styles.standingsRowOdd]}>
                                                <View
                                                    style={[styles.standingsCell, styles.playerNameColumn, styles.playerNameCell]}>
                                                    <PlayerAvatar name={standing.player.name} player={standing.player}
                                                                  size={24}/>
                                                    <Text style={styles.standingsPlayerName} numberOfLines={1}
                                                          ellipsizeMode="tail">{standing.player.name}</Text>
                                                </View>
                                                <Text style={styles.standingsCell}>{standing.matches}</Text>
                                                <Text style={styles.standingsCell}>{standing.wins}</Text>
                                                <Text style={styles.standingsCell}>{standing.losses}</Text>
                                                <Text style={styles.standingsCell}>{standing.tournamentPoints}</Text>
                                                <Text style={styles.standingsCell}>{standing.pointsDiff}</Text>
                                            </View>
                                        ))}
                                    </View>
                                );
                            } else if (tournament.format === TournamentFormat.GROUP) {
                                const groupStandings = calculateGroupStandings(participants, tournamentMatches);
                                const allGroupMatchesCompleted = tournamentMatches.filter(m => m.round === 1).every(m => m.status === 'completed');
                                const hasKnockout = tournamentMatches.some(m => m.round > 1);
                                return (
                                    <View style={styles.groupStandingsContainer}>
                                        <Text style={styles.standingsTitle}>Group Standings</Text>
                                        {allGroupMatchesCompleted && !hasKnockout && (
                                            <Button
                                                title="Generate Knockout Phase"
                                                onPress={() => generateMatchesMutation.mutate({tournamentId: tournament.id})}
                                                loading={generateMatchesMutation.isPending}
                                                style={styles.generateKnockoutButton}
                                            />
                                        )}
                                        {Object.entries(groupStandings).map(([groupNum, groupStanding]) => (
                                            <View key={`group-${groupNum}`} style={styles.groupSection}>
                                                <Text style={styles.groupTitle}>Group {groupNum}</Text>
                                                <View style={styles.standingsTable}>
                                                    <View style={styles.standingsHeader}>
                                                        <Text
                                                            style={[styles.standingsHeaderCell, styles.playerNameColumn]}>Player</Text>
                                                        <Text style={styles.standingsHeaderCell}>P</Text>
                                                        <Text style={styles.standingsHeaderCell}>W</Text>
                                                        <Text style={styles.standingsHeaderCell}>L</Text>
                                                        <Text style={styles.standingsHeaderCell}>Pts</Text>
                                                        <Text style={styles.standingsHeaderCell}>+/-</Text>
                                                    </View>
                                                    {groupStanding.map((standing, index) => (
                                                        <View key={standing.player.id}
                                                              style={[styles.standingsRow, index % 2 === 0 ? styles.standingsRowEven : styles.standingsRowOdd]}>
                                                            <View
                                                                style={[styles.standingsCell, styles.playerNameColumn, styles.playerNameCell]}>
                                                                <PlayerAvatar name={standing.player.name}
                                                                              player={standing.player} size={24}/>
                                                                <Text style={styles.standingsPlayerName}
                                                                      numberOfLines={1}
                                                                      ellipsizeMode="tail">{standing.player.name}</Text>
                                                            </View>
                                                            <Text style={styles.standingsCell}>{standing.matches}</Text>
                                                            <Text style={styles.standingsCell}>{standing.wins}</Text>
                                                            <Text style={styles.standingsCell}>{standing.losses}</Text>
                                                            <Text
                                                                style={styles.standingsCell}>{standing.tournamentPoints}</Text>
                                                            <Text
                                                                style={styles.standingsCell}>{standing.pointsDiff}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                );
                            } else {
                                if (bracketRounds.length > 0) {
                                    return <TournamentBracket matches={bracketRounds.flat()}
                                                              onMatchPress={handleMatchPress}/>;
                                } else {
                                    return (
                                        <View style={[styles.emptyStateContainer, styles.emptyBracket]}>
                                            <Ionicons name="trophy-outline" size={48} color={colors.textLight}/>
                                            <Text
                                                style={styles.emptyText}>{tournament.status === 'pending' ? 'Start the tournament to generate the bracket.' : 'No matches generated yet.'}</Text>
                                        </View>
                                    );
                                }
                            }
                        })()}
                    </View>
                )}

                {activeTab === "matches" && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Match List</Text>
                        {tournamentMatches.length === 0 ? (
                            <View style={styles.emptyMatches}>
                                <Users size={40} color={colors.textLight}/>
                                <Text
                                    style={styles.emptyText}>{tournament.status === 'pending' ? "Matches will appear here once the tournament starts." : "No matches available for this tournament."}</Text>
                            </View>
                        ) : (
                            <View style={styles.roundMatches}>
                                {bracketRounds.map((roundMatches, roundIndex) => (
                                    <View key={`round-${roundIndex}`} style={{marginBottom: 16}}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: 'bold',
                                            marginBottom: 4,
                                            color: colors.text
                                        }}>Round {roundIndex + 1}</Text>
                                        {roundMatches.map(match => (
                                            <Pressable
                                                key={match.id}
                                                style={[styles.matchListItem, match.status === 'completed' && styles.matchListItemCompleted, match.status === "scheduled" && match.player1Id && match.player2Id && styles.matchListItemPlayable, match.status === 'scheduled' && (!match.player1Id || !match.player2Id) && styles.matchListItemTBD]}
                                                onPress={() => handleMatchPress(match)}
                                            >
                                                <Text
                                                    style={[styles.matchListText, match.status === 'completed' && {opacity: 0.7}]}
                                                    numberOfLines={1} ellipsizeMode="tail">
                                                    {`Round ${match.round}: ${match.player1Id ? playerStore.getPlayerById(match.player1Id)?.name : 'TBD'} vs ${match.player2Id ? playerStore.getPlayerById(match.player2Id)?.name : 'TBD'}`}
                                                </Text>
                                                <View style={styles.matchListIcons}>
                                                    {match.status === "scheduled" && match.player1Id && match.player2Id &&
                                                        <Play size={18} color={colors.primary}
                                                              style={{marginLeft: 8}}/>}
                                                    {match.status === 'completed' && match.player1Score != null && match.player2Score != null ? (
                                                        <Text
                                                            style={styles.viewDetailsText}>{match.player1Score}-{match.player2Score}</Text>
                                                    ) : match.status !== 'scheduled' ? (
                                                        <Text style={styles.viewDetailsText}>Result</Text>
                                                    ) : null}
                                                    {match.status === 'scheduled' && (!match.player1Id || !match.player2Id) &&
                                                        <Text style={styles.tbdText}>TBD</Text>}
                                                </View>
                                            </Pressable>
                                        ))}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {activeTab === "players" && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
                        {participants.length > 0 ? (
                            <View style={styles.participantsList}>
                                {participants.map((player, index) => {
                                    const allTournamentsFromCache = queryClient.getQueryData<Tournament[]>(TOURNAMENTS_QUERY_KEY);
                                    const wins = getPlayerTournamentWins(player.id, allTournamentsFromCache);
                                    return (
                                        <Pressable
                                            key={player.id}
                                            style={[styles.playerRow, index % 2 === 0 ? styles.playerRowEven : styles.playerRowOdd, showConfirmComplete && selectedWinnerId === player.id && styles.selectedPlayerRow]}
                                            onPress={() => {
                                                if (showConfirmComplete) {
                                                    setSelectedWinnerId(player.id);
                                                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                } else {
                                                    router.push(`/player/${player.id}`);
                                                }
                                            }}
                                        >
                                            <View style={styles.playerInfo}>
                                                <PlayerAvatar name={player.name} player={player} size={40}/>
                                                <View>
                                                    <Text style={styles.playerName}>{player.name}</Text>
                                                    <Text style={styles.playerRating}>Rating: {player.eloRating}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.playerStatsContainer}>
                                                <Trophy size={16} color={colors.primary}/>
                                                <Text style={styles.playerWinsText}>{wins}</Text>
                                            </View>
                                            {showConfirmComplete && (
                                                <View
                                                    style={[styles.radioCircle, selectedWinnerId === player.id && styles.radioFilled]}/>
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.emptyMatches}>
                                <Users size={40} color={colors.textLight}/>
                                <Text style={styles.emptyText}>No participants have been added to this tournament
                                    yet.</Text>
                                {tournament.status === 'pending' && <Button title="Add Participants"
                                                                            onPress={() => router.push(`/tournament/edit/${tournament.id}`)}
                                                                            variant="outline" style={{marginTop: 16}}/>}
                            </View>
                        )}

                        {showConfirmComplete && tournament.status === 'active' && (
                            <View style={styles.winnerSelectionContainer}>
                                <Text style={styles.sectionTitle}>Select Tournament Winner</Text>
                                {participants.length > 0 ? (
                                    <View style={styles.winnerSelection}>
                                        {participants.map((player) => (
                                            <Pressable
                                                key={player.id}
                                                style={[styles.winnerOption, selectedWinnerId === player.id && styles.winnerOptionSelected]}
                                                onPress={() => setSelectedWinnerId(player.id)}
                                            >
                                                <PlayerAvatar player={player} name={player.name} size={50}/>
                                                <Text
                                                    style={[styles.winnerOptionName, selectedWinnerId === player.id && styles.winnerOptionNameSelected]}
                                                    numberOfLines={2}>{player.name}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.emptyText}>No participants to select from.</Text>
                                )}
                                <Button
                                    title="Confirm Winner & Complete"
                                    onPress={handleCompleteTournament}
                                    disabled={!selectedWinnerId || setTournamentWinnerMutation.isPending}
                                    loading={setTournamentWinnerMutation.isPending}
                                    variant="primary"
                                    style={{marginTop: 16}}
                                />
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            <View style={styles.bottomMenu}>
                <Pressable style={styles.menuItem} onPress={() => router.push('/')}><Home size={22}
                                                                                          color={colors.textLight}/></Pressable>
                <Pressable style={styles.menuItem} onPress={() => router.push('/players')}><Users size={22}
                                                                                                  color={colors.textLight}/></Pressable>
                <Pressable style={styles.menuItem} onPress={() => router.push('/add-match')}><PlusCircle size={24}
                                                                                                         color={colors.primary}/></Pressable>
                <Pressable style={styles.menuItem} onPress={() => router.push('/tournaments')}><Trophy size={22}
                                                                                                       color={colors.textLight}/></Pressable>
                <Pressable style={styles.menuItem} onPress={() => router.push('/stats')}><BarChart size={22}
                                                                                                   color={colors.textLight}/></Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: 16,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        flex: 1,
        marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "bold",
        textTransform: 'uppercase',
    },
    infoContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    infoItem: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 16,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: colors.textLight,
        marginLeft: 6,
    },
    winnerContainer: {
        alignItems: "center",
        marginVertical: 16,
        backgroundColor: colors.success + "1A",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.success + "40",
    },
    winnerLabel: {
        fontSize: 14,
        color: colors.textLight,
        marginBottom: 4,
        fontWeight: '600',
    },
    winnerContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    winnerName: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.success,
        marginLeft: 8,
    },
    actionButton: {
        marginTop: 16,
    },
    tabs: {
        flexDirection: "row",
        backgroundColor: colors.card,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
        borderBottomWidth: 3,
        borderBottomColor: "transparent",
        marginHorizontal: 4,
    },
    activeTab: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: 16,
        color: colors.textLight,
        fontWeight: "500",
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: "bold",
    },
    section: {
        padding: 16,
        flex: 1,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 16,
    },
    participantsList: {},
    participantItem: {
        width: "33.33%",
        alignItems: "center",
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    participantName: {
        fontSize: 13,
        color: colors.text,
        marginTop: 6,
        textAlign: "center",
        minHeight: 30,
    },
    winnerSelectionContainer: {
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    winnerSelection: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: 'center',
        marginHorizontal: -4,
    },
    winnerOption: {
        width: "33.33%",
        alignItems: "center",
        marginBottom: 16,
        paddingHorizontal: 4,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    winnerOptionSelected: {
        backgroundColor: colors.primary + "20",
        borderColor: colors.primary,
    },
    winnerOptionName: {
        fontSize: 13,
        color: colors.text,
        marginTop: 6,
        textAlign: "center",
        minHeight: 30,
    },
    winnerOptionNameSelected: {
        color: colors.primary,
        fontWeight: "bold",
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        minHeight: 150,
    },
    emptyMatches: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        marginVertical: 16,
    },
    emptyBracket: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 40,
        alignItems: 'center',
        marginVertical: 16,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textLight,
        marginTop: 12,
        textAlign: "center",
        lineHeight: 22,
    },
    matchListItem: {
        backgroundColor: colors.card,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    matchListItemCompleted: {
        backgroundColor: colors.background,
        borderColor: colors.border,
        opacity: 0.8,
    },
    matchListItemPlayable: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + "10",
    },
    matchListItemTBD: {
        backgroundColor: colors.card,
        borderColor: colors.border,
        opacity: 0.6,
    },
    matchListText: {
        fontSize: 15,
        color: colors.text,
        flex: 1,
        marginRight: 8,
    },
    matchListIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    viewDetailsText: {
        fontSize: 12,
        color: colors.primary,
        marginLeft: 8,
        fontWeight: '500',
    },
    tbdText: {
        fontSize: 12,
        color: colors.textLight,
        marginLeft: 8,
        fontStyle: 'italic',
    },
    notFound: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        backgroundColor: colors.background,
    },
    notFoundText: {
        fontSize: 18,
        color: colors.textLight,
        marginBottom: 20,
        textAlign: 'center',
    },
    startButton: {
        marginTop: 10,
    },
    roundRobinContainer: {
        marginTop: 10,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: colors.card,
    },
    standingsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginVertical: 10,
        marginHorizontal: 10,
    },
    standingsTable: {
        marginTop: 8,
        overflow: 'hidden',
    },
    standingsHeader: {
        flexDirection: 'row',
        backgroundColor: colors.background,
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    standingsHeaderCell: {
        flex: 1,
        color: colors.textLight,
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 12,
    },
    standingsRow: {
        flexDirection: 'row',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        alignItems: 'center',
    },
    standingsCell: {
        flex: 1,
        textAlign: 'center',
        fontSize: 14,
        color: colors.text,
    },
    standingsRowEven: {
        backgroundColor: colors.card,
    },
    standingsRowOdd: {
        backgroundColor: colors.card,
    },
    playerNameColumn: {
        flex: 3,
        textAlign: 'left',
    },
    playerNameCell: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    standingsPlayerName: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        flex: 1,
    },
    groupStandingsContainer: {
        marginTop: 16
    },
    groupSection: {
        marginBottom: 24,
        backgroundColor: colors.card,
        borderRadius: 12,
        overflow: 'hidden',
    },
    groupTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        padding: 12,
        backgroundColor: colors.background,
        color: colors.text,
    },
    generateKnockoutButton: {
        margin: 16,
    },
    roundMatches: {},
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    playerRowEven: {
        backgroundColor: colors.card
    },
    playerRowOdd: {
        backgroundColor: colors.card
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    playerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    playerRating: {
        fontSize: 14,
        color: colors.textLight,
    },
    playerStatsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    playerWinsText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
    },
    selectedPlayerRow: {
        backgroundColor: colors.primary + "20",
        borderColor: colors.primary,
        borderLeftWidth: 4,
    },
    radioCircle: {
        height: 24,
        width: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 16,
    },
    radioFilled: {
        height: 12,
        width: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    bottomMenu: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: 60,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.card,
    },
    menuItem: {
        flex: 1,
        alignItems: 'center',
    },
});
