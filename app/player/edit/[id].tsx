import React, {useEffect, useState} from "react";
import {Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View} from "react-native";
import {Stack, useLocalSearchParams, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import Button from "@/components/Button";
import * as Haptics from "expo-haptics";

export default function EditPlayerScreen() {
    const {id} = useLocalSearchParams();
    const router = useRouter();
    const {getPlayerById, updatePlayer} = usePlayerStore();

    const player = getPlayerById(id as string);

    const [name, setName] = useState("");
    const [nickname, setNickname] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (player) {
            setName(player.name);
            setNickname(player.nickname || "");
            setAvatarUrl(player.avatarUrl || "");
        }
    }, [player]);

    if (!player) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{title: "Player Not Found"}}/>
                <View style={styles.notFound}>
                    <Text style={styles.notFoundText}>Player not found</Text>
                    <Button
                        title="Go Back"
                        onPress={() => router.back()}
                        variant="outline"
                    />
                </View>
            </SafeAreaView>
        );
    }

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Player name is required");
            return;
        }

        setIsSubmitting(true);

        try {
            await updatePlayer({
                ...player,
                name: name.trim(),
                nickname: nickname.trim() || undefined,
                avatarUrl: avatarUrl.trim() || undefined,
            });

            if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            Alert.alert(
                "Success",
                "Player updated successfully",
                [{text: "OK", onPress: () => router.back()}]
            );
        } catch (error) {
            Alert.alert("Error", "Failed to update player");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <Stack.Screen
                options={{
                    title: "Edit Player",
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
                    title="Save Changes"
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
    notFound: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    notFoundText: {
        fontSize: 18,
        color: colors.textLight,
        marginBottom: 20,
    },
});
