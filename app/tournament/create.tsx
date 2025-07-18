//app/tournament/create.tsx
import React, {useState} from "react";
import {Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View} from "react-native";
import {Stack, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {Calendar, Users} from "lucide-react-native";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import {useTournamentStore} from "@/store/tournamentStore";
import {TournamentFormat} from "@/backend/types";
import Button from "@/components/Button";
import PlayerAvatar from "@/components/PlayerAvatar";
import * as Haptics from "expo-haptics";

export default function CreateTournamentScreen() {
    const router = useRouter();
    const {getActivePlayersSortedByRating} = usePlayerStore();
    const {createTournament} = useTournamentStore();

    const [name, setName] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [format, setFormat] = useState<TournamentFormat>(TournamentFormat.KNOCKOUT);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const activePlayers = getActivePlayersSortedByRating();

    const togglePlayerSelection = (playerId: string) => {
        if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((e) =>
                console.error("Haptics error:", e));
        }

        setSelectedPlayerIds(prev =>
            prev.includes(playerId)
                ? prev.filter(id => id !== playerId)
                : [...prev, playerId]
        );
    };

    const handleSubmit = async () => {
        if (selectedPlayerIds.length < 2) {
            Alert.alert("Error", "At least 2 players are required");
            return;
        }

        if (format === TournamentFormat.KNOCKOUT && selectedPlayerIds.length % 4 !== 0) {
            Alert.alert("Error", "Knockout tournaments require a number of players divisible by 4");
            return;
        }

        if (format === TournamentFormat.DOUBLE_ELIMINATION && selectedPlayerIds.length < 4) {
            Alert.alert("Error", "Double Elimination tournaments require at least 4 players");
            return;
        }

        setIsSubmitting(true);

        try {
            await createTournament(
                name.trim(),
                new Date(date).toISOString(),
                format,
                selectedPlayerIds
            );

            if (Platform.OS !== "web") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            Alert.alert(
                "Success",
                "Tournament created successfully",
                [{text: "OK", onPress: () => router.push("/tournaments")}]
            );
        } catch (error) {
            Alert.alert("Error", "Failed to create tournament");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <Stack.Screen
                options={{
                    title: "Create Tournament",
                    headerShadowVisible: false,
                    headerStyle: {
                        backgroundColor: colors.background,
                    },
                }}
            />

            <ScrollView style={styles.content}>
                <Text style={styles.label}>Tournament Name</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter tournament name (or leave empty for auto-generated name)"
                    value={name}
                    onChangeText={setName}
                />

                <Text style={styles.label}>Date *</Text>
                <View style={styles.dateInputContainer}>
                    <Calendar size={20} color={colors.textLight}/>
                    <TextInput
                        style={styles.dateInput}
                        placeholder="YYYY-MM-DD"
                        value={date}
                        onChangeText={setDate}
                        keyboardType="numbers-and-punctuation"
                    />
                </View>

                <Text style={styles.label}>Format *</Text>
                <View style={styles.formatOptions}>
                    <Button
                        title="Knockout"
                        variant={format === TournamentFormat.KNOCKOUT ? "primary" : "outline"}
                        size="small"
                        onPress={() => setFormat(TournamentFormat.KNOCKOUT)}
                        style={styles.formatButton}
                    />

                    <Button
                        title="Round Robin"
                        variant={format === TournamentFormat.ROUND_ROBIN ? "primary" : "outline"}
                        size="small"
                        onPress={() => setFormat(TournamentFormat.ROUND_ROBIN)}
                        style={styles.formatButton}
                    />

                    <Button
                        title="Double Elimination"
                        variant={format === TournamentFormat.DOUBLE_ELIMINATION ? "primary" : "outline"}
                        size="small"
                        onPress={() => setFormat(TournamentFormat.DOUBLE_ELIMINATION)}
                        style={styles.formatButton}
                    />
                </View>

                <View style={styles.participantsSection}>
                    <View style={styles.participantsHeader}>
                        <Text style={styles.label}>Select Participants *</Text>
                        <Text style={styles.selectedCount}>
                            {selectedPlayerIds.length} selected
                        </Text>
                    </View>

                    {activePlayers.length > 0 ? (
                        <View style={styles.playersList}>
                            {activePlayers.map(player => (
                                <View
                                    key={player.id}
                                    style={[
                                        styles.playerItem,
                                        selectedPlayerIds.includes(player.id) && styles.playerItemSelected
                                    ]}
                                >
                                    <Button
                                        title={player.name}
                                        variant={selectedPlayerIds.includes(player.id) ? "primary" : "outline"}
                                        size="small"
                                        onPress={() => togglePlayerSelection(player.id)}
                                        icon={
                                            <PlayerAvatar
                                                name={player.name}
                                                avatarUrl={player.avatarUrl}
                                                size={24}
                                            />
                                        }
                                        style={styles.playerButton}
                                    />
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.noPlayers}>
                            <Users size={40} color={colors.textLight}/>
                            <Text style={styles.noPlayersText}>No players available</Text>
                            <Button
                                title="Add Player"
                                variant="outline"
                                size="small"
                                onPress={() => router.push("/player/create")}
                                style={styles.addPlayerButton}
                            />
                        </View>
                    )}
                </View>

                <Button
                    title="Create Tournament"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={selectedPlayerIds.length < 2 || 
                        (format === TournamentFormat.KNOCKOUT && selectedPlayerIds.length % 4 !== 0) ||
                        (format === TournamentFormat.DOUBLE_ELIMINATION && selectedPlayerIds.length < 4)}
                    style={styles.submitButton}
                />
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
    label: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 16,
        color: colors.text,
    },
    dateInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    dateInput: {
        flex: 1,
        padding: 12,
        fontSize: 16,
        color: colors.text,
        marginLeft: 8,
    },
    formatOptions: {
        flexDirection: "row",
        marginBottom: 24,
    },
    formatButton: {
        flex: 1,
        marginRight: 8,
    },
    participantsSection: {
        marginBottom: 24,
    },
    participantsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    selectedCount: {
        fontSize: 14,
        color: colors.textLight,
    },
    playersList: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    playerItem: {
        width: "48%",
        marginBottom: 8,
        marginRight: "2%",
    },
    playerItemSelected: {
        opacity: 1,
    },
    playerButton: {
        width: "100%",
    },
    noPlayers: {
        alignItems: "center",
        padding: 20,
        backgroundColor: colors.card,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    noPlayersText: {
        fontSize: 16,
        color: colors.textLight,
        marginVertical: 12,
    },
    addPlayerButton: {
        marginTop: 8,
    },
    submitButton: {
        marginBottom: 20,
    },
});
