//app/stats/head-to-head.tsx
import React, {useState} from "react";
import {ScrollView, StyleSheet, Text, View} from "react-native";
import {Stack, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import {useStatsStore} from "@/store/statsStore";
import PlayerSelector from "@/components/PlayerSelector";
import HeadToHeadStats from "@/components/HeadToHeadStats";
import MatchCard from "@/components/MatchCard";
import Button from "@/components/Button";
import {Player} from "@/backend/types";

export default function HeadToHeadScreen() {
    const router = useRouter();
    const {getActivePlayersSortedByRating} = usePlayerStore();
    const {getDetailedHeadToHead} = useStatsStore();

    const [player1, setPlayer1] = useState<Player | null>(null);
    const [player2, setPlayer2] = useState<Player | null>(null);

    const activePlayers = getActivePlayersSortedByRating();

    const headToHead = player1 && player2
        ? getDetailedHeadToHead(player1.id, player2.id)
        : null;

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <Stack.Screen
                options={{
                    title: "Head-to-Head Stats",
                    headerShadowVisible: false,
                    headerStyle: {
                        backgroundColor: colors.background,
                    },
                }}
            />

            <ScrollView>
                <View style={styles.content}>
                    <Text style={styles.title}>Compare Players</Text>

                    <View style={styles.selectionContainer}>
                        <PlayerSelector
                            label="Player 1"
                            value={player1}
                            players={activePlayers}
                            onChange={(selectedPlayer: Player) => setPlayer1(selectedPlayer)}
                            excludePlayerId={player2?.id}
                        />

                        <View style={styles.vsContainer}>
                            <Text style={styles.vsText}>VS</Text>
                        </View>

                        <PlayerSelector
                            label="Player 2"
                            value={player2}
                            players={activePlayers}
                            onChange={(selectedPlayer: Player) => setPlayer2(selectedPlayer)}
                            excludePlayerId={player1?.id}
                        />
                    </View>

                    {headToHead ? (
                        <>
                            <HeadToHeadStats headToHead={headToHead}/>

                            <Text style={styles.sectionTitle}>Match History</Text>

                            {headToHead.matches.length > 0 ? (
                                headToHead.matches.map(match => (
                                    <MatchCard key={match.id} match={match}/>
                                ))
                            ) : (
                                <View style={styles.emptyMatches}>
                                    <Text style={styles.emptyText}>No matches between these players</Text>
                                    <Button
                                        title="Record a Match"
                                        variant="outline"
                                        onPress={() => router.push("/add-match")}
                                        style={styles.recordButton}
                                    />
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderText}>
                                Select two players to see their head-to-head statistics
                            </Text>
                        </View>
                    )}
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
    content: {
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 20,
    },
    selectionContainer: {
        marginBottom: 24,
    },
    vsContainer: {
        alignItems: "center",
        marginVertical: 8,
    },
    vsText: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.textLight,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
        marginTop: 16,
        marginBottom: 12,
    },
    placeholder: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 24,
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 16,
    },
    placeholderText: {
        fontSize: 16,
        color: colors.textLight,
        textAlign: "center",
    },
    emptyMatches: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 16,
        color: colors.textLight,
        marginBottom: 16,
    },
    recordButton: {
        minWidth: 150,
    },
});
