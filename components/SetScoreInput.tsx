import React from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {MinusCircle, PlusCircle} from "lucide-react-native";
import {colors} from "@/constants/colors";
import {Set} from "@/types";

type SetScoreInputProps = {
    setNumber: number;
    value: Set;
    onChange: (set: Set) => void;
    onDelete?: () => void;
};

export default function SetScoreInput({
                                          setNumber,
                                          value,
                                          onChange,
                                          onDelete,
                                      }: SetScoreInputProps) {
    const updateScore = (player: 1 | 2, increment: boolean) => {
        const newSet = {...value};

        if (player === 1) {
            newSet.player1Score = increment
                ? Math.min(newSet.player1Score + 1, 99)
                : Math.max(newSet.player1Score - 1, 0);
        } else {
            newSet.player2Score = increment
                ? Math.min(newSet.player2Score + 1, 99)
                : Math.max(newSet.player2Score - 1, 0);
        }

        onChange(newSet);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.setNumber}>Set {setNumber}</Text>
                {onDelete && (
                    <Pressable onPress={onDelete} style={styles.deleteButton}>
                        <MinusCircle
                            size={20}
                            color={colors.error}
                        />
                    </Pressable>
                )}
            </View>

            <View style={styles.scoreContainer}>
                <View style={styles.playerScore}>
                    <Pressable onPress={() => updateScore(1, false)}>
                        <MinusCircle
                            size={24}
                            color={colors.primary}
                        />
                    </Pressable>
                    <Text style={styles.scoreText}>{value.player1Score}</Text>
                    <Pressable onPress={() => updateScore(1, true)}>
                        <PlusCircle
                            size={24}
                            color={colors.primary}
                        />
                    </Pressable>
                </View>

                <Text style={styles.separator}>-</Text>

                <View style={styles.playerScore}>
                    <Pressable onPress={() => updateScore(2, false)}>
                        <MinusCircle
                            size={24}
                            color={colors.primary}
                        />
                    </Pressable>
                    <Text style={styles.scoreText}>{value.player2Score}</Text>
                    <Pressable onPress={() => updateScore(2, true)}>
                        <PlusCircle
                            size={24}
                            color={colors.primary}
                        />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,

        elevation: 1,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    setNumber: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
    },
    deleteButton: {
        padding: 4,
    },
    scoreContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    playerScore: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        justifyContent: "space-between",
    },
    scoreText: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        width: 40,
        textAlign: "center",
    },
    separator: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.textLight,
        marginHorizontal: 12,
    },
});
