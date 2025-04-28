import React from "react";
import {ScrollView, StyleSheet, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {Stack} from "expo-router";

export default function AchievementsScreen() {
    const placeholderAchievements = [
        {id: '1', name: 'Pierwsza Wygrana', description: 'Wygraj swój pierwszy mecz.', unlocked: true},
        {id: '2', name: '10 Wygranych', description: 'Wygraj 10 meczów.', unlocked: true},
        {id: '3', name: '5 Meczów', description: 'Rozegraj 5 meczów.', unlocked: true},
        {id: '4', name: 'Seria 3 Wygranych', description: 'Wygraj 3 mecze pod rząd.', unlocked: false},
        {id: '5', name: 'Wygrana w Turnieju', description: 'Wygraj oficjalny turniej.', unlocked: false},
    ];

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <Stack.Screen options={{title: "Osiągnięcia"}}/>
            <ScrollView contentContainerStyle={styles.content}>
                {placeholderAchievements.map((ach) => (
                    <View key={ach.id}
                          style={[styles.achievementCard, ach.unlocked ? styles.unlockedCard : styles.lockedCard]}>
                        <Text style={[styles.achievementName, ach.unlocked ? styles.unlockedText : styles.lockedText]}>
                            {ach.name}
                        </Text>
                        <Text
                            style={[styles.achievementDescription, ach.unlocked ? styles.unlockedDescription : styles.lockedDescription]}>
                            {ach.description}
                        </Text>
                        {/* TODO: Add progress indicators or icons */}
                    </View>
                ))}

                {/* TODO: Add logic to display user's progress */}

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
    achievementCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 5,
    },
    lockedCard: {
        borderColor: colors.textLight,
        opacity: 0.7,
    },
    unlockedCard: {
        borderColor: colors.success,
    },
    achievementName: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 4,
    },
    achievementDescription: {
        fontSize: 14,
    },
    lockedText: {
        color: colors.textLight,
    },
    unlockedText: {
        color: colors.text,
    },
    lockedDescription: {
        color: colors.textLight,
    },
    unlockedDescription: {
        color: colors.text,
    },
});
