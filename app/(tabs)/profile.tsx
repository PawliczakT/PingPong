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
import {supabase} from '@/lib/supabase';
import Button from '@/components/Button';
import {colors} from '@/constants/colors';
import {Bell, Camera, Image as ImageIcon, LogOut, Pencil, User} from 'lucide-react-native';
import {usePlayerStore} from '@/store/playerStore';
import {useNotificationStore} from '@/store/notificationStore';
import {Player} from '@/types';
import * as ImagePicker from 'expo-image-picker';
import {decode} from "base64-arraybuffer";

export default function ProfileScreen() {
    const router = useRouter();
    const {user, logout, isLoading: authLoading} = useAuthStore();
    const {notificationHistory} = useNotificationStore();
    const {players, updatePlayer} = usePlayerStore();
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
                base64: true,
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

            // Convert image to base64
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

            // Extract file extension from URI
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${user.id}_${Date.now()}.${fileExt}`;

            // Upload to Supabase storage
            const {data, error} = await supabase.storage
                .from('avatars')
                .upload(fileName, decode(base64Data), {
                    contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                    upsert: true,
                });

            if (error) {
                console.error('Error uploading avatar:', error);
                throw error;
            }

            // Get public URL
            const {data: {publicUrl}} = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Update player record
            const {data: updatedPlayerData, error: updateError} = await supabase
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

            // Update local state
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

// Count unread notifications for this player
    const unreadCount = currentPlayer ? notificationHistory.filter(n =>
        !n.read && (!n.data?.player?.id || n.data?.player?.id === currentPlayer.id)
    ).length : 0;

    useEffect(() => {
        const loadPlayerProfile = async () => {
            if (!user) return;
            setLoadingProfile(true);

            try {
                // First try to find in local store by user_id
                let foundPlayer = players.find(p => p.user_id === user.id);

                // If not found locally, fetch directly from Supabase
                if (!foundPlayer) {
                    const {data, error} = await supabase
                        .from('players')
                        .select('*')
                        .eq('user_id', user.id)
                        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

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
                        // Player not found - new user
                        console.log("No player profile found, creating new profile form");
                        setIsNewUser(true);
                        const newPlayer = {
                            id: '', // Let DB assign the ID
                            user_id: user.id,
                            name: user.user_metadata?.full_name || user.user_metadata?.name || 'New Player',
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
                        setName(newPlayer.name);
                        setIsEditing(true);
                        setLoadingProfile(false);
                        return;
                    }
                }

                if (foundPlayer) {
                    setCurrentPlayer(foundPlayer);
                    setName(foundPlayer.name);
                    setNickname(foundPlayer.nickname || '');
                } else {
                    // Failsafe - if we somehow don't have a player by this point
                    console.log("No player found after all checks, setting new user profile");
                    setIsNewUser(true);
                    const newPlayer = {
                        id: '',
                        user_id: user.id,
                        name: user.user_metadata?.full_name || user.user_metadata?.name || 'New Player',
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
                    setName(newPlayer.name);
                    setIsEditing(true);
                }
            } catch (error) {
                console.error('Error loading player profile:', error);
                Alert.alert('Error', 'Failed to load profile. Please try again.');
            } finally {
                setLoadingProfile(false);
            }
        };

        loadPlayerProfile().catch(err => err && console.error('Error loading player profile:', err));
    }, [user, players]);

    const handleSave = async () => {
        if (!user || !currentPlayer) return;

        try {
            setLoadingProfile(true);
            const playerData = {
                user_id: user.id,
                name: name.trim(),
                nickname: nickname.trim() || undefined,
                avatar_url: currentPlayer.avatarUrl,
                elo_rating: currentPlayer.eloRating,
                wins: currentPlayer.wins,
                losses: currentPlayer.losses,
                active: true,
                updated_at: new Date().toISOString(),
            };

            const {data, error} = isNewUser
                ? await supabase
                    .from('players')
                    .insert(playerData)
                    .select()
                    .single()
                : await supabase
                    .from('players')
                    .update(playerData)
                    .eq('id', currentPlayer.id)
                    .select()
                    .single();

            if (error) throw error;

            // Update local state
            const updatedPlayer = {
                ...currentPlayer,
                ...data,
                avatarUrl: data.avatar_url,
                eloRating: data.elo_rating,
            };

            setCurrentPlayer(updatedPlayer);
            setIsEditing(false);
            await updatePlayer(updatedPlayer);

            if (isNewUser) {
                setIsNewUser(false);
                router.replace('/(tabs)');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save profile. Please try again.');
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await logout();
            router.replace('/auth/login');
        } catch (error) {
            console.error('Error signing out:', error);
            Alert.alert('Error', 'Failed to sign out');
        }
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

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen
                options={{
                    title: isNewUser ? "Create Player Profile" : "My Profile",
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

                        {!isNewUser && (
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
                        <Text style={styles.label}>Name</Text>
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
                            <Text
                                style={styles.statValue}>{currentPlayer?.eloRating || currentPlayer?.eloRating || 1000}</Text>
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
                            style={styles.button}
                        />
                        {!isNewUser && (
                            <Button
                                title="Cancel"
                                onPress={() => setIsEditing(false)}
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
    )
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
