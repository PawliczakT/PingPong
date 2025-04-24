import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Alert, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { usePlayerStore } from "@/store/playerStore";
import Button from "@/components/Button";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function CreatePlayerScreen() {
  const router = useRouter();
  const { addPlayer } = usePlayerStore();
  
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Player name is required");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await addPlayer(name.trim(), nickname.trim() || undefined, avatarUrl.trim() || undefined);
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert(
        "Success",
        "Player added successfully",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add player");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen 
        options={{ 
          title: "Add New Player",
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }} 
      />
      
      <ScrollView style={styles.content}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter player name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        
        <Text style={styles.label}>Nickname (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter nickname"
          value={nickname}
          onChangeText={setNickname}
        />
        
        <Text style={styles.label}>Avatar URL (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter avatar image URL"
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        
        <Text style={styles.helperText}>
          For avatar, use a direct link to an image (e.g., from Unsplash)
        </Text>
        
        <Button
          title="Add Player"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!name.trim()}
          style={styles.button}
        />
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
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    color: colors.text,
  },
  helperText: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 24,
  },
  button: {
    marginBottom: 20,
  },
});