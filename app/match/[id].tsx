//app/match/[id].tsx
import React from "react";
import {ScrollView, StyleSheet, Text, View} from "react-native";
import {Stack, useLocalSearchParams, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {useMatchStore} from "@/store/matchStore";
import {usePlayerStore} from "@/store/playerStore";
import {formatDateTime} from "@/utils/formatters";
import PlayerAvatar from "@/components/PlayerAvatar";
import Button from "@/components/Button";

export default function MatchDetailScreen() {
    const {id} = useLocalSearchParams();
    const router = useRouter();
    const {getMatchById} = useMatchStore();
    const {getPlayerById} = usePlayerStore();

    const match = getMatchById(id as string);

    if (!match) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{title: "Match Not Found"}}/>
                <View style={styles.notFound}>
                    <Text style={styles.notFoundText}>Match not found</Text>
                    <Button
                        title="Go Back"
                        onPress={() => router.back()}
                        variant="outline"
                    />
                </View>
            </SafeAreaView>
        );
    }

    const player1 = getPlayerById(match.player1Id);
    const player2 = getPlayerById(match.player2Id);

    if (!player1 || !player2) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{title: "Match Details"}}/>
                <View style={styles.notFound}>
                    <Text style={styles.notFoundText}>Player data not found</Text>
                    <Button
                        title="Go Back"
                        onPress={() => router.back()}
                        variant="outline"
                    />
                </View>
            </SafeAreaView>
        );
    }

    const isPlayer1Winner = match.winner === match.player1Id;

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <Stack.Screen
                options={{
                    title: "Match Details",
                    headerShadowVisible: false,
                    headerStyle: {
                        backgroundColor: colors.background,
                    },
                }}
            />

            <ScrollView>
                <View style={styles.header}>
                    <Text style={styles.date}>{formatDateTime(match.date)}</Text>

                    <View style={styles.matchupContainer}>
                        <View style={styles.playerContainer}>
                            <PlayerAvatar
                                name={player1.name}
                                avatarUrl={player1.avatarUrl}
                                size={80}
                            />
                            <Text style={[
                                styles.playerName,
                                isPlayer1Winner && styles.winnerName
                            ]}>
                                {player1.name}
                            </Text>
                            {player1.nickname && (
                                <Text style={styles.playerNickname}>"{player1.nickname}"</Text>
                            )}
                        </View>

                        <View style={styles.scoreContainer}>
                            <Text style={styles.vsText}>VS</Text>
                            <View style={styles.finalScore}>
                                <Text style={[
                                    styles.scoreValue,
                                    isPlayer1Winner && styles.winnerScore
                                ]}>
                                    {match.player1Score}
                                </Text>
                                <Text style={styles.scoreSeparator}>-</Text>
                                <Text style={[
                                    styles.scoreValue,
                                    !isPlayer1Winner && styles.winnerScore
                                ]}>
                                    {match.player2Score}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.playerContainer}>
                            <PlayerAvatar
                                name={player2.name}
                                avatarUrl={player2.avatarUrl}
                                size={80}
                            />
                            <Text style={[
                                styles.playerName,
                                !isPlayer1Winner && styles.winnerName
                            ]}>
                                {player2.name}
                            </Text>
                            {player2.nickname && (
                                <Text style={styles.playerNickname}>"{player2.nickname}"</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.resultBadge}>
                        <Text style={styles.resultText}>
                            {isPlayer1Winner ? player1.name : player2.name} won
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Set Details</Text>

                    {match.sets.map((set, index) => (
                        <View key={index} style={styles.setItem}>
                            <Text style={styles.setNumber}>Set {index + 1}</Text>
                            <View style={styles.setScore}>
                                <Text style={[
                                    styles.setScoreValue,
                                    set.player1Score > set.player2Score && styles.setWinnerScore
                                ]}>
                                    {set.player1Score}
                                </Text>
                                <Text style={styles.setScoreSeparator}>-</Text>
                                <Text style={[
                                    styles.setScoreValue,
                                    set.player2Score > set.player1Score && styles.setWinnerScore
                                ]}>
                                    {set.player2Score}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.actions}>
                    <Button
                        title="View Player 1 Profile"
                        variant="outline"
                        onPress={() => router.push(`/player/${player1.id}`)}
                        style={styles.actionButton}
                    />

                    <Button
                        title="View Player 2 Profile"
                        variant="outline"
                        onPress={() => router.push(`/player/${player2.id}`)}
                        style={styles.actionButton}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: 20,
        backgroundColor: colors.card,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        alignItems: "center",
    },
    date: {
        fontSize: 16,
        color: colors.textLight,
        marginBottom: 16,
    },
    matchupContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
    },
    playerContainer: {
        alignItems: "center",
        width: "35%",
    },
    playerName: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
        marginTop: 8,
        textAlign: "center",
    },
    playerNickname: {
        fontSize: 14,
        color: colors.textLight,
        textAlign: "center",
    },
    winnerName: {
        color: colors.primary,
    },
    scoreContainer: {
        alignItems: "center",
        width: "30%",
    },
    vsText: {
        fontSize: 16,
        color: colors.textLight,
        marginBottom: 8,
    },
    finalScore: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.background,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
    },
    scoreSeparator: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.textLight,
        marginHorizontal: 8,
    },
    winnerScore: {
        color: colors.primary,
    },
    resultBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 20,
    },
    resultText: {
        color: "#fff",
        fontWeight: "bold",
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 16,
    },
    setItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.card,
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    setNumber: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
    },
    setScore: {
        flexDirection: "row",
        alignItems: "center",
    },
    setScoreValue: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
    },
    setScoreSeparator: {
        fontSize: 18,
        color: colors.textLight,
        marginHorizontal: 8,
    },
    setWinnerScore: {
        color: colors.primary,
    },
    actions: {
        padding: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    actionButton: {
        flex: 1,
        marginHorizontal: 4,
    },
    notFound: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    notFoundText: {
        fontSize: 18,
        color: colors.textLight,
        marginBottom: 20,
    },
});
