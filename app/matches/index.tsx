import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Plus, Search, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { useMatchStore } from "@/store/matchStore";
import { usePlayerStore } from "@/store/playerStore";
import MatchCard from "@/components/MatchCard";
import EmptyState from "@/components/EmptyState";
import Button from "@/components/Button";

export default function MatchesScreen() {
  const router = useRouter();
  const { matches } = useMatchStore();
  const { getPlayerById } = usePlayerStore();
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredMatches = matches.filter(match => {
    if (!searchQuery) return true;
    
    const player1 = getPlayerById(match.player1Id);
    const player2 = getPlayerById(match.player2Id);
    
    if (!player1 || !player2) return false;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      player1.name.toLowerCase().includes(searchLower) ||
      player2.name.toLowerCase().includes(searchLower) ||
      (player1.nickname && player1.nickname.toLowerCase().includes(searchLower)) ||
      (player2.nickname && player2.nickname.toLowerCase().includes(searchLower))
    );
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen 
        options={{ 
          title: "Match History",
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }} 
      />
      
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search matches..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <X size={18} color={colors.textLight} />
            </Pressable>
          )}
        </View>
        
        <Button
          title="New Match"
          onPress={() => router.push("/add-match")}
          icon={<Plus size={18} color="#fff" />}
          size="small"
        />
      </View>
      
      {matches.length > 0 ? (
        <FlatList
          data={filteredMatches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MatchCard match={item} />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Text style={styles.emptySearchText}>No matches found</Text>
            </View>
          }
        />
      ) : (
        <EmptyState
          title="No Matches Yet"
          message="Record your first match to see it here"
          icon={<Plus size={60} color={colors.textLight} />}
          actionLabel="Record Match"
          onAction={() => router.push("/add-match")}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    marginLeft: 8,
    fontSize: 16,
    color: colors.text,
  },
  listContent: {
    padding: 16,
  },
  emptySearch: {
    padding: 20,
    alignItems: "center",
  },
  emptySearchText: {
    fontSize: 16,
    color: colors.textLight,
  },
});