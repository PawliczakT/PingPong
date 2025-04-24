import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors } from "@/constants/colors";
import { TournamentMatch } from "@/types";
import { usePlayerStore } from "@/store/playerStore";
import PlayerAvatar from "./PlayerAvatar";

type TournamentBracketProps = {
  matches: TournamentMatch[];
  onMatchPress?: (match: TournamentMatch) => void;
};

export default function TournamentBracket({
  matches,
  onMatchPress,
}: TournamentBracketProps) {
  const { getPlayerById } = usePlayerStore();
  
  // Group matches by round
  const matchesByRound: Record<number, TournamentMatch[]> = {};
  
  matches.forEach(match => {
    if (!matchesByRound[match.round]) {
      matchesByRound[match.round] = [];
    }
    matchesByRound[match.round].push(match);
  });
  
  // Sort rounds
  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b);
  
  const renderMatch = (match: TournamentMatch) => {
    const player1 = match.player1Id ? getPlayerById(match.player1Id) : null;
    const player2 = match.player2Id ? getPlayerById(match.player2Id) : null;
    
    const isCompleted = match.status === 'completed';
    const isPending = match.status === 'pending';
    
    return (
      <View 
        key={match.id}
        style={[
          styles.matchContainer,
          isPending && styles.pendingMatch,
          isCompleted && styles.completedMatch,
          match.player1Id === match.winner && styles.player1Winner,
          match.player2Id === match.winner && styles.player2Winner,
        ]}
        onTouchEnd={() => onMatchPress && onMatchPress(match)}
      >
        <View style={[
          styles.playerContainer,
          match.player1Id === match.winner && styles.winnerContainer
        ]}>
          {player1 ? (
            <>
              <PlayerAvatar name={player1.name} avatarUrl={player1.avatarUrl} size={24} />
              <Text style={[
                styles.playerName,
                match.player1Id === match.winner && styles.winnerName
              ]}>
                {player1.name}
              </Text>
            </>
          ) : (
            <Text style={styles.pendingText}>TBD</Text>
          )}
          
          {isCompleted && (
            <Text style={styles.scoreText}>{match.player1Score}</Text>
          )}
        </View>
        
        <View style={styles.separator} />
        
        <View style={[
          styles.playerContainer,
          match.player2Id === match.winner && styles.winnerContainer
        ]}>
          {player2 ? (
            <>
              <PlayerAvatar name={player2.name} avatarUrl={player2.avatarUrl} size={24} />
              <Text style={[
                styles.playerName,
                match.player2Id === match.winner && styles.winnerName
              ]}>
                {player2.name}
              </Text>
            </>
          ) : (
            <Text style={styles.pendingText}>TBD</Text>
          )}
          
          {isCompleted && (
            <Text style={styles.scoreText}>{match.player2Score}</Text>
          )}
        </View>
      </View>
    );
  };
  
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.container}>
        {rounds.map(round => (
          <View key={round} style={styles.roundContainer}>
            <Text style={styles.roundTitle}>
              {round === Math.max(...rounds) ? "Final" : round === Math.max(...rounds) - 1 ? "Semifinals" : `Round ${round}`}
            </Text>
            
            <View style={styles.matchesContainer}>
              {matchesByRound[round].map(match => renderMatch(match))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 16,
    minWidth: "100%",
  },
  roundContainer: {
    marginRight: 16,
    minWidth: 200,
  },
  roundTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  matchesContainer: {
    flex: 1,
  },
  matchContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  pendingMatch: {
    opacity: 0.6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  completedMatch: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  player1Winner: {
    borderLeftColor: colors.primary,
  },
  player2Winner: {
    borderLeftColor: colors.secondary,
  },
  playerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  winnerContainer: {
    backgroundColor: colors.highlight,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  playerName: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  winnerName: {
    fontWeight: "bold",
    color: colors.primary,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  pendingText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: "italic",
  },
});