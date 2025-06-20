// app/notifications/index.tsx
import React, {useCallback} from "react"; // ✅ Dodaj useCallback
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {Stack, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {useNotificationStore} from "@/store/notificationStore";
import {useAuth} from "@/store/authStore"; // ✅ Dodaj import useAuth
import NotificationsList from "@/components/NotificationsList";
import {Notification} from "@/backend/types";

export default function NotificationsScreen() {
    const router = useRouter();
    const {user} = useAuth(); // ✅ Dodaj user z useAuth
    const isLoading = useNotificationStore(state => state.isLoading);
    const notificationHistory = useNotificationStore(state => state.notificationHistory);
    const clearHistory = useNotificationStore(state => state.clearHistory);

    // ✅ Debug log
    React.useEffect(() => {
        console.log('🔔 NotificationsScreen render:', {
            isLoading,
            notificationCount: notificationHistory.length,
            userId: user?.id,
            hasUser: !!user
        });
    }, [isLoading, notificationHistory.length, user?.id]);

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

    // ✅ Proper clearHistory call with type safety
    const handleClearAll = useCallback(() => {
        console.log('🔔 Clear all notifications clicked');
        if (user?.id) {
            console.log('🔔 Calling clearHistory with user.id:', user.id);
            clearHistory(user.id);
        } else {
            console.log('🔔 No user.id available for clearHistory');
        }
    }, [clearHistory, user?.id]);

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
                onClear={handleClearAll} // ✅ Proper type-safe function
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
