import React, {useEffect, useState} from "react";
import {Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from "react-native";
import {Stack, useLocalSearchParams, useRouter} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import Button from "@/components/Button";
import * as Haptics from "expo-haptics";
import {uploadImageToSupabase} from "@/utils/imageUpload";
import {pickAndProcessAvatarWithAWS} from "@/utils/pickAndProcessAvatarWithAWS";
import {Image as ExpoImage} from "expo-image";

export default function EditPlayerScreen() {
    const {id} = useLocalSearchParams();
    const router = useRouter();
    const {getPlayerById, updatePlayer} = usePlayerStore();

    const player = getPlayerById(id as string);

    const [name, setName] = useState("");
    const [nickname, setNickname] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>("");
    const [selectedImageUri, setSelectedImageUri] = useState<string | undefined>(undefined);
    const [selectedImageBase64, setSelectedImageBase64] = useState<string | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (player) {
            setName(player.name);
            setNickname(player.nickname || "");
            setAvatarUrl(player.avatarUrl || undefined);
        }
    }, [player]);

    // Pick and process image with face detection
    const handlePickImage = async () => {
        try {
            setIsSubmitting(true);
            console.log('AWS recognition: selectedImageUri', selectedImageUri)
            const result = await pickAndProcessAvatarWithAWS();

            if (!result.canceled && result.uri) {
                console.log('AWS recognition: result.uri', result.uri)
                setSelectedImageUri(result.uri);
                setSelectedImageBase64(result.base64);
                // Set avatarUrl temporarily to show the image in the form
                setAvatarUrl(result.uri); // result.uri jest tutaj string, więc jest zgodny z SetStateAction<string | undefined>

                // Inform the user that the image was processed using AWS
                if (result.awsProcessed) {
                    Alert.alert(
                        'Success',
                        'The face was automatically detected and cropped using AWS Rekognition!',
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
            let finalAvatarUrl = avatarUrl;

            // If a local image was selected, use it directly or attempt to upload
            if (selectedImageUri) {
                setUploadingImage(true);

                // Use the selected image URI directly or try to upload
                const {url, error} = await uploadImageToSupabase(
                    selectedImageUri,
                    selectedImageBase64,
                    player.id
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

            await updatePlayer({
                ...player,
                name: name.trim(),
                nickname: nickname.trim() || undefined,
                avatarUrl: finalAvatarUrl || undefined,
            });

            if (Platform.OS !== "web") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
                        ) : player.avatarUrl ? (
                            <ExpoImage
                                source={{uri: player.avatarUrl}}
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
                    title={uploadingImage ? "Uploading Image..." : "Save Changes"}
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
