import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/constants/colors";
import { Player } from "@/types";

type PlayerAvatarProps = {
  name: string;
  avatarUrl?: string;
  size?: number;
  player?: Player;
};

export default function PlayerAvatar({ name, avatarUrl, size = 40, player }: PlayerAvatarProps) {
  // If player is provided, use its properties
  const displayName = player ? player.name : name;
  const displayAvatarUrl = player ? player.avatarUrl : avatarUrl;
  
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const styles = StyleSheet.create({
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: displayAvatarUrl ? "transparent" : colors.primary,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    image: {
      width: size,
      height: size,
    },
    initials: {
      color: "#fff",
      fontSize: size / 3,
      fontWeight: "bold",
    },
  });

  return (
    <View style={styles.container}>
      {displayAvatarUrl ? (
        <Image
          source={{ uri: displayAvatarUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Text style={styles.initials}>{initials}</Text>
      )}
    </View>
  );
}