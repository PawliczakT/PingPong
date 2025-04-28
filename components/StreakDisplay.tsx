import React from "react";
import {StyleSheet, Text, View, ViewStyle} from "react-native";
import {Flame, Snowflake} from "lucide-react-native";
import {colors} from "@/constants/colors";

type StreakDisplayProps = {
    currentStreak?: {
        wins: number;
        losses: number;
    };
    longestStreak?: number;
    style?: ViewStyle;
};

export default function StreakDisplay({
                                          currentStreak,
                                          longestStreak,
                                          style
                                      }: StreakDisplayProps) {

    const hasWinStreak = (currentStreak?.wins ?? 0) > 0;
    const hasLossStreak = (currentStreak?.losses ?? 0) > 0;
    const hasLongestStreak = (longestStreak ?? 0) > 0;

    if (!hasWinStreak && !hasLossStreak && !hasLongestStreak) {
        return null;
    }

    return (
        <View style={[styles.container, style]}>
            {hasWinStreak && currentStreak && (
                <View style={[styles.streakBadge, styles.winStreak]}>
                    <Flame size={16} color="#fff"/>
                    <Text style={styles.streakText}>{currentStreak.wins}</Text>
                </View>
            )}
            {hasLossStreak && currentStreak && (
                <View style={[styles.streakBadge, styles.lossStreak]}>
                    <Snowflake size={16} color="#fff"/>
                    <Text style={styles.streakText}>{currentStreak.losses}</Text>
                </View>
            )}
            {hasLongestStreak && (
                <View
                    style={[styles.longestContainer, (hasWinStreak || hasLossStreak) && styles.longestContainerMargin]}>
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
    },
    streakBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
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
    longestContainer: {},
    longestContainerMargin: {
        marginLeft: 4,
    },
    longestText: {
        color: colors.textLight,
        fontSize: 12,
    },
});
