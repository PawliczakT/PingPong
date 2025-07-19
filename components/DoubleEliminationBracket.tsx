//components/DoubleEliminationBracket.tsx
import React from "react";
import {Pressable, ScrollView, StyleSheet, Text, View} from "react-native";
import {colors} from "@/constants/colors";
import {Set as MatchSet, TournamentMatch} from "@/backend/types";
import {usePlayerStore} from "@/store/playerStore";
import PlayerAvatar from "./PlayerAvatar";

type DoubleEliminationBracketProps = {
    matches: TournamentMatch[];
    onMatchPress?: (match: TournamentMatch) => void;
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

export default function DoubleEliminationBracket({
                                                     matches,
                                                     onMatchPress,
                                                 }: DoubleEliminationBracketProps) {
    const {getPlayerById} = usePlayerStore();
    const uniqueMatches = getUniqueMatches(matches);

    // Separate matches by bracket
    const winnersBracketMatches = uniqueMatches.filter(match => match.bracket === 'winners');
    const losersBracketMatches = uniqueMatches.filter(match => match.bracket === 'losers');
    const finalMatches = uniqueMatches.filter(match => match.bracket === 'final');

    // Group matches by round within each bracket
    const winnersByRound: Record<number, TournamentMatch[]> = {};
    const losersByRound: Record<number, TournamentMatch[]> = {};

    winnersBracketMatches.forEach(match => {
        if (!winnersByRound[match.round]) winnersByRound[match.round] = [];
        winnersByRound[match.round].push(match);
    });

    losersBracketMatches.forEach(match => {
        if (!losersByRound[match.round]) losersByRound[match.round] = [];
        losersByRound[match.round].push(match);
    });

    // Sort rounds
    const winnersRounds = Object.keys(winnersByRound)
        .sort((a, b) => Number(a) - Number(b))
        .map(round => winnersByRound[Number(round)]);

    const losersRounds = Object.keys(losersByRound)
        .sort((a, b) => Number(a) - Number(b))
        .map(round => losersByRound[Number(round)]);

    const renderMatch = (match: TournamentMatchWithSets) => {
        const player1 = match.player1Id ? getPlayerById(match.player1Id) : null;
        const player2 = match.player2Id ? getPlayerById(match.player2Id) : null;
        const isCompleted = match.status === 'completed';
        const isPending = match.status === 'pending';

        const bracketColor = match.bracket === 'winners'
            ? colors.primary
            : match.bracket === 'losers'
                ? colors.secondary
                : colors.success;

        return (
            <Pressable
                key={`${match.id}-${match.round}-${match.matchNumber}`}
                style={[
                    styles.matchContainer,
                    isPending && styles.pendingMatch,
                    isCompleted && styles.completedMatch,
                    match.player1Id === match.winner && styles.player1Winner,
                    match.player2Id === match.winner && styles.player2Winner,
                    {borderLeftColor: bracketColor}
                ]}
                onPress={() => {
                    if (onMatchPress) {
                        onMatchPress(match);
                    }
                }}
            >
                <View style={styles.bracketIndicator}>
                    <Text style={[styles.bracketText, {color: bracketColor}]}>
                        {match.bracket === 'winners' ? 'W' : match.bracket === 'losers' ? 'L' : 'F'}
                    </Text>
                </View>

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

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.container}>
                {/* Winners Bracket */}
                <View style={styles.bracketSection}>
                    <Text style={styles.bracketTitle}>Winners Bracket</Text>
                    <View style={styles.roundsContainer}>
                        {winnersRounds.map((matchesInRound, i) => (
                            <View key={`winners-round-${i + 1}`} style={styles.roundContainer}>
                                <Text style={styles.roundTitle}>
                                    {i === winnersRounds.length - 1
                                        ? "Finals"
                                        : i === winnersRounds.length - 2
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

                {/* Finals */}
                {finalMatches.length > 0 && (
                    <View style={styles.bracketSection}>
                        <Text style={styles.bracketTitle}>Grand Finals</Text>
                        <View style={styles.roundsContainer}>
                            <View style={styles.roundContainer}>
                                <View style={styles.matchesContainer}>
                                    {finalMatches.map(match => renderMatch(match))}
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Losers Bracket */}
                <View style={styles.bracketSection}>
                    <Text style={styles.bracketTitle}>Losers Bracket</Text>
                    <View style={styles.roundsContainer}>
                        {losersRounds.map((matchesInRound, i) => (
                            <View key={`losers-round-${i + 1}`} style={styles.roundContainer}>
                                <Text style={styles.roundTitle}>
                                    {i === losersRounds.length - 1
                                        ? "Finals"
                                        : i === losersRounds.length - 2
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
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        minWidth: "100%",
    },
    bracketSection: {
        marginBottom: 24,
    },
    bracketTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 12,
        textAlign: "left",
        paddingHorizontal: 8,
        borderBottomWidth: 2,
        borderBottomColor: colors.border,
        paddingBottom: 4,
    },
    roundsContainer: {
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
        borderLeftWidth: 3,
    },
    bracketIndicator: {
        position: "absolute",
        top: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    bracketText: {
        fontSize: 12,
        fontWeight: "bold",
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
