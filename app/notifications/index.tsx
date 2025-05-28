import React from "react";
import { StyleSheet, View, ActivityIndicator, Text } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { usePlayerStore } from "@/store/playerStore";
import NotificationsList from "@/components/NotificationsList";
import { Notification } from "@/types";

export default function NotificationsScreen() {
    const router = useRouter();
    const { notificationHistory, clearNotificationHistory, isLoading } = useNotificationStore();
    const { user } = useAuthStore();
    const { players } = usePlayerStore();

// Get the current user's player
    const currentPlayer = players.find(p => p.user_id === user?.id);

// Filter notifications for this player
    const filteredNotifications: Notification[] = notificationHistory
        .filter(notification => {
            // Include general notifications and notifications for this player
            return !notification.data?.player?.id ||
                notification.data.player.id === currentPlayer?.id;
        })
        .map(notification => ({
            ...notification,
            message: notification.body,
            createdAt: notification.timestamp || new Date().toISOString(),
        }));

    const handleNotificationPress = (notification: Notification) => {
        // Mark as read functionality could be added here

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

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text>Loading notifications...</Text>
                </View>
            </SafeAreaView>
        );
    }

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
                notifications={filteredNotifications}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
