import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Flame, Snowflake } from "lucide-react-native";
import { colors } from "@/constants/colors";

type StreakDisplayProps = {
    currentStreak: {
        wins: number;
        losses: number;
    };
    longestStreak: number;
    style?: ViewStyle;
};

export default function StreakDisplay({ currentStreak, longestStreak, style }: StreakDisplayProps) {
    const hasWinStreak = currentStreak?.wins > 0;
    const hasLossStreak = currentStreak?.losses > 0;

    if (!hasWinStreak && !hasLossStreak) {
        return null;
    }

    return (
        <View style={[styles.container, style]}>
            {hasWinStreak && (
                <View style={[styles.streakBadge, styles.winStreak]}>
                    <Flame size={16} color="#fff" />
                    <Text style={styles.streakText}>{currentStreak?.wins}</Text>
                </View>
            )}

            {hasLossStreak && (
                <View style={[styles.streakBadge, styles.lossStreak]}>
                    <Snowflake size={16} color="#fff" />
                    <Text style={styles.streakText}>{currentStreak.losses}</Text>
                </View>
            )}

            {longestStreak > 0 && (
                <View style={styles.longestContainer}>
                    <Text style={styles.longestText}>Najdłuższa seria: {longestStreak}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    streakBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    winStreak: {
        backgroundColor: colors.success,
    },
    lossStreak: {
        backgroundColor: colors.error,
    },
    streakText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 14,
        marginLeft: 4,
    },
    longestContainer: {
        marginLeft: 8,
    },
    longestText: {
        color: colors.textLight,
        fontSize: 12,
    },
});
