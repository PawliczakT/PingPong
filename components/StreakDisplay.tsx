import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Flame, Snowflake } from "lucide-react-native";
import { colors } from "@/constants/colors";

type StreakDisplayProps = {
  streak: number;
  type: "win" | "loss";
  style?: ViewStyle;
};

export default function StreakDisplay({ streak, type, style }: StreakDisplayProps) {
  if (streak <= 0) {
    return null;
  }

  return (
    <View style={[styles.container, type === "win" ? styles.winStreak : styles.lossStreak, style]}>
      {type === "win" ? (
        <Flame size={16} color="#fff" />
      ) : (
        <Snowflake size={16} color="#fff" />
      )}
      <Text style={styles.streakText}>{streak}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
});