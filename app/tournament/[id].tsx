import React, { useState, useEffect } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
Alert,
Pressable,
Platform, // Added Platform import
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons'; // Add this import
import {
Calendar,
// Clock, // Not used
Play,
Plus, // Keep if manual add match is re-introduced
Trophy,
Users,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { colors } from "@/constants/colors";
import { useTournamentStore } from "@/store/tournamentStore";
import { usePlayerStore } from "@/store/playerStore";
import { useMatchStore } from "@/store/matchStore"; // Assuming getMatchById is needed for match details navigation
import { TournamentStatus, TournamentMatch, Player } from "@/types"; // Added Player type
import { formatDate } from "@/utils/formatters";
import Button from "@/components/Button";
import PlayerAvatar from "@/components/PlayerAvatar";
import TournamentBracket from "@/components/TournamentBracket";

// Component Definition
export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const {
    getTournamentById,
    updateTournamentStatus,
    setTournamentWinner,
    // updateTournamentMatch, // Not used directly here
  } = useTournamentStore();

  const { getPlayerById } = usePlayerStore();
  const { getMatchById } = useMatchStore(); // Keep if navigating to general match details

  const tournament = getTournamentById(id as string);
  const getTournamentMatches = useTournamentStore(state => state.getTournamentMatches);
  const tournamentMatches = tournament ? getTournamentMatches(tournament.id) : [];

// Utility: Group matches by round for bracket rendering
function groupMatchesByRound(matches: TournamentMatch[]): TournamentMatch[][] {
  if (!matches || matches.length === 0) return [];
  const grouped: { [round: number]: TournamentMatch[] } = {};
  matches.forEach(match => {
    if (!grouped[match.round]) grouped[match.round] = [];
    grouped[match.round].push(match);
  });
  // Sort rounds numerically
  return Object.keys(grouped)
    .sort((a, b) => Number(a) - Number(b))
    .map(round => grouped[Number(round)]);
}

const bracketRounds = groupMatchesByRound(tournamentMatches);

  // Funkcja filtrująca duplikaty po matchId
  function getUniqueMatches(matches: TournamentMatch[]): TournamentMatch[] {
    const seen = new Set();
    return matches.filter(match => {
      if (!match.matchId) return false;
      if (seen.has(match.matchId)) return false;
      seen.add(match.matchId);
      return true;
    });
  }

  // --- AUTO ADVANCE TO KNOCKOUT ---
  const generateTournamentMatches = useTournamentStore(state => state.generateTournamentMatches);
  useEffect(() => {
    if (!tournament) return;
    const groupMatches = tournamentMatches.filter(m => m.round === 1);
    const allGroupCompleted = groupMatches.length > 0 && groupMatches.every(m => m.status === 'completed');
    const hasKnockout = tournamentMatches.some(m => m.round > 1);

    console.log('[KO] allGroupCompleted:', allGroupCompleted, 'hasKnockout:', hasKnockout, 'tournamentId:', tournament.id);

    if (allGroupCompleted && !hasKnockout) {
      (async () => {
        try {
          await generateTournamentMatches(tournament.id);
          // Wymuś odświeżenie turniejów po wygenerowaniu knockout
          const { fetchTournamentsFromSupabase } = require('@/store/tournamentStore');
          await fetchTournamentsFromSupabase();
          console.log('[KO] Knockout phase generated and tournaments refreshed');
          // Powiadom użytkownika w UI
          Alert.alert('Faza pucharowa', 'Automatycznie utworzono fazę pucharową!');
        } catch (err) {
          console.error('[KO] Error generating knockout:', err);
        }
      })();
    }
  }, [tournamentMatches, tournament]);



const [showConfirmStart, setShowConfirmStart] = useState(false);
const [showConfirmComplete, setShowConfirmComplete] = useState(false);
const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<"bracket" | "matches" | "players">(
  "bracket"
);

// Reset confirmation states if tournament status changes externally
useEffect(() => {
    setShowConfirmStart(false);
    setShowConfirmComplete(false);
    setSelectedWinnerId(null); // Reset winner selection if status changes
}, [tournament?.status]);

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
  .map((pId) => getPlayerById(pId))
  .filter((player): player is Player => player !== undefined); // Type guard for filtering

const handleStartTournament = async () => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  if (showConfirmStart) {
    try {
      // Add validation: Check if there are enough participants (e.g., at least 2)
      if (participants.length < 2) {
           Alert.alert("Cannot Start", "At least two participants are required to start the tournament.");
           setShowConfirmStart(false); // Hide confirmation
           return;
      }
      await updateTournamentStatus(tournament.id, 'active');
      // No need to set showConfirmStart to false here, useEffect handles it
      Alert.alert("Success", "Tournament started successfully");
    } catch (error) {
      console.error("Failed to start tournament:", error); // Log error
      Alert.alert("Error", "Failed to start tournament. Please try again.");
      setShowConfirmStart(false); // Hide confirmation on error
    }
  } else {
    setShowConfirmStart(true);
  }
};

const handleCompleteTournament = async () => {
  if (!selectedWinnerId) {
    // This check is primarily for the final confirmation step
    Alert.alert("Error", "Please select a winner before confirming.");
    return;
  }

  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  // The button press now first shows the selection (showConfirmComplete=true)
  // Then, the "Confirm Winner & Complete" button calls this function again
  if (showConfirmComplete) {
      try {
          await setTournamentWinner(tournament.id, selectedWinnerId);
          // Status might be automatically updated by setTournamentWinner, or update manually:
          // await updateTournamentStatus(tournament.id, 'completed');
          // No need to set showConfirmComplete to false here, useEffect handles it
          Alert.alert("Success", "Tournament completed successfully");
      } catch (error) {
          console.error("Failed to complete tournament:", error); // Log error
          Alert.alert("Error", "Failed to complete tournament. Please try again.");
          // Optionally hide confirmation on error: setShowConfirmComplete(false);
      }
  } else {
      // This case shouldn't be reached if using the toggle approach below
      console.warn("handleCompleteTournament called unexpectedly when showConfirmComplete is false");
  }
};

// Toggle winner selection visibility
const toggleWinnerSelection = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Check if all matches are completed before allowing completion
    const allMatchesCompleted = tournamentMatches.every(match => (match.status as 'completed' | 'pending' | 'scheduled') === 'completed');
    if (!allMatchesCompleted && tournamentMatches.length > 0) {
        Alert.alert("Cannot Complete", "All matches must be completed before selecting a winner.");
        return;
    }
    // If already showing, hide it. Otherwise, show it and switch to players tab.
    if (showConfirmComplete) {
        setShowConfirmComplete(false);
    } else {
        setShowConfirmComplete(true);
        setActiveTab("players"); // Switch to players tab to show selection
        setSelectedWinnerId(null); // Reset selection when opening
    }
};

const handleMatchPress = (match: TournamentMatch) => {
  if ((match.status as 'completed' | 'pending' | 'scheduled') === 'completed') {
    Alert.alert('Mecz zakończony', 'Nie możesz już rozegrać ani edytować tego meczu.');
    return;
  }
  if (match.status === "scheduled" && match.player1Id && match.player2Id) {
    router.push({
      pathname: "/tournament/record-match",
      params: {
        tournamentId: tournament.id,
        matchId: match.id,
        player1Id: match.player1Id,
        player2Id: match.player2Id,
      },
    });
    return;
  }
  if ((match.status as 'completed' | 'pending' | 'scheduled') === 'completed' && match.matchId) {
    router.push(`/match/${match.matchId}`);
    return;
  }
  let message = "This match cannot be played or viewed yet.";
  if (match.status === 'scheduled' && (!match.player1Id || !match.player2Id)) {
    message = "Waiting for players from previous rounds.";
  }
  Alert.alert("Match Info", message);
};

const getStatusColor = () => {
  switch (tournament.status) {
    case 'pending':
      return colors.primary; // Use primary color for upcoming
    case 'active':
      return colors.warning;
    case 'completed':
      return colors.success;
    default:
      return colors.textLight; // Or a default color like gray
  }
};

const getStatusText = () => {
  switch (tournament.status) {
    case 'pending':
      return "Upcoming";
    case 'active':
      return "In Progress";
    case 'completed':
      return "Completed";
    default:
      return "Unknown";
  }
};

const winner = tournament.winner ? getPlayerById(tournament.winner) : null;

return (
  <SafeAreaView style={styles.container} edges={["bottom"]}>
    <Stack.Screen
      options={{
        title: tournament.name,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.card, // Use card color for header
        },
        headerTitleStyle: {
           color: colors.text, // Ensure title color contrasts with background
        },
        headerTintColor: colors.primary, // Color for back button
      }}
    />

    <ScrollView>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{tournament.name}</Text>
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

        {/* Winner Display - Only if completed and winner exists */}
        {tournament.status === 'completed' && winner && (
          <View style={styles.winnerContainer}>
            <Text style={styles.winnerLabel}>Tournament Winner</Text>
            <View style={styles.winnerContent}>
              <Trophy size={24} color={colors.success} />
              <Text style={styles.winnerName}>
                {winner.name || "Unknown"}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {tournament.status === 'pending' && (
          <Button
            title={showConfirmStart ? "Confirm Start?" : "Start Tournament"}
            variant={showConfirmStart ? "primary" : "primary"} // Use primary for confirm
            icon={<Play size={16} color={"#fff"} />} // White icon always for primary
            onPress={handleStartTournament}
            style={styles.actionButton}
          />
        )}

        {tournament.status === 'active' && (
           // Show Complete button only when IN_PROGRESS
          <Button
            title={showConfirmComplete ? "Cancel Completion" : "Complete Tournament"}
            variant={showConfirmComplete ? "secondary" : "outline"} // Secondary to cancel, outline to initiate
            icon={<Trophy size={16} color={showConfirmComplete ? "#fff" : colors.primary} />}
            onPress={toggleWinnerSelection} // Use toggle function
            style={styles.actionButton}
          />
        )}
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "bracket" && styles.activeTab]}
          onPress={() => setActiveTab("bracket")}
        >
          <Text style={[styles.tabText, activeTab === "bracket" && styles.activeTabText]}>
            Bracket
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "matches" && styles.activeTab]}
          onPress={() => setActiveTab("matches")}
        >
          <Text style={[styles.tabText, activeTab === "matches" && styles.activeTabText]}>
            Matches
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "players" && styles.activeTab]}
          onPress={() => setActiveTab("players")}
        >
          <Text style={[styles.tabText, activeTab === "players" && styles.activeTabText]}>
            Players
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      {activeTab === "bracket" && (
        <View style={styles.section}>
          {(() => {
            // Add logging here
            console.log("--- Tournament Bracket Data ---");
            console.log("Grouped bracketRounds:", JSON.stringify(bracketRounds, null, 2));
            const flatMatches = bracketRounds.flat();
            console.log("Flat matches passed to component:", JSON.stringify(flatMatches, null, 2));
            console.log("bracketRounds.length > 0:", bracketRounds.length > 0);
            console.log("flatMatches.length:", flatMatches.length);
            console.log("--- End Bracket Data ---");

            if (bracketRounds.length > 0) {
              return (
                <TournamentBracket
                    matches={flatMatches} // Use the logged flatMatches
                    onMatchPress={handleMatchPress} 
                   />
              );
            } else {
              return (
                <View style={[styles.emptyStateContainer, styles.emptyBracket]}>
                  <Ionicons name="trophy-outline" size={48} color={colors.textLight} />
                  <Text style={styles.emptyText}>
                    {tournament.status === 'pending' ? 'Start the tournament to generate the bracket.' : 'No matches generated yet.'}
                  </Text>
                </View>
              );
            }
          })()}
        </View>
      )}

      {activeTab === "matches" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match List</Text>
          {tournamentMatches.length === 0 ? (
             <View style={styles.emptyMatches}>
               <Users size={40} color={colors.textLight} />
               <Text style={styles.emptyText}>
                 {tournament.status === 'pending' ? "Matches will appear here once the tournament starts." : "No matches available for this tournament."}
               </Text>
             </View>
          ) : (
            tournamentMatches.map((match) => {
              const player1 = match.player1Id ? getPlayerById(match.player1Id) : null;
              const player2 = match.player2Id ? getPlayerById(match.player2Id) : null;
              const isCompleted = match.status === 'completed';
              const isScheduled = match.status === 'scheduled';
              const canPlay = isScheduled && player1 && player2;
              const isTBD = isScheduled && (!player1 || !player2);

              // Wyświetlanie wyniku completed
              let display = `Round ${match.round}: ${player1?.name ?? 'TBD'} vs ${player2?.name ?? 'TBD'}`;
              if (isCompleted && match.player1Score != null && match.player2Score != null) {
                // Show set-based sum if available, otherwise fallback to summary score
                let player1SetSum = Array.isArray(match.sets) && match.sets.length > 0 ? match.sets.reduce((sum, set) => sum + (set.player1Score || 0), 0) : match.player1Score;
                let player2SetSum = Array.isArray(match.sets) && match.sets.length > 0 ? match.sets.reduce((sum, set) => sum + (set.player2Score || 0), 0) : match.player2Score;
                display = `${player1?.name ?? 'TBD'} (${player1SetSum}) vs ${player2?.name ?? 'TBD'} (${player2SetSum})`;
              }

              return (
                <Pressable
                  key={match.id}
                  style={[
                      styles.matchListItem,
                      isCompleted && styles.matchListItemCompleted,
                      canPlay && styles.matchListItemPlayable, // Style for playable matches
                      isTBD && styles.matchListItemTBD, // Style for TBD matches
                  ]}
                  // Zablokuj edycję completed, pozwól na wejście tylko do szczegółów completed (jeśli match.matchId)
                  onPress={() => {
                    if (isCompleted) {
                      if (match.matchId) {
                        router.push(`/match/${match.matchId}`);
                      } else {
                        Alert.alert('Mecz zakończony', 'Nie możesz już rozegrać ani edytować tego meczu.');
                      }
                      return;
                    }
                    if (canPlay) {
                      handleMatchPress(match);
                      return;
                    }
                    if (isTBD) {
                      Alert.alert('Mecz niedostępny', 'Czekaj na rozstrzygnięcie poprzednich rund.');
                      return;
                    }
                  }}
                  disabled={isCompleted} // Zablokuj completed całkowicie
                >
                  <Text style={[styles.matchListText, isCompleted && { opacity: 0.7 }]} numberOfLines={1} ellipsizeMode="tail">{display}</Text>
                  <View style={styles.matchListIcons}>
                      {canPlay && <Play size={18} color={colors.primary} style={{ marginLeft: 8 }} />}
                      {isCompleted && <Text style={styles.viewDetailsText}>Wynik</Text>}
                      {isTBD && <Text style={styles.tbdText}>TBD</Text>}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {activeTab === "players" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
          {participants.length > 0 ? (
            <View style={styles.participantsList}>
              {participants.map((player) => (
                <View key={player.id} style={styles.participantItem}>
                  <PlayerAvatar player={player} name={player.name} size={60} />
                  <Text style={styles.participantName} numberOfLines={2}>
                    {player.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyMatches}>
               <Users size={40} color={colors.textLight} />
              <Text style={styles.emptyText}>No participants have been added to this tournament yet.</Text>
               {/* Optionally add button to add participants if status is UPCOMING */}
               {tournament.status === 'pending' && (
                  <Button title="Add Participants" onPress={() => router.push(`/tournament/edit/${tournament.id}`)} variant="outline" style={{marginTop: 16}} />
               )}
            </View>
          )}

          {/* Winner Selection - Shown when Complete button is pressed */}
          {showConfirmComplete && tournament.status === 'active' && (
            <View style={styles.winnerSelectionContainer}>
              <Text style={styles.sectionTitle}>Select Tournament Winner</Text>
              {participants.length > 0 ? (
                  <View style={styles.winnerSelection}>
                  {participants.map((player) => (
                      <Pressable
                      key={player.id}
                      style={[
                          styles.winnerOption,
                          selectedWinnerId === player.id && styles.winnerOptionSelected,
                      ]}
                      onPress={() => setSelectedWinnerId(player.id)}
                      >
                      <PlayerAvatar player={player} name={player.name} size={50} />
                      <Text
                          style={[
                          styles.winnerOptionName,
                          selectedWinnerId === player.id && styles.winnerOptionNameSelected,
                          ]}
                          numberOfLines={2}
                      >
                          {player.name}
                      </Text>
                      </Pressable>
                  ))}
                  </View>
              ) : (
                  <Text style={styles.emptyText}>No participants to select from.</Text>
              )}
              <Button
                title="Confirm Winner & Complete"
                onPress={handleCompleteTournament} // Calls the confirmation logic
                disabled={!selectedWinnerId}
                variant="primary" // Use primary variant for final confirmation
                style={{ marginTop: 16 }}
              />
               {/* Cancel button moved to header */}
            </View>
          )}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16, 
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    flex: 1, 
    marginRight: 8, 
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16, 
  },
  statusText: {
    color: "#fff", 
    fontSize: 12, 
    fontWeight: "bold",
    textTransform: 'uppercase', 
  },
  infoContainer: {
    flexDirection: "row",
    flexWrap: "wrap", 
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
    marginLeft: 6, 
  },
  winnerContainer: {
    alignItems: "center",
    marginVertical: 16,
    backgroundColor: colors.success + "1A", 
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success + "40",
  },
  winnerLabel: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 4, 
    fontWeight: '600',
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
    marginTop: 16, 
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.card, 
    paddingHorizontal: 8, 
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14, 
    alignItems: "center",
    borderBottomWidth: 3, 
    borderBottomColor: "transparent", 
    marginHorizontal: 4, 
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
    flex: 1, 
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
    marginHorizontal: -8, 
  },
  participantItem: {
    width: "33.33%", 
    alignItems: "center",
    marginBottom: 20, 
    paddingHorizontal: 8, 
  },
  participantName: {
    fontSize: 13, 
    color: colors.text,
    marginTop: 6, 
    textAlign: "center",
    minHeight: 30, 
  },
  winnerSelectionContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  winnerSelection: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8, 
  },
  winnerOption: {
    width: "33.33%", 
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 8, 
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent', 
  },
  winnerOptionSelected: {
    backgroundColor: colors.primary + "20", 
    borderColor: colors.primary, 
  },
  winnerOptionName: {
    fontSize: 13,
    color: colors.text,
    marginTop: 6,
    textAlign: "center",
    minHeight: 30, 
  },
  winnerOptionNameSelected: {
    color: colors.primary,
    fontWeight: "bold",
  },
  emptyStateContainer: { 
    flex: 1, 
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    minHeight: 150, 
  },
  emptyMatches: { 
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginVertical: 16,
  },
  emptyBracket: { 
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 40, 
    alignItems: 'center',
    marginVertical: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
    marginTop: 12, 
    textAlign: "center",
    lineHeight: 22,
  },
  matchListItem: {
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchListItemCompleted: {
    backgroundColor: colors.background, 
    borderColor: colors.border, 
    opacity: 0.8,
  },
  matchListItemPlayable: {
    borderColor: colors.primary, 
    backgroundColor: colors.primary + "10", 
  },
  matchListItemTBD: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    opacity: 0.6, 
  },
  matchListText: {
    fontSize: 15,
    color: colors.text,
    flex: 1, 
    marginRight: 8, 
  },
  matchListIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '500',
  },
  tbdText: {
    fontSize: 12,
    color: colors.textLight,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.background, 
  },
  notFoundText: {
    fontSize: 18,
    color: colors.textLight, 
    marginBottom: 20,
    textAlign: 'center',
  },
});