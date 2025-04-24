import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowUpDown, Users, Trophy, Award } from "lucide-react-native";
import { colors } from "@/constants/colors";
import { usePlayerStore } from "@/store/playerStore";
import { useStatsStore } from "@/store/statsStore";
import PlayerCard from "@/components/PlayerCard";
import StreakDisplay from "@/components/StreakDisplay";
import { Player } from "@/types";

export default function StatsScreen() {
  const router = useRouter();
  const { getActivePlayersSortedByRating } = usePlayerStore();
  const { getTopWinners, getTopWinRate, getLongestWinStreaks } = useStatsStore();
  
  const activePlayers = getActivePlayersSortedByRating();
  const topWinners = getTopWinners(5);
  const topWinRate = getTopWinRate(5);
  const longestStreaks = getLongestWinStreaks(5);
  
  const navigateToHeadToHead = () => {
    router.push("/stats/head-to-head");
  };
  
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Statistics</Text>
          
          <View style={styles.statsCards}>
            <TouchableOpacity 
              style={styles.statsCard}
              onPress={navigateToHeadToHead}
            >
              <View style={styles.statsCardIcon}>
                <ArrowUpDown size={24} color={colors.primary} />
              </View>
              <Text style={styles.statsCardTitle}>Head-to-Head</Text>
              <Text style={styles.statsCardDescription}>
                Compare stats between any two players
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statsCard}>
              <View style={styles.statsCardIcon}>
                <Users size={24} color={colors.primary} />
              </View>
              <Text style={styles.statsCardTitle}>Player Stats</Text>
              <Text style={styles.statsCardDescription}>
                Detailed statistics for all players
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statsCard}>
              <View style={styles.statsCardIcon}>
                <Trophy size={24} color={colors.primary} />
              </View>
              <Text style={styles.statsCardTitle}>Tournaments</Text>
              <Text style={styles.statsCardDescription}>
                Tournament results and statistics
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statsCard}>
              <View style={styles.statsCardIcon}>
                <Award size={24} color={colors.primary} />
              </View>
              <Text style={styles.statsCardTitle}>Achievements</Text>
              <Text style={styles.statsCardDescription}>
                View all unlocked achievements
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Rankings</Text>
            
            {activePlayers.slice(0, 5).map((player, index) => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                rank={index + 1}
                onPress={() => router.push(`/player/${player.id}`)}
              />
            ))}
            
            {activePlayers.length > 5 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => router.push("/players")}
              >
                <Text style={styles.viewAllText}>View All Rankings</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Winners</Text>
            
            {topWinners.map((player: Player, index: number) => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                statValue={player.wins || 0}
                statLabel="wins"
                onPress={() => router.push(`/player/${player.id}`)}
              />
            ))}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Best Win Rate</Text>
            
            {topWinRate.map((player: Player, index: number) => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                statValue={`${(player.stats?.winRate || 0).toFixed(1)}%`}
                statLabel="win rate"
                onPress={() => router.push(`/player/${player.id}`)}
              />
            ))}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Longest Win Streaks</Text>
            
            {longestStreaks.map((player: Player, index: number) => (
              <View key={player.id} style={styles.streakCard}>
                <PlayerCard 
                  player={player} 
                  onPress={() => router.push(`/player/${player.id}`)}
                />
                <StreakDisplay 
                  streak={player.stats?.longestWinStreak || 0}
                  type="win"
                  style={styles.streakDisplay}
                />
              </View>
            ))}
          </View>
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
  statsCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statsCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statsCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statsCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  statsCardDescription: {
    fontSize: 12,
    color: colors.textLight,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 12,
  },
  viewAllButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  streakCard: {
    marginBottom: 8,
  },
  streakDisplay: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: [{ translateY: -12 }],
  },
});