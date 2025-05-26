import React, {useState} from "react";
import {Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from "react-native";
import {Stack, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import Button from "@/components/Button";
import * as Haptics from "expo-haptics";
import {pickImage, uploadImageToSupabase} from "@/utils/imageUpload";
import {Image as ExpoImage} from "expo-image";

export default function CreatePlayerScreen() {
    const router = useRouter();
    const {addPlayer} = usePlayerStore();

    const [name, setName] = useState("");
    const [nickname, setNickname] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const handleImagePick = async () => {
        try {
            const result = await pickImage();

            if (!result.canceled && result.assets && result.assets[0]) {
                setSelectedImageUri(result.assets[0].uri);
                setSelectedImageBase64(result.assets[0].base64);
                // Don't upload yet, we'll do it when submitting the form
            }
        } catch (error) {
            Alert.alert("Error", "Failed to select image");
            console.error("Image selection error:", error);
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Player name is required");
            return;
        }

        setIsSubmitting(true);

        try {
            let finalAvatarUrl = avatarUrl;

            // If a local image was selected, use it directly or attempt to upload
            if (selectedImageUri) {
                setUploadingImage(true);
                // Generate a temporary ID for the file name
                const tempId = `temp_${Date.now()}`;

                // Use the selected image URI directly or try to upload
                const {url, error} = await uploadImageToSupabase(
                    selectedImageUri,
                    selectedImageBase64,
                    tempId
                );

                if (error) {
                    Alert.alert("Avatar Error", error);
                    setUploadingImage(false);
                    setIsSubmitting(false);
                    return;
                }

                if (url) {
                    finalAvatarUrl = url;
                }
                setUploadingImage(false);
            }

            await addPlayer(name.trim(), nickname.trim() || undefined, finalAvatarUrl || undefined);

            if (Platform.OS !== "web") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            Alert.alert(
                "Success",
                "Player added successfully",
                [{text: "OK", onPress: () => router.replace("/(tabs)")}]
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

                <Text style={styles.label}>Avatar</Text>
                <View style={styles.avatarContainer}>
                    <TouchableOpacity
                        style={styles.avatarButton}
                        onPress={handleImagePick}
                        disabled={isSubmitting || uploadingImage}
                    >
                        {selectedImageUri ? (
                            <ExpoImage
                                source={{uri: selectedImageUri}}
                                style={styles.avatarImage}
                                contentFit="cover"
                                transition={200}
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarPlaceholderText}>Select Image</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.avatarInputContainer}>
                        <Text style={styles.label}>OR Avatar URL (optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter avatar image URL"
                            value={avatarUrl}
                            onChangeText={(text) => {
                                setAvatarUrl(text);
                                if (text) setSelectedImageUri(null);
                            }}
                            autoCapitalize="none"
                            keyboardType="url"
                            editable={!selectedImageUri}
                        />
                    </View>
                </View>

                <Text style={styles.helperText}>
                    Tap on the avatar button to select an image from your device, or provide a direct URL to an online
                    image.
                </Text>

                <Button
                    title={uploadingImage ? "Uploading Image..." : "Add Player"}
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={!name.trim() || uploadingImage}
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
    avatarContainer: {
        flexDirection: "row",
        marginBottom: 16,
        alignItems: "flex-start",
    },
    avatarButton: {
        width: 100,
        height: 100,
        borderRadius: 50,
        overflow: "hidden",
        marginRight: 16,
        backgroundColor: colors.card,
    },
    avatarImage: {
        width: "100%",
        height: "100%",
    },
    avatarPlaceholder: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 50,
        borderStyle: "dashed",
    },
    avatarPlaceholderText: {
        fontSize: 12,
        color: colors.textLight,
        textAlign: "center",
        padding: 8,
    },
    avatarInputContainer: {
        flex: 1,
    },
});
