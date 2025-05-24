import React, {useState} from "react";
import {Button, StyleSheet, Text, TextInput, View} from "react-native";
import {TournamentMatch} from "@/types";

interface TournamentMatchCardProps {
    match: TournamentMatch;
    onSaveResult: (player1Score: number, player2Score: number) => Promise<void>;
}

const TournamentMatchCard: React.FC<TournamentMatchCardProps> = ({match, onSaveResult}) => {
    const [score1, setScore1] = useState(match.player1Score !== undefined ? String(match.player1Score) : "");
    const [score2, setScore2] = useState(match.player2Score !== undefined ? String(match.player2Score) : "");
    const [loading, setLoading] = useState(false);

    const isCompleted = match.status === "completed";
    const canEnterResult = match.status === "scheduled" || match.status === "pending";

    const handleSave = async () => {
        setLoading(true);
        await onSaveResult(Number(score1), Number(score2));
        setLoading(false);
    };

    return (
        <View style={styles.card}>
            <Text>{match.player1Id ?? "TBD"} vs {match.player2Id ?? "TBD"}</Text>
            {isCompleted ? (
                <View style={styles.resultRow}>
                    <Text style={styles.scoreText}>{match.player1Score}</Text>
                    <Text>:</Text>
                    <Text style={styles.scoreText}>{match.player2Score}</Text>
                </View>
            ) : canEnterResult ? (
                <View>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            value={score1}
                            onChangeText={setScore1}
                            keyboardType="numeric"
                            placeholder="Player 1 Score"
                        />
                        <Text>:</Text>
                        <TextInput
                            style={styles.input}
                            value={score2}
                            onChangeText={setScore2}
                            keyboardType="numeric"
                            placeholder="Player 2 Score"
                        />
                    </View>
                    <Button
                        title={loading ? "Saving..." : "Save Score"}
                        onPress={handleSave}
                        disabled={loading || !score1 || !score2}
                    />
                </View>
            ) : (
                <Text style={{fontStyle: "italic"}}>Waiting for players...</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {padding: 12, margin: 8, borderWidth: 1, borderRadius: 8},
    inputRow: {flexDirection: "row", alignItems: "center", marginVertical: 8},
    input: {borderWidth: 1, borderRadius: 4, width: 40, marginHorizontal: 4, textAlign: "center"},
    resultRow: {flexDirection: "row", alignItems: "center", marginTop: 8},
    scoreText: {fontWeight: "bold", fontSize: 16, marginHorizontal: 4},
});

export default TournamentMatchCard;
