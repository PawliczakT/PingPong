import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { PlusCircle } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { usePlayerStore } from "@/store/playerStore";
import { useTournamentStore } from "@/store/tournamentStore";
import { Set } from "@/types";
import SetScoreInput from "@/components/SetScoreInput";
import Button from "@/components/Button";
import PlayerAvatar from "@/components/PlayerAvatar";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function RecordTournamentMatchScreen() {
  const { tournamentId, matchId, player1Id, player2Id } = useLocalSearchParams();
  const router = useRouter();
  const { getPlayerById } = usePlayerStore();
  const { updateMatchResult } = useTournamentStore();
  
  const [sets, setSets] = useState<Set[]>([
    { player1Score: 0, player2Score: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const player1 = getPlayerById(player1Id as string);
  const player2 = getPlayerById(player2Id as string);
  
  useEffect(() => {
    if (!player1 || !player2) {
      Alert.alert(
        "Error",
        "Player information not found",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  }, [player1, player2]);
  
  const addSet = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSets([...sets, { player1Score: 0, player2Score: 0 }]);
  };
  
  const updateSet = (index: number, updatedSet: Set) => {
    const newSets = [...sets];
    newSets[index] = updatedSet;
    setSets(newSets);
  };
  
  const removeSet = (index: number) => {
    if (sets.length <= 1) return;
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    const newSets = [...sets];
    newSets.splice(index, 1);
    setSets(newSets);
  };
  
  const calculateFinalScore = () => {
    let player1Sets = 0;
    let player2Sets = 0;
    
    sets.forEach(set => {
      if (set.player1Score > set.player2Score) {
        player1Sets++;
      } else if (set.player2Score > set.player1Score) {
        player2Sets++;
      }
    });
    
    return { player1Sets, player2Sets };
  };
  
  const handleSubmit = async () => {
    if (!player1 || !player2) {
      Alert.alert("Error", "Player information not found");
      return;
    }
    
    const hasEmptySet = sets.some(set => set.player1Score === 0 && set.player2Score === 0);
    if (hasEmptySet) {
      Alert.alert("Error", "All sets must have scores");
      return;
    }
    
    const { player1Sets, player2Sets } = calculateFinalScore();
    
    if (player1Sets === player2Sets) {
      Alert.alert("Error", "Match must have a winner");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log("handleSubmit: Calling updateMatchResult...");
      await updateMatchResult(
        tournamentId as string,
        matchId as string,
        {
          player1Score: player1Sets,
          player2Score: player2Sets,
          sets,
        }
      );
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert(
        "Success",
        "Match recorded successfully",
        [{ text: "OK", onPress: () => router.push(`/tournament/${tournamentId}`) }]
      );
    } catch (error) {
      console.error("handleSubmit: Error during updateMatchResult:", error);
      Alert.alert("Error", "Failed to record match");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!player1 || !player2) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Record Tournament Match" }} />
        <View style={styles.loading}>
          <Text>Loading player information...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen 
        options={{ 
          title: "Record Tournament Match",
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }} 
      />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Tournament Match</Text>
          
          <View style={styles.playersContainer}>
            <View style={styles.playerInfo}>
              <PlayerAvatar name={player1.name} avatarUrl={player1.avatarUrl} size={60} />
              <Text style={styles.playerName}>{player1.name}</Text>
            </View>
            
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            
            <View style={styles.playerInfo}>
              <PlayerAvatar name={player2.name} avatarUrl={player2.avatarUrl} size={60} />
              <Text style={styles.playerName}>{player2.name}</Text>
            </View>
          </View>
          
          <View style={styles.setsContainer}>
            <View style={styles.setsHeader}>
              <Text style={styles.setsTitle}>Sets</Text>
              <Button
                title="Add Set"
                variant="outline"
                size="small"
                icon={<PlusCircle size={16} color={colors.primary} />}
                onPress={addSet}
              />
            </View>
            
            {sets.map((set, index) => (
              <SetScoreInput
                key={index}
                setNumber={index + 1}
                value={set}
                onChange={(updatedSet) => updateSet(index, updatedSet)}
                onDelete={sets.length > 1 ? () => removeSet(index) : undefined}
              />
            ))}
          </View>
          
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Match Summary</Text>
            
            <View style={styles.summaryContent}>
              <Text style={styles.summaryText}>
                {player1.name} vs {player2.name}
              </Text>
              
              <View style={styles.finalScore}>
                <Text style={styles.finalScoreText}>
                  {calculateFinalScore().player1Sets} - {calculateFinalScore().player2Sets}
                </Text>
              </View>
            </View>
          </View>
          
          <Button
            title="Record Match"
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.submitButton}
          />
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
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  playersContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  playerInfo: {
    alignItems: "center",
    width: "40%",
  },
  playerName: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginTop: 8,
    textAlign: "center",
  },
  vsContainer: {
    width: "20%",
    alignItems: "center",
  },
  vsText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textLight,
  },
  setsContainer: {
    marginBottom: 24,
  },
  setsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  setsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
  },
  summary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 12,
  },
  summaryContent: {
    alignItems: "center",
  },
  summaryText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  finalScore: {
    backgroundColor: colors.primary + "20",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  finalScoreText: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
  },
  submitButton: {
    marginBottom: 20,
  },
});