import React from "react";
import {Pressable, ScrollView, StyleSheet, Text, View} from "react-native";
import {colors} from "@/constants/colors";
import {Set as MatchSet, TournamentMatch, TournamentFormat} from "@/backend/types";
import {usePlayerStore} from "@/store/playerStore";
import PlayerAvatar from "./PlayerAvatar";

type TournamentBracketProps = {
    matches: TournamentMatch[];
    onMatchPress?: (match: TournamentMatch) => void;
    tournamentFormat?: TournamentFormat;
};

type TournamentMatchWithSets = TournamentMatch & { sets?: MatchSet[] };

function getUniqueMatches(matches: TournamentMatch[]): TournamentMatch[] {
    const seen = new Set();
    return matches.filter(match => {
        if (!match.id) return false;
        if (seen.has(match.id)) return false;
        seen.add(match.id);
        return true;
    });
}

export default function TournamentBracket({
                                              matches,
                                              onMatchPress,
                                              tournamentFormat,
                                          }: TournamentBracketProps) {
    const {getPlayerById} = usePlayerStore();
    const uniqueMatches = getUniqueMatches(matches);
    
    const isDoubleElimination = tournamentFormat === TournamentFormat.DOUBLE_ELIMINATION;
    
    let winnersRounds: TournamentMatch[][] = [];
    let losersRounds: TournamentMatch[][] = [];
    let grandFinalMatches: TournamentMatch[] = [];
    let rounds: TournamentMatch[][] = [];
    
    if (isDoubleElimination) {
        const winnersBracketMatches = uniqueMatches.filter(match => match.bracket === 'winners');
        const losersBracketMatches = uniqueMatches.filter(match => match.bracket === 'losers');
        grandFinalMatches = uniqueMatches.filter(match => match.bracket === 'grand_final');
        
        const winnersMatchesByRound: Record<number, TournamentMatch[]> = {};
        winnersBracketMatches.forEach(match => {
            if (!winnersMatchesByRound[match.round]) winnersMatchesByRound[match.round] = [];
            winnersMatchesByRound[match.round].push(match);
        });
        
        const losersMatchesByRound: Record<number, TournamentMatch[]> = {};
        losersBracketMatches.forEach(match => {
            if (!losersMatchesByRound[match.round]) losersMatchesByRound[match.round] = [];
            losersMatchesByRound[match.round].push(match);
        });
        
        winnersRounds = Object.keys(winnersMatchesByRound)
            .sort((a, b) => Number(a) - Number(b))
            .map(round => winnersMatchesByRound[Number(round)]);
            
        losersRounds = Object.keys(losersMatchesByRound)
            .sort((a, b) => Number(a) - Number(b))
            .map(round => losersMatchesByRound[Number(round)]);
    } else {
        const matchesByRound: Record<number, TournamentMatch[]> = {};
        uniqueMatches.forEach(match => {
            if (!matchesByRound[match.round]) matchesByRound[match.round] = [];
            matchesByRound[match.round].push(match);
        });
        rounds = Object.keys(matchesByRound)
            .sort((a, b) => Number(a) - Number(b))
            .map(round => matchesByRound[Number(round)]);
    }

    const renderMatch = (match: TournamentMatchWithSets) => {
        const player1 = match.player1Id ? getPlayerById(match.player1Id) : null;
        const player2 = match.player2Id ? getPlayerById(match.player2Id) : null;
        const isCompleted = match.status === 'completed';
        const isPending = match.status === 'pending';
        return (
            <Pressable
                key={`${match.id}-${match.round}-${match.matchNumber}`}
                style={[
                    styles.matchContainer,
                    isPending && styles.pendingMatch,
                    isCompleted && styles.completedMatch,
                    match.player1Id === match.winner && styles.player1Winner,
                    match.player2Id === match.winner && styles.player2Winner,
                ]}
                onPress={() => {
                    if (onMatchPress) {
                        onMatchPress(match);
                    }
                }}
            >
                <Pressable style={[
                    styles.playerContainer,
                    match.player1Id === match.winner && styles.winnerContainer
                ]}>
                    {player1 ? (
                        <>
                            <PlayerAvatar name={player1.name} avatarUrl={player1.avatarUrl} size={24}/>
                            <Text style={[
                                styles.playerName,
                                match.player1Id === match.winner && styles.winnerName
                            ]}>
                                {player1.name}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.pendingText}>TBD</Text>
                    )}

                    {isCompleted && (
                        <>
                            <Text style={styles.scoreText}>
                                {Array.isArray(match.sets) && match.sets.length > 0
                                    ? match.sets.reduce((sum: number, set: MatchSet) => sum + (set.player1Score || 0), 0)
                                    : match.player1Score !== undefined ? match.player1Score : 0}
                            </Text>
                            {Array.isArray(match.sets) && match.sets.length > 0 && (
                                <View style={styles.setsContainer}>
                                    {match.sets.map((set, index) => (
                                        <Text key={index} style={styles.setText}>
                                            {set.player1Score !== undefined ? set.player1Score : 0}-{set.player2Score !== undefined ? set.player2Score : 0}
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </>
                    )}
                </Pressable>
                <View style={styles.separator}/>
                <Pressable style={[
                    styles.playerContainer,
                    match.player2Id === match.winner && styles.winnerContainer
                ]}>
                    {player2 ? (
                        <>
                            <PlayerAvatar name={player2.name} avatarUrl={player2.avatarUrl} size={24}/>
                            <Text style={[
                                styles.playerName,
                                match.player2Id === match.winner && styles.winnerName
                            ]}>
                                {player2.name}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.pendingText}>TBD</Text>
                    )}
                    {isCompleted && (
                        <>
                            <Text style={styles.scoreText}>
                                {Array.isArray(match.sets) && match.sets.length > 0
                                    ? match.sets.reduce((sum: number, set: MatchSet) => sum + (set.player2Score || 0), 0)
                                    : match.player2Score !== undefined ? match.player2Score : 0}
                            </Text>
                            {Array.isArray(match.sets) && match.sets.length > 0 && (
                                <View style={styles.setsContainer}>
                                    {match.sets.map((set, index) => (
                                        <Text key={index} style={styles.setText}>
                                            {set.player1Score !== undefined ? set.player1Score : 0}-{set.player2Score !== undefined ? set.player2Score : 0}
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </>
                    )}
                </Pressable>
            </Pressable>
        );
    };

    const renderBracket = (bracketMatches: TournamentMatch[][], bracketTitle: string, bracketType: 'winners' | 'losers' | 'standard') => (
        <View style={styles.bracketContainer}>
            <Text style={[styles.bracketTitle, bracketType === 'losers' && styles.losersBracketTitle]}>
                {bracketTitle}
            </Text>
            <View style={styles.bracketRounds}>
                {bracketMatches.map((matchesInRound, i) => (
                    <View key={`${bracketType}-round-${i + 1}`} style={styles.roundContainer}>
                        <Text style={styles.roundTitle}>
                            {bracketType === 'winners' && i === bracketMatches.length - 1
                                ? "Winners Final"
                                : bracketType === 'losers' && i === bracketMatches.length - 1
                                    ? "Losers Final"
                                    : bracketType === 'standard' && i === bracketMatches.length - 1
                                        ? "Final"
                                        : bracketType === 'standard' && i === bracketMatches.length - 2
                                            ? "Semifinals"
                                            : `Round ${i + 1}`}
                        </Text>
                        <View style={styles.matchesContainer}>
                            {matchesInRound.map(match => renderMatch(match))}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.container}>
                {isDoubleElimination ? (
                    <>
                        {renderBracket(winnersRounds, "Winners Bracket", "winners")}
                        {renderBracket(losersRounds, "Losers Bracket", "losers")}
                        {grandFinalMatches.length > 0 && (
                            <View style={styles.bracketContainer}>
                                <Text style={styles.bracketTitle}>Grand Final</Text>
                                <View style={styles.bracketRounds}>
                                    <View style={styles.roundContainer}>
                                        <Text style={styles.roundTitle}>Championship</Text>
                                        <View style={styles.matchesContainer}>
                                            {grandFinalMatches.map(match => renderMatch(match))}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        )}
                    </>
                ) : (
                    renderBracket(rounds, "", "standard")
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "column",
        padding: 16,
        minWidth: "100%",
    },
    bracketContainer: {
        marginBottom: 24,
    },
    bracketTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.primary,
        marginBottom: 16,
        textAlign: "center",
    },
    losersBracketTitle: {
        color: colors.secondary,
    },
    bracketRounds: {
        flexDirection: "row",
    },
    roundContainer: {
        marginRight: 16,
        minWidth: 200,
    },
    roundTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 12,
        textAlign: "center",
    },
    matchesContainer: {
        flex: 1,
    },
    matchContainer: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    pendingMatch: {
        opacity: 0.6,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
    },
    completedMatch: {
        borderLeftWidth: 3,
        borderLeftColor: colors.success,
    },
    player1Winner: {
        borderLeftColor: colors.primary,
    },
    player2Winner: {
        borderLeftColor: colors.secondary,
    },
    playerContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
    },
    winnerContainer: {
        backgroundColor: colors.highlight,
        borderRadius: 4,
        paddingHorizontal: 4,
    },
    playerName: {
        fontSize: 14,
        color: colors.text,
        marginLeft: 8,
        flex: 1,
    },
    winnerName: {
        fontWeight: "bold",
        color: colors.primary,
    },
    scoreText: {
        fontSize: 14,
        fontWeight: "bold",
        marginLeft: 8,
    },
    setsContainer: {
        flexDirection: "column",
        alignItems: "flex-start",
        marginLeft: 8,
    },
    setText: {
        fontSize: 10,
        color: colors.textLight,
        marginVertical: 1,
    },
    separator: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
    },
    pendingText: {
        fontSize: 14,
        color: colors.textLight,
        fontStyle: "italic",
    },
});
