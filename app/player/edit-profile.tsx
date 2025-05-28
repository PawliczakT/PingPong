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
    } = trpc.player.getProfile.useQuery(undefined, {
        // Dodajemy opcje obsługi błędów dla braku profilu
        retry: (failureCount, error) => {
            // Jeśli błąd dotyczy braku profilu, nie próbujemy ponownie
            if (error.message?.includes("PGRST116") || error.message?.includes("no rows")) {
                return false;
            }
            return failureCount < 3; // w innych przypadkach spróbuj do 3 razy
        },
    });

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

        // Podstawowa walidacja
        if (!name.trim()) {
            Alert.alert("Błąd walidacji", "Imię jest wymagane.");
            return;
        }

        // Walidacja URL avatara
        if (avatarUrl && avatarUrl.trim() !== '') {
            try {
                new URL(avatarUrl);
            } catch (e) {
                Alert.alert("Błąd walidacji", "Wprowadź poprawny URL avatara lub pozostaw pole puste.");
                return;
            }
        }

        const input = {
            name: name.trim(),
            nickname: nickname.trim() || null,
            avatarUrl: avatarUrl.trim() || null
        };

        // Sprawdzamy zmiany tylko dla istniejącego profilu
        if (profile && Object.keys(input).every(key => {
            const profileKey = key as keyof typeof profile;
            return input[key as keyof typeof input] === (profile[profileKey] || null);
        })) {
            setSuccessMessage("Brak zmian do zapisania.");
            return;
        }

        updateProfile(input, {
            onSuccess: (updatedData) => {
                setSuccessMessage('Profil został zaktualizowany!');
                refetch();
                if (updatedData) {
                    setName(updatedData.name || '');
                    setNickname(updatedData.nickname || '');
                    setAvatarUrl(updatedData.avatarUrl || '');
                }
                setTimeout(() => setSuccessMessage(null), 3000);
            },
            onError: (error) => {
                console.error("Błąd aktualizacji profilu:", error);
                Alert.alert("Aktualizacja nie powiodła się",
                    error.message || "Nie można zaktualizować profilu. Spróbuj ponownie później.");
            }
        });
    };

    if (isLoadingProfile) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large"/>
                <Text>Ładowanie profilu...</Text>
            </View>
        );
    }

    // Sprawdzamy czy błąd dotyczy braku profilu
    const isProfileNotFoundError = profileError?.message?.includes("PGRST116") ||
        profileError?.message?.includes("no rows") ||
        profileError?.message?.includes("User not found");

    // Jeśli to inny błąd niż brak profilu, pokazujemy komunikat
    if (profileError && !isProfileNotFoundError) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Błąd wczytywania profilu: {profileError.message}</Text>
                <Button title="Ponów" onPress={() => refetch()}/>
            </View>
        );
    }

    // Jeśli profil nie istnieje lub mamy błąd braku profilu, pokazujemy formularz rejestracji
    if (!profile || isProfileNotFoundError) {
        return (
            <ScrollView style={styles.scrollView} contentContainerStyle={[styles.container, styles.centered]}>
                <Text style={styles.title}>Witaj w PingPong! 🏓</Text>
                <Text style={styles.subtitle}>Utwórzmy Twój profil gracza</Text>
                <Text style={styles.instructions}>
                    Wprowadź swoje imię i opcjonalnie pseudonim oraz URL avatara, aby rozpocząć.
                    Możesz zaktualizować te dane w dowolnym momencie z poziomu swojego profilu.
                </Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Imię *</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Twoje imię i nazwisko"
                        autoCapitalize="words"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Pseudonim</Text>
                    <TextInput
                        style={styles.input}
                        value={nickname}
                        onChangeText={setNickname}
                        placeholder="Twój pseudonim (opcjonalnie)"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>URL Avatara</Text>
                    <TextInput
                        style={styles.input}
                        value={avatarUrl}
                        onChangeText={setAvatarUrl}
                        placeholder="URL do obrazu avatara (opcjonalnie)"
                        keyboardType="url"
                        autoCapitalize="none"
                    />
                </View>

                {isUpdatingProfile && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small"/>
                        <Text style={styles.loadingText}>Zapisywanie...</Text>
                    </View>
                )}

                {updateError && (
                    <Text style={[styles.errorText, styles.messageText]}>Błąd aktualizacji: {updateError.message}</Text>
                )}

                <Button
                    title="Zapisz profil"
                    onPress={handleUpdateProfile}
                    disabled={isUpdatingProfile || !name.trim()}
                />
            </ScrollView>
        );
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>Edytuj swój profil</Text>

            <View style={styles.avatarContainer}>
                <PlayerAvatar
                    name={name || 'Gracz'}
                    avatarUrl={avatarUrl || undefined}
                    size={100}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Imię</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Twoje imię i nazwisko"
                    autoCapitalize="words"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Pseudonim</Text>
                <TextInput
                    style={styles.input}
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="Twój pseudonim (opcjonalnie)"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>URL Avatara</Text>
                <TextInput
                    style={styles.input}
                    value={avatarUrl}
                    onChangeText={setAvatarUrl}
                    placeholder="URL do obrazu avatara (opcjonalnie)"
                    keyboardType="url"
                    autoCapitalize="none"
                />
            </View>

            {isUpdatingProfile && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small"/>
                    <Text style={styles.loadingText}>Zapisywanie...</Text>
                </View>
            )}

            {updateError && (
                <Text style={[styles.errorText, styles.messageText]}>Błąd aktualizacji: {updateError.message}</Text>
            )}
            {successMessage && (
                <Text style={[styles.successText, styles.messageText]}>{successMessage}</Text>
            )}

            <Button
                title="Zapisz zmiany"
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
        alignItems: 'stretch',
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
