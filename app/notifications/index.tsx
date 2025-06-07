import React from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {Stack, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {useNotificationStore} from "@/store/notificationStore";
import NotificationsList from "@/components/NotificationsList";
import {Notification} from "@/types";

export default function NotificationsScreen() {
    const router = useRouter();
    const isLoading = useNotificationStore(state => state.isLoading);
    const notificationHistory = useNotificationStore(state => state.notificationHistory);
    const clearHistory = useNotificationStore(state => state.clearHistory);
    const notificationsToDisplay: Notification[] = notificationHistory.map(notification => ({
        ...notification,
        message: notification.body,
        createdAt: notification.timestamp || new Date().toISOString(),
    }));

    const handleNotificationPress = (notification: Notification) => {
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

    if (isLoading && notificationHistory.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary}/>
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
                notifications={notificationsToDisplay}
                onPress={handleNotificationPress}
                onClear={clearHistory}
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
