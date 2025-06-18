import React, {useEffect, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import {Stack, useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuthStore} from '@/store/authStore';
import {supabaseAsAdmin} from '@/backend/server/lib/supabaseAdmin';
import Button from '@/components/Button';
import {colors} from '@/constants/colors';
import {Bell, Camera, Image as ImageIcon, LogOut, Pencil, User} from 'lucide-react-native';
import {usePlayerStore} from '@/store/playerStore';
import {useNotificationStore} from '@/store/notificationStore';
import {Player} from '@/backend/types';
import * as ImagePicker from 'expo-image-picker';
import {decode} from "base64-arraybuffer";

export default function ProfileScreen() {
    const router = useRouter();
    const {user, logout, isLoading: authLoading} = useAuthStore();
    const {notificationHistory} = useNotificationStore();
    const {players, updatePlayer, addPlayer} = usePlayerStore();
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isNewUser, setIsNewUser] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const pickImage = async () => {
        try {
            const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert('Potrzebujemy dostępu do galerii, aby wybrać avatar');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                await uploadAvatar(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Błąd podczas wybierania obrazu:', error);
            Alert.alert('Błąd', 'Nie udało się wybrać obrazu. Spróbuj ponownie.');
        }
    };

    const takePhoto = async () => {
        try {
            const {status} = await ImagePicker.requestCameraPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert('Potrzebujemy dostępu do kamery, aby zrobić zdjęcie');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                await uploadAvatar(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Błąd podczas robienia zdjęcia:', error);
            Alert.alert('Błąd', 'Nie udało się zrobić zdjęcia. Spróbuj ponownie.');
        }
    };

    const uploadAvatar = async (uri: string) => {
        if (!currentPlayer?.id) {
            Alert.alert('Error', 'User profile not found');
            return;
        }

        if (!user?.id) {
            Alert.alert('Error', 'You must be logged in to upload an avatar');
            return;
        }

        try {
            setUploadingImage(true);

            const response = await fetch(uri);
            const blob = await response.blob();
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${user.id}_${Date.now()}.${fileExt}`;

            const {data, error} = await supabaseAsAdmin.storage
                .from('avatars')
                .upload(fileName, decode(base64Data), {
                    contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                    upsert: true,
                });

            if (error) {
                console.error('Error uploading avatar:', error);
                throw error;
            }

            const {data: {publicUrl}} = supabaseAsAdmin.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const {data: updatedPlayerData, error: updateError} = await supabaseAsAdmin
                .from('players')
                .update({
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentPlayer.id)
                .select()
                .single();

            if (updateError || !updatedPlayerData) {
                console.error('Database update error:', updateError);
                throw updateError || new Error('Failed to update player record');
            }

            const updatedPlayer = {
                ...currentPlayer,
                avatarUrl: publicUrl
            };

            await updatePlayer(updatedPlayer);
            setCurrentPlayer(updatedPlayer);
            Alert.alert('Success', 'Avatar has been updated');
        } catch (error) {
            console.error('Error uploading avatar:', error);
            Alert.alert('Error', 'Failed to update avatar. Please try again.');
        } finally {
            setUploadingImage(false);
        }
    };

    const unreadCount = notificationHistory.filter(n => !n.read).length;

    useEffect(() => {
        const loadPlayerProfile = async () => {
            if (!user) {
                setLoadingProfile(false);
                return;
            }

            setLoadingProfile(true);

            try {
                // Sprawdź w lokalnym store
                let foundPlayer = players.find(p => p.user_id === user.id);

                // Jeśli nie ma w store, sprawdź w bazie
                if (!foundPlayer) {
                    const {data, error} = await supabaseAsAdmin
                        .from('players')
                        .select('*')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (data && !error) {
                        foundPlayer = {
                            id: data.id,
                            user_id: data.user_id,
                            name: data.name,
                            nickname: data.nickname,
                            avatarUrl: data.avatar_url,
                            eloRating: data.elo_rating,
                            wins: data.wins,
                            losses: data.losses,
                            active: data.active,
                            createdAt: data.created_at,
                            updatedAt: data.updated_at,
                        };
                    } else if (!data || error?.code === 'PGRST116') {
                        console.log("No player profile found, creating new profile form");
                        setIsNewUser(true);

                        // Bezpieczne wyciągnięcie nazwy z metadanych
                        const defaultName = user.user_metadata?.full_name ||
                            user.user_metadata?.name ||
                            user.email?.split('@')[0] ||
                            'New Player';

                        const newPlayer = {
                            id: '',
                            user_id: user.id,
                            name: defaultName,
                            nickname: undefined,
                            avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
                            eloRating: 1200,
                            wins: 0,
                            losses: 0,
                            active: true,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        };

                        setCurrentPlayer(newPlayer);
                        setName(defaultName); // Upewnij się że name nie jest undefined
                        setNickname(''); // Inicjalizuj jako pusty string
                        setIsEditing(true);
                        setLoadingProfile(false);
                        return;
                    }
                }

                if (foundPlayer) {
                    setCurrentPlayer(foundPlayer);
                    setName(foundPlayer.name || ''); // Bezpieczne ustawienie
                    setNickname(foundPlayer.nickname || ''); // Bezpieczne ustawienie
                }
            } catch (error: any) { // Dodaj ': any' tutaj
                console.error('Error loading player profile:', error);
                console.error('Error details:', {
                    message: error?.message,
                    code: error?.code,
                    details: error?.details,
                    hint: error?.hint,
                    user: user?.id
                });
                Alert.alert('Profile Error', `Failed to load profile: ${error?.message || 'Unknown error'}`);
            } finally {
                setLoadingProfile(false);
            }
        };

        loadPlayerProfile().then(r => console.error("Error loading player profile:", r));
    }, [user, players]);

    const handleSave = async () => {
        if (!user || !currentPlayer) return;

        // Sprawdź czy name istnieje i nie jest pusty po trim
        if (!name || !name?.trim()) {
            Alert.alert('Error', 'Name is required');
            return;
        }

        try {
            setLoadingProfile(true);

            if (isNewUser) {
                const {data: existingCheck} = await supabaseAsAdmin
                    .from('players')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (existingCheck) {
                    console.log('Profile already exists, not creating duplicate');
                    Alert.alert('Info', 'Profile already exists. Refreshing...');
                    setIsNewUser(false);
                    router.replace('/(tabs)');
                    return;
                }
            }

            const playerData = {
                user_id: user.id,
                name: name.trim(),
                nickname: (nickname && true && nickname?.trim()) ? nickname.trim() : null,
                avatar_url: currentPlayer.avatarUrl,
                elo_rating: currentPlayer.eloRating,
                wins: currentPlayer.wins,
                losses: currentPlayer.losses,
                active: true,
                updated_at: new Date().toISOString(),
            };

            console.log('Saving player data:', playerData);

            const {data, error} = isNewUser
                ? await supabaseAsAdmin
                    .from('players')
                    .insert(playerData)
                    .select()
                    .single()
                : await supabaseAsAdmin
                    .from('players')
                    .update(playerData)
                    .eq('id', currentPlayer.id)
                    .select()
                    .single();

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            if (!data) {
                throw new Error('No data returned from database');
            }

            const updatedPlayer = {
                ...currentPlayer,
                id: data.id,
                name: data.name,
                nickname: data.nickname,
                avatarUrl: data.avatar_url,
                eloRating: data.elo_rating,
                wins: data.wins,
                losses: data.losses,
                active: data.active,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            setCurrentPlayer(updatedPlayer);
            setIsEditing(false);

            if (isNewUser) {
                setIsNewUser(false);
                console.log('Successfully created new player profile');

                Alert.alert('Success', 'Profile created successfully!', [
                    {
                        text: 'OK',
                        onPress: () => {
                            router.replace('/');
                        }
                    }
                ]);
            } else {
                await updatePlayer(updatedPlayer);
                Alert.alert('Success', 'Profile saved successfully!');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            // @ts-ignore
            Alert.alert('Error', `Failed to save profile: ${error.message || 'Please try again.'}`);
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                {text: 'Cancel', style: 'cancel'},
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await logout();
                            router.replace('/(auth)/login');
                        } catch (error) {
                            console.error('Error signing out:', error);
                            Alert.alert('Error', 'Failed to sign out');
                        }
                    }
                }
            ]
        );
    };

    if (authLoading || loadingProfile) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary}/>
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>Please log in to view your profile</Text>
                    <Button title="Go to Login" onPress={() => router.push('/(auth)/login')}/>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen
                options={{
                    title: isNewUser ? "Create Profile" : "My Profile",
                    headerShadowVisible: false,
                }}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {isNewUser && (
                    <View style={styles.welcomeContainer}>
                        <Text style={styles.welcomeTitle}>Welcome to PingPong StatKeeper!</Text>
                        <Text style={styles.welcomeText}>
                            Please set up your player profile to continue. This profile will be used for
                            matches, tournaments, and notifications.
                        </Text>
                    </View>
                )}

                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        {uploadingImage ? (
                            <View style={styles.avatar}>
                                <ActivityIndicator size="large" color={colors.primary}/>
                            </View>
                        ) : (
                            <View style={styles.avatar}>
                                {currentPlayer?.avatarUrl ? (
                                    <Image
                                        source={{uri: currentPlayer.avatarUrl}}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <User size={60} color={colors.text}/>
                                )}
                            </View>
                        )}

                        {!isNewUser && !isEditing && (
                            <View style={styles.avatarButtons}>
                                <TouchableOpacity
                                    style={styles.avatarButton}
                                    onPress={pickImage}
                                    disabled={uploadingImage}
                                >
                                    <ImageIcon size={18} color={colors.text}/>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.avatarButton}
                                    onPress={takePhoto}
                                    disabled={uploadingImage}
                                >
                                    <Camera size={18} color={colors.text}/>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    <Text style={styles.name}>{currentPlayer?.name || 'Player'}</Text>
                    {currentPlayer?.nickname && (
                        <Text style={styles.nickname}>"{currentPlayer.nickname}"</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Player Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Name *</Text>
                        {isEditing ? (
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Enter your name"
                                autoCapitalize="words"
                            />
                        ) : (
                            <Text style={styles.value}>{currentPlayer?.name || 'Not set'}</Text>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nickname (optional)</Text>
                        {isEditing ? (
                            <TextInput
                                style={styles.input}
                                value={nickname}
                                onChangeText={setNickname}
                                placeholder="Enter your nickname"
                            />
                        ) : (
                            <Text style={styles.value}>{currentPlayer?.nickname || 'Not set'}</Text>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.value}>{user?.email || 'No email'}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stats</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{currentPlayer?.eloRating || 1200}</Text>
                            <Text style={styles.statLabel}>ELO</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{currentPlayer?.wins || 0}</Text>
                            <Text style={styles.statLabel}>Wins</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{currentPlayer?.losses || 0}</Text>
                            <Text style={styles.statLabel}>Losses</Text>
                        </View>
                    </View>
                </View>

                {isEditing ? (
                    <View style={styles.buttonGroup}>
                        <Button
                            title={isNewUser ? "Create Profile" : "Save Changes"}
                            onPress={handleSave}
                            disabled={loadingProfile || !name || !name?.trim()}
                            style={styles.button}
                        />
                        {!isNewUser && (
                            <Button
                                title="Cancel"
                                onPress={() => {
                                    setIsEditing(false);
                                    setName(currentPlayer?.name || '');
                                    setNickname(currentPlayer?.nickname || '');
                                }}
                                variant="outline"
                                style={styles.button}
                            />
                        )}
                    </View>
                ) : (
                    <View style={styles.buttonGroup}>
                        <Button
                            title="Edit Profile"
                            onPress={() => setIsEditing(true)}
                            icon={<Pencil size={18} color="white"/>}
                            style={styles.button}
                        />
                        <Button
                            title={`Notifications ${unreadCount > 0 ? `(${unreadCount})` : ''}`}
                            onPress={() => router.push('/notifications')}
                            variant="secondary"
                            icon={<Bell size={18} color="white"/>}
                            style={styles.button}
                        />
                        <Button
                            title="Sign Out"
                            onPress={handleSignOut}
                            variant="outline"
                            icon={<LogOut size={18} color={colors.error}/>}
                            style={[styles.button, styles.signOutButton]}
                            textStyle={{color: colors.error}}
                        />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: colors.primary,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarButtons: {
        flexDirection: 'row',
        marginTop: -25,
        zIndex: 10,
    },
    avatarButton: {
        backgroundColor: colors.card,
        padding: 8,
        borderRadius: 20,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: colors.border,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
    },
    nickname: {
        fontSize: 18,
        color: colors.textLight,
        marginTop: 4,
    },
    section: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: colors.textLight,
        marginBottom: 4,
    },
    value: {
        fontSize: 16,
        color: colors.text,
        paddingVertical: 8,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        color: colors.textLight,
    },
    buttonGroup: {
        marginBottom: 16,
    },
    button: {
        marginBottom: 12,
    },
    signOutButton: {
        marginTop: 8,
        borderColor: colors.error,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: colors.textLight,
    },
    errorText: {
        fontSize: 16,
        color: colors.error,
        textAlign: 'center',
        marginBottom: 20,
    },
    welcomeContainer: {
        backgroundColor: colors.primary + '15',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    welcomeTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 8,
        textAlign: 'center',
    },
    welcomeText: {
        fontSize: 14,
        color: colors.text,
        textAlign: 'center',
        lineHeight: 20,
    },
});
