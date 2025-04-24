import React from "react";
import { View, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { useNotificationStore } from "@/store/notificationStore";
import NotificationsList from "@/components/NotificationsList";
import { Notification } from "@/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const { notificationHistory, clearNotificationHistory } = useNotificationStore();
  
  // Convert NotificationRecord to Notification by adding required fields
  const notifications: Notification[] = notificationHistory.map(notification => ({
    ...notification,
    message: notification.title, // Use title as message if not available
    createdAt: new Date().toISOString(), // Use current date if not available
  }));
  
  const handleNotificationPress = (notification: Notification) => {
    // Navigate based on notification type
    switch (notification.type) {
      case "match":
        if (notification.data?.match?.id) {
          router.push(`/match/${notification.data.match.id}`);
        }
        break;
      case "tournament":
        if (notification.data?.tournament?.id) {
          router.push(`/tournament/${notification.data.tournament.id}`);
        }
        break;
      case "achievement":
        if (notification.data?.player?.id) {
          router.push(`/player/${notification.data.player.id}`);
        }
        break;
      case "ranking":
        if (notification.data?.player?.id) {
          router.push(`/player/${notification.data.player.id}`);
        }
        break;
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen 
        options={{ 
          title: "Notifications",
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }} 
      />
      
      <NotificationsList 
        notifications={notifications}
        onPress={handleNotificationPress}
        onClear={clearNotificationHistory}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});