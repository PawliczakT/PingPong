import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { colors } from "@/constants/colors";
import { Achievement, AchievementProgress, AchievementType } from "@/types";
import AchievementBadge from "./AchievementBadge";
import { achievements } from "@/constants/achievements";

type AchievementsListProps = {
  playerAchievements: AchievementProgress[];
  onPress?: (achievement: Achievement) => void;
  showLocked?: boolean;
};

export default function AchievementsList({
  playerAchievements,
  onPress,
  showLocked = true,
}: AchievementsListProps) {
  // Combine achievement definitions with player progress
  const achievementsWithProgress = achievements.map(achievement => {
    const progress = playerAchievements.find(pa => pa.type === achievement.type);
    return {
      ...achievement,
      progress: progress?.progress || 0,
      unlocked: progress?.unlocked || false,
      unlockedAt: progress?.unlockedAt || null,
    };
  });
  
  // Filter achievements based on showLocked
  const filteredAchievements = showLocked 
    ? achievementsWithProgress 
    : achievementsWithProgress.filter(a => a.unlocked);
  
  // Sort achievements: unlocked first, then by type
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return a.type.localeCompare(b.type);
  });
  
  const renderAchievement = ({ item }: { item: Achievement & { progress: number, unlocked: boolean } }) => (
    <Pressable
      style={styles.achievementItem}
      onPress={() => onPress && onPress(item)}
    >
      <AchievementBadge 
        achievement={item} 
        unlocked={item.unlocked} 
        progress={item.progress}
        showProgress={!item.unlocked}
      />
      <Text style={[
        styles.achievementName,
        !item.unlocked && styles.lockedText
      ]}>
        {item.name}
      </Text>
    </Pressable>
  );
  
  return (
    <View style={styles.container}>
      {sortedAchievements.length > 0 ? (
        <FlatList
          data={sortedAchievements}
          renderItem={renderAchievement}
          keyExtractor={item => item.type}
          numColumns={3}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No achievements yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  achievementItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 16,
  },
  achievementName: {
    fontSize: 12,
    color: colors.text,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  lockedText: {
    color: colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
  },
});