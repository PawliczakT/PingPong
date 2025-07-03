import React, {useState} from "react";
import {ActivityIndicator, Button, StyleSheet, Text, TextInput, View} from "react-native";
import {TournamentMatch} from "@/backend/types";
import {colors} from "@/constants/colors";

interface TournamentMatchCardProps {
    match: TournamentMatch & { isUpdating?: boolean };
    onSaveResult: (player1Score: number, player2Score: number) => Promise<void>;
}

const TournamentMatchCard: React.FC<TournamentMatchCardProps> = ({match, onSaveResult}) => {
    const [score1, setScore1] = useState(match.player1Score !== undefined ? String(match.player1Score) : "");
    const [score2, setScore2] = useState(match.player2Score !== undefined ? String(match.player2Score) : "");

    const isCompleted = match.status === "completed";
    const canEnterResult = match.status === "scheduled" || match.status === "pending";

    const handleSave = async () => {
        await onSaveResult(Number(score1), Number(score2));
    };

    return (
        <View style={styles.card}>
            <Text style={styles.matchTitle}>{match.player1Id ?? "TBD"} vs {match.player2Id ?? "TBD"}</Text>
            {isCompleted ? (
                <View>
                    <View style={styles.resultRow}>
                        <Text style={styles.scoreText}>{match.player1Score}</Text>
                        <Text>:</Text>
                        <Text style={styles.scoreText}>{match.player2Score}</Text>
                    </View>
                    {match.sets && Array.isArray(match.sets) && match.sets.length > 0 && (
                        <View style={styles.setsContainer}>
                            <Text style={styles.setsLabel}>Sets:</Text>
                            <View style={styles.setsList}>
                                {match.sets.map((set, index) => (
                                    <Text key={index} style={styles.setText}>
                                        {set.player1Score !== undefined ? set.player1Score : 0}-{set.player2Score !== undefined ? set.player2Score : 0}
                                    </Text>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            ) : canEnterResult ? (
                <View>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            value={score1}
                            onChangeText={setScore1}
                            keyboardType="numeric"
                            placeholder="P1"
                        />
                        <Text>:</Text>
                        <TextInput
                            style={styles.input}
                            value={score2}
                            onChangeText={setScore2}
                            keyboardType="numeric"
                            placeholder="P2"
                        />
                    </View>
                    <View style={styles.buttonContainer}>
                        <Button
                            title="Save Score"
                            onPress={handleSave}
                            disabled={match.isUpdating || !score1 || !score2}
                        />
                        {match.isUpdating && <ActivityIndicator style={{marginLeft: 8}}/>}
                    </View>
                </View>
            ) : (
                <Text style={{fontStyle: "italic"}}>Waiting for players...</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {padding: 12, margin: 8, borderWidth: 1, borderRadius: 8, borderColor: colors.border},
    matchTitle: {fontSize: 16, fontWeight: "500", marginBottom: 8},
    inputRow: {flexDirection: "row", alignItems: "center", marginVertical: 8},
    input: {
        borderWidth: 1,
        borderRadius: 4,
        width: 40,
        marginHorizontal: 4,
        textAlign: "center",
        borderColor: colors.border
    },
    resultRow: {flexDirection: "row", alignItems: "center", marginTop: 8},
    scoreText: {fontWeight: "bold", fontSize: 16, marginHorizontal: 4},
    setsContainer: {marginTop: 8},
    setsLabel: {fontSize: 12, color: colors.textLight, marginBottom: 2},
    setsList: {flexDirection: "row", flexWrap: "wrap"},
    setText: {fontSize: 12, color: colors.textLight, marginRight: 8},
    buttonContainer: {flexDirection: 'row', alignItems: 'center'},
});

export default TournamentMatchCard;
