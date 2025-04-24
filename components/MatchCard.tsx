import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import PlayerAvatar from "./PlayerAvatar";
import { Match } from "@/types";
import { colors } from "@/constants/colors";
import { formatDate } from "@/utils/formatters";
import { usePlayerStore } from "@/store/playerStore";

type MatchCardProps = {
  match: Match;
  onPress?: () => void;
};

export default function MatchCard({ match, onPress }: MatchCardProps) {
  const router = useRouter();
  const { getPlayerById } = usePlayerStore();
  
  const player1 = getPlayerById(match.player1Id);
  const player2 = getPlayerById(match.player2Id);
  
  if (!player1 || !player2) {
    return null;
  }
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/match/${match.id}`);
    }
  };

  const isPlayer1Winner = match.winner === match.player1Id;
  
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
      onPress={handlePress}
    >
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{formatDate(match.date)}</Text>
      </View>
      
      <View style={styles.matchContainer}>
        <View style={styles.playerContainer}>
          <PlayerAvatar name={player1.name} avatarUrl={player1.avatarUrl} size={40} />
          <Text style={[
            styles.playerName,
            isPlayer1Winner && styles.winnerName
          ]}>
            {player1.name}
          </Text>
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>
            {match.player1Score} - {match.player2Score}
          </Text>
        </View>
        
        <View style={styles.playerContainer}>
          <PlayerAvatar name={player2.name} avatarUrl={player2.avatarUrl} size={40} />
          <Text style={[
            styles.playerName,
            !isPlayer1Winner && styles.winnerName
          ]}>
            {player2.name}
          </Text>
        </View>
      </View>
      
      <ArrowRight size={20} color={colors.textLight} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: colors.highlight,
  },
  dateContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    color: colors.textLight,
  },
  matchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerContainer: {
    alignItems: "center",
    width: "40%",
  },
  playerName: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
    color: colors.text,
  },
  winnerName: {
    fontWeight: "bold",
    color: colors.primary,
  },
  scoreContainer: {
    width: "20%",
    alignItems: "center",
  },
  scoreText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
  },
});