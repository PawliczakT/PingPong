import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, Clock, Play, Plus, Trophy, Users } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { useTournamentStore } from "@/store/tournamentStore";
import { usePlayerStore } from "@/store/playerStore";
import { useMatchStore } from "@/store/matchStore";
import { TournamentStatus, TournamentMatch } from "@/types";
import { formatDate } from "@/utils/formatters";
import Button from "@/components/Button";
import PlayerAvatar from "@/components/PlayerAvatar";
import MatchCard from "@/components/MatchCard";
import TournamentBracket from "@/components/TournamentBracket";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getTournamentById, updateTournamentStatus, setTournamentWinner, getTournamentMatches, updateTournamentMatch } = useTournamentStore();
  const { getPlayerById } = usePlayerStore();
  const { getMatchById } = useMatchStore();
  
  const tournament = getTournamentById(id as string);
  
  const [showConfirmStart, setShowConfirmStart] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"bracket" | "matches" | "players">("bracket");
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  
  if (!tournament) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Tournament Not Found" }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Tournament not found</Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="outline"
          />
        </View>
      </SafeAreaView>
    );
  }
  
  const participants = tournament.participants
    .map(id => getPlayerById(id))
    .filter(player => player !== undefined);
  
  const matches = tournament.matches
    .map(id => getMatchById(id))
    .filter(match => match !== undefined);
  
  const tournamentMatches = getTournamentMatches(tournament.id);
  
  const handleStartTournament = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (showConfirmStart) {
      try {
        await updateTournamentStatus(tournament.id, TournamentStatus.IN_PROGRESS);
        setShowConfirmStart(false);
        Alert.alert("Success", "Tournament started successfully");
      } catch (error) {
        Alert.alert("Error", "Failed to start tournament");
      }
    } else {
      setShowConfirmStart(true);
    }
  };
  
  const handleCompleteTournament = async () => {
    if (!selectedWinnerId) {
      Alert.alert("Error", "Please select a winner");
      return;
    }
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (showConfirmComplete) {
      try {
        await setTournamentWinner(tournament.id, selectedWinnerId);
        setShowConfirmComplete(false);
        Alert.alert("Success", "Tournament completed successfully");
      } catch (error) {
        Alert.alert("Error", "Failed to complete tournament");
      }
    } else {
      setShowConfirmComplete(true);
    }
  };
  
  const handleMatchPress = (match: TournamentMatch) => {
    if (match.status === 'scheduled') {
      setSelectedMatch(match);
      
      // Navigate to record match screen
      if (match.player1Id && match.player2Id) {
        router.push({
          pathname: "/tournament/record-match",
          params: {
            tournamentId: tournament.id,
            matchId: match.id,
            player1Id: match.player1Id,
            player2Id: match.player2Id,
          }
        });
      }
    } else if (match.matchId) {
      // Navigate to match details
      router.push(`/match/${match.matchId}`);
    }
  };
  
  const getStatusColor = () => {
    switch (tournament.status) {
      case TournamentStatus.UPCOMING:
        return colors.primary;
      case TournamentStatus.IN_PROGRESS:
        return colors.warning;
      case TournamentStatus.COMPLETED:
        return colors.success;
      default:
        return colors.textLight;
    }
  };
  
  const getStatusText = () => {
    switch (tournament.status) {
      case TournamentStatus.UPCOMING:
        return "Upcoming";
      case TournamentStatus.IN_PROGRESS:
        return "In Progress";
      case TournamentStatus.COMPLETED:
        return "Completed";
      default:
        return "";
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen 
        options={{ 
          title: tournament.name,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }} 
      />
      
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{tournament.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>
          </View>
          
          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <Calendar size={16} color={colors.textLight} />
              <Text style={styles.infoText}>{formatDate(tournament.date)}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Users size={16} color={colors.textLight} />
              <Text style={styles.infoText}>{participants.length} players</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Trophy size={16} color={colors.textLight} />
              <Text style={styles.infoText}>{tournament.format}</Text>
            </View>
          </View>
          
          {tournament.winner && (
            <View style={styles.winnerContainer}>
              <Text style={styles.winnerLabel}>Winner</Text>
              <View style={styles.winnerContent}>
                <Trophy size={24} color={colors.success} />
                <Text style={styles.winnerName}>
                  {getPlayerById(tournament.winner)?.name || "Unknown"}
                </Text>
              </View>
            </View>
          )}
          
          {tournament.status === TournamentStatus.UPCOMING && (
            <Button
              title={showConfirmStart ? "Confirm Start" : "Start Tournament"}
              variant={showConfirmStart ? "primary" : "outline"}
              icon={<Play size={16} color={showConfirmStart ? "#fff" : colors.primary} />}
              onPress={handleStartTournament}
              style={styles.actionButton}
            />
          )}
          
          {tournament.status === TournamentStatus.IN_PROGRESS && (
            <View style={styles.actions}>
              <Button
                title="Add Match"
                variant="outline"
                icon={<Plus size={16} color={colors.primary} />}
                onPress={() => router.push("/add-match")}
                style={[styles.actionButton, { flex: 1, marginRight: 8 }]}
              />
              
              <Button
                title={showConfirmComplete ? "Confirm Complete" : "Complete"}
                variant={showConfirmComplete ? "primary" : "outline"}
                icon={<Trophy size={16} color={showConfirmComplete ? "#fff" : colors.primary} />}
                onPress={handleCompleteTournament}
                style={[styles.actionButton, { flex: 1 }]}
              />
            </View>
          )}
        </View>
        
        <View style={styles.tabs}>
          <Pressable
            style={[
              styles.tab,
              activeTab === "bracket" && styles.activeTab
            ]}
            onPress={() => setActiveTab("bracket")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "bracket" && styles.activeTabText
              ]}
            >
              Bracket
            </Text>
          </Pressable>
          
          <Pressable
            style={[
              styles.tab,
              activeTab === "matches" && styles.activeTab
            ]}
            onPress={() => setActiveTab("matches")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "matches" && styles.activeTabText
              ]}
            >
              Matches
            </Text>
          </Pressable>
          
          <Pressable
            style={[
              styles.tab,
              activeTab === "players" && styles.activeTab
            ]}
            onPress={() => setActiveTab("players")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "players" && styles.activeTabText
              ]}
            >
              Players
            </Text>
          </Pressable>
        </View>
        
        {activeTab === "bracket" && (
          <View style={styles.section}>
            {tournament.status === TournamentStatus.UPCOMING ? (
              <View style={styles.emptyBracket}>
                <Text style={styles.emptyText}>
                  Tournament bracket will be available once the tournament starts
                </Text>
              </View>
            ) : tournamentMatches.length > 0 ? (
              <TournamentBracket 
                matches={tournamentMatches} 
                onMatchPress={handleMatchPress}
              />
            ) : (
              <View style={styles.emptyBracket}>
                <Text style={styles.emptyText}>No bracket available</Text>
              </View>
            )}
          </View>
        )}
        
        {activeTab === "matches" && (
          <View style={styles.section}>
            {matches.length > 0 ? (
              matches.map(match => match && (
                <MatchCard key={match.id} match={match} />
              ))
            ) : (
              <View style={styles.emptyMatches}>
                <Text style={styles.emptyText}>No matches recorded yet</Text>
                {tournament.status === TournamentStatus.IN_PROGRESS && (
                  <Button
                    title="Add Match"
                    variant="outline"
                    size="small"
                    icon={<Plus size={16} color={colors.primary} />}
                    onPress={() => router.push("/add-match")}
                    style={styles.addMatchButton}
                  />
                )}
              </View>
            )}
          </View>
        )}
        
        {activeTab === "players" && (
          <View style={styles.section}>
            {tournament.status === TournamentStatus.IN_PROGRESS && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Winner</Text>
                <View style={styles.winnerSelection}>
                  {participants.map(player => player && (
                    <Pressable
                      key={player.id}
                      style={[
                        styles.winnerOption,
                        selectedWinnerId === player.id && styles.winnerOptionSelected
                      ]}
                      onPress={() => setSelectedWinnerId(player.id)}
                    >
                      <PlayerAvatar 
                        name={player.name} 
                        avatarUrl={player.avatarUrl} 
                        size={40} 
                      />
                      <Text style={[
                        styles.winnerOptionName,
                        selectedWinnerId === player.id && styles.winnerOptionNameSelected
                      ]}>
                        {player.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            
            <Text style={styles.sectionTitle}>Participants</Text>
            <View style={styles.participantsList}>
              {participants.map(player => player && (
                <Pressable
                  key={player.id}
                  style={styles.participantItem}
                  onPress={() => router.push(`/player/${player.id}`)}
                >
                  <PlayerAvatar 
                    name={player.name} 
                    avatarUrl={player.avatarUrl} 
                    size={40} 
                  />
                  <Text style={styles.participantName}>{player.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.card,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  infoContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textLight,
    marginLeft: 4,
  },
  winnerContainer: {
    alignItems: "center",
    marginVertical: 16,
    backgroundColor: colors.success + "20",
    padding: 12,
    borderRadius: 12,
  },
  winnerLabel: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 8,
  },
  winnerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  winnerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.success,
    marginLeft: 8,
  },
  actionButton: {
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    marginTop: 8,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: colors.textLight,
    fontWeight: "500",
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: "bold",
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 16,
  },
  participantsList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  participantItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 16,
  },
  participantName: {
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
    textAlign: "center",
  },
  winnerSelection: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  winnerOption: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 16,
    padding: 8,
    borderRadius: 8,
  },
  winnerOptionSelected: {
    backgroundColor: colors.primary + "20",
  },
  winnerOptionName: {
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
    textAlign: "center",
  },
  winnerOptionNameSelected: {
    color: colors.primary,
    fontWeight: "bold",
  },
  emptyMatches: {
    padding: 20,
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  emptyBracket: {
    padding: 40,
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: 12,
    textAlign: "center",
  },
  addMatchButton: {
    marginTop: 8,
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  notFoundText: {
    fontSize: 18,
    color: colors.textLight,
    marginBottom: 20,
  },
});