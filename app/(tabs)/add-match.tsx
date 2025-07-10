//app/(tabs)/add-match.tsx
import React, {useEffect, useState} from "react";
import {Alert, Platform, ScrollView, StyleSheet, Text, View} from "react-native";
import {Link, useRouter} from "expo-router";
import {PlusCircle} from "lucide-react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import {useMatchStore} from "@/store/matchStore";
import {useNetworkStore} from "@/store/networkStore";
import {Player, Set} from "@/backend/types";
import PlayerSelector from "@/components/PlayerSelector";
import SetScoreInput from "@/components/SetScoreInput";
import Button from "@/components/Button";
import NetworkStatusBar from "@/components/NetworkStatusBar";
import * as Haptics from "expo-haptics";
import {useAuthStore} from "@/store/authStore";

export default function AddMatchScreen() {
    const router = useRouter();
    const {user} = useAuthStore(); // Get user from auth store
    const {getActivePlayersSortedByRating} = usePlayerStore();
    const {addMatch} = useMatchStore();
    const {isOnline, addPendingMatch} = useNetworkStore();

    const [player1, setPlayer1] = useState<Player | null>(null);
    const [player2, setPlayer2] = useState<Player | null>(null);
    const [sets, setSets] = useState<Set[]>([
        {player1Score: 0, player2Score: 0}
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const activePlayers = getActivePlayersSortedByRating();

    useEffect(() => {
        if (!user) return;
        if (activePlayers.length < 2) {
            Alert.alert(
                "Not Enough Players",
                "You need at least 2 players to record a match. Would you like to add players now?",
                [
                    {text: "Cancel", style: "cancel"},
                    {text: "Add Players", onPress: () => router.push("/player/create")}
                ]
            );
        }
    }, [activePlayers.length, user]);

    const addSet = () => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setSets([...sets, {player1Score: 0, player2Score: 0}]);
    };

    const updateSet = (index: number, updatedSet: Set) => {
        const newSets = [...sets];
        newSets[index] = updatedSet;
        setSets(newSets);
    };

    const removeSet = (index: number) => {
        if (sets.length <= 1) return;

        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        const newSets = [...sets];
        newSets.splice(index, 1);
        setSets(newSets);
    };

    const calculateFinalScore = () => {
        let player1Sets = 0;
        let player2Sets = 0;

        sets.forEach(set => {
            if (set.player1Score > set.player2Score) {
                player1Sets++;
            } else if (set.player2Score > set.player1Score) {
                player2Sets++;
            }
        });

        return {player1Sets, player2Sets};
    };

    const handleSubmit = async () => {
        if (!player1 || !player2) {
            Alert.alert("Error", "Please select both players");
            return;
        }

        const hasEmptySet = sets.some(set => set.player1Score === 0 && set.player2Score === 0);
        if (hasEmptySet) {
            Alert.alert("Error", "All sets must have scores");
            return;
        }

        const {player1Sets, player2Sets} = calculateFinalScore();

        if (player1Sets === player2Sets) {
            Alert.alert("Error", "Match must have a winner");
            return;
        }

        setIsSubmitting(true);

        try {
            if (isOnline) {
                await addMatch({
                    player1Id: player1.id,
                    player2Id: player2.id,
                    player1Score: player1Sets,
                    player2Score: player2Sets,
                    sets: sets,
                });
            } else {
                addPendingMatch({
                    id: `pending-${Date.now()}`,
                    player1Id: player1.id,
                    player2Id: player2.id,
                    player1Score: player1Sets,
                    player2Score: player2Sets,
                    sets,
                    createdAt: new Date().toISOString(),
                });
            }

            setPlayer1(null);
            setPlayer2(null);
            setSets([{player1Score: 0, player2Score: 0}]);

            if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            Alert.alert(
                "Success",
                isOnline
                    ? "Match recorded successfully"
                    : "Match saved locally and will be synced when online",
                [{text: "OK", onPress: () => router.replace("/(tabs)")}]
            );
        } catch (error) {
            Alert.alert("Error", "Failed to record match");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.container} edges={["bottom"]}>
                <View style={[styles.content, styles.centeredContent]}>
                    <Text style={styles.loginPromptText}>
                        Please log in to record a match.
                    </Text>
                    <Link href="/(auth)/login" asChild>
                        <Button
                            title="Log In"
                            style={styles.loginButton}
                            onPress={() => {
                            }}
                        />
                    </Link>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <NetworkStatusBar/>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={styles.title}>Record New Match</Text>

                    {!isOnline && (
                        <View style={styles.offlineWarning}>
                            <Text style={styles.offlineText}>
                                You're offline. The match will be saved locally and synced when you're back online.
                            </Text>
                        </View>
                    )}

                    <View style={styles.playersContainer}>
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

                    <View style={styles.setsContainer}>
                        <View style={styles.setsHeader}>
                            <Text style={styles.setsTitle}>Sets</Text>
                            <Button
                                title="Add Set"
                                variant="outline"
                                size="small"
                                icon={<PlusCircle size={16} color={colors.primary}/>}
                                onPress={addSet}
                            />
                        </View>

                        {sets.map((set, index) => (
                            <SetScoreInput
                                key={index}
                                setNumber={index + 1}
                                value={set}
                                onChange={(updatedSet) => updateSet(index, updatedSet)}
                                onDelete={sets.length > 1 ? () => removeSet(index) : undefined}
                            />
                        ))}
                    </View>

                    <View style={styles.summary}>
                        <Text style={styles.summaryTitle}>Match Summary</Text>

                        <View style={styles.summaryContent}>
                            {player1 && player2 ? (
                                <>
                                    <Text style={styles.summaryText}>
                                        {player1.name} vs {player2.name}
                                    </Text>

                                    <View style={styles.finalScore}>
                                        <Text style={styles.finalScoreText}>
                                            {calculateFinalScore().player1Sets} - {calculateFinalScore().player2Sets}
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <Text style={styles.placeholderText}>
                                    Select players and enter scores to see match summary
                                </Text>
                            )}
                        </View>
                    </View>

                    <Button
                        title={isOnline ? "Record Match" : "Save Match Offline"}
                        onPress={handleSubmit}
                        loading={isSubmitting}
                        disabled={!player1 || !player2}
                        style={styles.submitButton}
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
    content: {
        padding: 16,
    },
    centeredContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loginPromptText: {
        fontSize: 18,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    loginButton: {
        minWidth: 200,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 20,
    },
    offlineWarning: {
        backgroundColor: colors.warning + "20",
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    offlineText: {
        color: colors.warning,
        fontSize: 14,
    },
    playersContainer: {
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
    setsContainer: {
        marginBottom: 24,
    },
    setsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    setsTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
    },
    summary: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 12,
    },
    summaryContent: {
        alignItems: "center",
    },
    summaryText: {
        fontSize: 16,
        color: colors.text,
        marginBottom: 8,
    },
    finalScore: {
        backgroundColor: colors.primary + "20",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    finalScoreText: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.primary,
    },
    placeholderText: {
        fontSize: 14,
        color: colors.textLight,
        textAlign: "center",
        padding: 16,
    },
    submitButton: {
        marginBottom: 20,
    },
});
