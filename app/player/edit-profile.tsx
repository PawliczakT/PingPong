import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View,} from 'react-native';
import {trpc} from '@/lib/trpc';
import Button from '@/components/Button';
import PlayerAvatar from '@/components/PlayerAvatar';

export default function EditProfileScreen() {
    const {
        data: profile,
        isLoading: isLoadingProfile,
        error: profileError,
        refetch
    } = trpc.player.getProfile.useQuery();
    const {
        mutate: updateProfile,
        isPending: isUpdatingProfile,
        error: updateError
    } = trpc.player.updateProfile.useMutation();

    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setNickname(profile.nickname || '');
            setAvatarUrl(profile.avatarUrl || '');
        }
    }, [profile]);

    const handleUpdateProfile = async () => {
        setSuccessMessage(null);

        // Basic validation
        if (!name.trim()) {
            Alert.alert("Validation Error", "Name is required.");
            return;
        }

        // Validate avatar URL format if provided
        if (avatarUrl && avatarUrl.trim() !== '') {
            try {
                new URL(avatarUrl);
            } catch (e) {
                Alert.alert("Validation Error", "Please enter a valid URL for the avatar or leave it empty.");
                return;
            }
        }

        const input = {
            name: name.trim(),
            nickname: nickname.trim() || null,
            avatarUrl: avatarUrl.trim() || null
        } as const;

        // If this is a new profile (no profile exists yet), we don't need to check for changes
        if (profile && Object.keys(input).every(key => {
            const profileKey = key as keyof typeof profile;
            return input[key as keyof typeof input] === (profile[profileKey] || null);
        })) {
            setSuccessMessage("No changes to save.");
            return;
        }

        // Validate name: ensure it's not empty if provided
        if (input.name !== undefined && input.name.trim() === '') {
            Alert.alert("Validation Error", "Name cannot be empty.");
            return;
        }

        // Validate avatar_url: basic URL check if provided and not null
        if (input.avatarUrl !== undefined && input.avatarUrl !== null && input.avatarUrl.trim() !== '') {
            try {
                new URL(input.avatarUrl);
            } catch (_) {
                Alert.alert("Validation Error", "Avatar URL is not valid. Please leave empty or provide a valid URL.");
                return;
            }
        }


        updateProfile(input, {
            onSuccess: (updatedData) => {
                setSuccessMessage('Profile updated successfully!');
                refetch(); // Refetch the profile data to show updated values
                // Potentially update local form state if backend returns the updated object
                if (updatedData) {
                    setName(updatedData.name || '');
                    setNickname(updatedData.nickname || '');
                    setAvatarUrl(updatedData.avatarUrl || '');
                }
                setTimeout(() => setSuccessMessage(null), 3000); // Clear message after 3s
            },
            onError: (error) => {
                // Error is already captured by `updateError` state, but specific actions can be taken here
                console.error("Update profile error:", error);
                Alert.alert("Update Failed", error.message || "Could not update profile.");
            }
        });
    };

    if (isLoadingProfile) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large"/>
                <Text>Loading profile...</Text>
            </View>
        );
    }

    if (profileError) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Error loading profile: {profileError.message}</Text>
                <Button title="Retry" onPress={() => refetch()}/>
            </View>
        );
    }

    if (!profile) {
        return (
            <ScrollView style={styles.scrollView} contentContainerStyle={[styles.container, styles.centered]}>
                <Text style={styles.title}>Welcome to PingPong! 🏓</Text>
                <Text style={styles.subtitle}>Let's set up your player profile</Text>
                <Text style={styles.instructions}>
                    Please enter your name and optionally a nickname and avatar URL to get started.
                    You can update these details anytime from your profile.
                </Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Name *</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Your full name"
                        autoCapitalize="words"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nickname</Text>
                    <TextInput
                        style={styles.input}
                        value={nickname}
                        onChangeText={setNickname}
                        placeholder="Your nickname (optional)"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Avatar URL</Text>
                    <TextInput
                        style={styles.input}
                        value={avatarUrl}
                        onChangeText={setAvatarUrl}
                        placeholder="URL to your avatar image (optional)"
                        keyboardType="url"
                        autoCapitalize="none"
                    />
                </View>

                {isUpdatingProfile && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small"/>
                        <Text style={styles.loadingText}>Saving...</Text>
                    </View>
                )}

                {updateError && (
                    <Text style={[styles.errorText, styles.messageText]}>Update Error: {updateError.message}</Text>
                )}

                <Button
                    title="Save Profile"
                    onPress={handleUpdateProfile}
                    disabled={isUpdatingProfile || !name.trim()}
                />
            </ScrollView>
        );
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>Edit Your Profile</Text>

            <View style={styles.avatarContainer}>
                <PlayerAvatar
                    name={name || 'Player'}
                    avatarUrl={avatarUrl || undefined}
                    size={100}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your full name"
                    autoCapitalize="words"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nickname</Text>
                <TextInput
                    style={styles.input}
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="Your nickname (optional)"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Avatar URL</Text>
                <TextInput
                    style={styles.input}
                    value={avatarUrl}
                    onChangeText={setAvatarUrl}
                    placeholder="URL to your avatar image (optional)"
                    keyboardType="url"
                    autoCapitalize="none"
                />
            </View>

            {isUpdatingProfile && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small"/>
                    <Text style={styles.loadingText}>Saving...</Text>
                </View>
            )}

            {updateError && (
                <Text style={[styles.errorText, styles.messageText]}>Update Error: {updateError.message}</Text>
            )}
            {successMessage && (
                <Text style={[styles.successText, styles.messageText]}>{successMessage}</Text>
            )}

            <Button
                title="Save Changes"
                onPress={handleUpdateProfile}
                disabled={isUpdatingProfile || isLoadingProfile}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        marginBottom: 20,
        textAlign: 'center',
        color: '#555',
    },
    instructions: {
        fontSize: 16,
        textAlign: 'center',
        color: '#666',
        marginBottom: 30,
        lineHeight: 24,
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f7f7f7',
    },
    container: {
        padding: 20,
        alignItems: 'stretch', // Default, good for forms
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 15,
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
        color: '#555',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 15,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    errorText: {
        color: 'red',
        marginBottom: 10,
        textAlign: 'center',
    },
    successText: {
        color: 'green',
        marginBottom: 10,
        textAlign: 'center',
    },
    messageText: {
        marginTop: 10,
        fontSize: 16,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 10,
    },
    loadingText: {
        marginLeft: 10,
        fontSize: 16,
        color: '#555',
    }
});
