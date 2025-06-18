import React, {useState} from "react";
import {Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from "react-native";
import {Stack, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import Button from "@/components/Button";
import {pickAndProcessAvatarWithAWS} from "@/utils/imageUpload";
import {Image as ExpoImage} from "expo-image";
import {supabaseAsAdmin} from '@/backend/server/lib/supabaseAdmin';

export default function CreatePlayerScreen() {
    const router = useRouter();
    const {addPlayer} = usePlayerStore();

    const [name, setName] = useState("");
    const [nickname, setNickname] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>("");
    const [selectedImageUri, setSelectedImageUri] = useState<string | undefined>(undefined);
    const [selectedImageBase64, setSelectedImageBase64] = useState<string | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Pick and process image with face detection
    const handlePickImage = async () => {
        try {
            setIsSubmitting(true);
            const result = await pickAndProcessAvatarWithAWS();

            if (!result.canceled && result.uri) {
                setSelectedImageUri(result.uri);
                setSelectedImageBase64(result.base64);
                // Set avatarUrl temporarily to show the image in the form
                setAvatarUrl(result.uri);

                // Inform the user that AWS was used for face detection
                if (result.awsProcessed) {
                    Alert.alert(
                        'Success',
                        'Face was automatically detected and cropped using AWS Rekognition!',
                        [{text: 'OK'}]
                    );
                }
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!name?.trim()) {
            Alert.alert("Error", "Player name is required");
            return;
        }

        setIsSubmitting(true);

        try {
            // Pobierz aktualnego użytkownika
            const {data: {user}} = await supabaseAsAdmin.auth.getUser();

            if (!user) {
                Alert.alert("Error", "User not authenticated");
                setIsSubmitting(false);
                return;
            }

            // BŁĄD: Tutaj tworzony jest obiekt player z nazwą i innymi polami
            const player = {
                user_id: user.id,
                name: name.trim(),
                nickname: nickname?.trim() || null,
                avatarUrl: user.user_metadata.avatar_url || null,
                eloRating: 1200,
                wins: 0,
                losses: 0,
                active: true,
            };

            // Utworzenie profilu gracza
            const {data: createdPlayer, error} = await supabaseAsAdmin
                .from('players')
                .insert(player)
                .select()
                .single();

            if (error) {
                console.error("Error creating player:", error);
                Alert.alert("Error", error.message);
                setIsSubmitting(false);
                return;
            }

            // Ustaw profil w store
            await addPlayer(
                createdPlayer.name,
                createdPlayer.nickname,
                createdPlayer.avatar_url
            );

            // Przekieruj na stronę główną
            router.replace("/(tabs)");

        } catch (error) {
            console.error("Unexpected error:", error);
            Alert.alert("Error", "An unexpected error occurred");
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
                        onPress={handlePickImage}
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
                                if (text) setSelectedImageUri(undefined);
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
                    disabled={!name?.trim() || uploadingImage}
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
