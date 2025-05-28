import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Stack, useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuthStore} from '@/store/authStore';
import {supabase} from '@/lib/supabase';
import Button from '@/components/Button';
import {colors} from '@/constants/colors';
import {Bell, LogOut, Pencil, User} from 'lucide-react-native';
import {usePlayerStore} from '@/store/playerStore';
import {useNotificationStore} from '@/store/notificationStore';
import {Player} from '@/types';

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

// Count unread notifications for this player
    const unreadCount = currentPlayer ? notificationHistory.filter(n =>
        !n.read && (!n.data?.player?.id || n.data?.player?.id === currentPlayer.id)
    ).length : 0;

    useEffect(() => {
        const loadPlayerProfile = async () => {
            if (!user) return;

            setLoadingProfile(true);
            console.log('Current user ID:', user.id);

            try {
                // First try to find in local store by user_id
                let foundPlayer = players.find(p => p.user_id === user.id);

                // If not found locally, fetch directly from Supabase
                if (!foundPlayer) {
                    const {data, error} = await supabase
                        .from('players')
                        .select('*')
                        .eq('user_id', user.id)
                        .single();

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
                            updatedAt: data.updated_at
                        };
                    } else {
                        // No player found in database
                        setIsNewUser(true);
                    }
                }

                if (foundPlayer) {
                    console.log('Found player profile:', foundPlayer);
                    setCurrentPlayer(foundPlayer);
                    setName(foundPlayer.name);
                    setNickname(foundPlayer.nickname || '');
                    setIsNewUser(false);
                } else {
                    console.log('No player profile found for user ID:', user.id);
                    // Create a default player profile if not found
                    const defaultPlayer: Player = {
                        id: '', // Will be set when saved to the database
                        user_id: user.id,
                        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Player',
                        nickname: user.user_metadata?.name || undefined,
                        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
                        eloRating: 1000,
                        wins: 0,
                        losses: 0,
                        active: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    setCurrentPlayer(defaultPlayer);
                    setName(defaultPlayer.name);
                    setNickname(defaultPlayer.nickname || '');

                    // Auto-enable editing for new users
                    setIsEditing(true);
                }
            } catch (error) {
                console.error('Error loading player profile:', error);
                Alert.alert('Error', 'Failed to load profile data');
            } finally {
                setLoadingProfile(false);
            }
        };

        loadPlayerProfile();
    }, [user, players]);

    const handleSave = async () => {
        if (!user) return;

        try {
            if (!name.trim()) {
                Alert.alert('Validation Error', 'Name is required');
                return;
            }

            const playerData = {
                user_id: user.id,
                name,
                nickname: nickname || null,
                avatar_url: currentPlayer?.avatarUrl || null,
                elo_rating: currentPlayer?.eloRating || 1000,
                wins: currentPlayer?.wins || 0,
                losses: currentPlayer?.losses || 0,
                active: true,
                updated_at: new Date().toISOString()
            } as const;

            // Check if player exists
            const {data: existingPlayer} = await supabase
                .from('players')
                .select('*')
                .eq('user_id', user.id)
                .single();

            let updatedPlayer;

            if (existingPlayer) {
                // Update existing player
                const {data, error} = await supabase
                    .from('players')
                    .update(playerData)
                    .eq('id', existingPlayer.id)
                    .select()
                    .single();

                if (error) throw error;
                updatedPlayer = data;
            } else {
                // Create new player
                const {data, error} = await supabase
                    .from('players')
                    .insert([{...playerData, created_at: new Date().toISOString()}])
                    .select()
                    .single();

                if (error) throw error;
                updatedPlayer = data;
            }

            // Update local state
            const formattedPlayer = {
                ...updatedPlayer,
                id: updatedPlayer.id,
                user_id: updatedPlayer.user_id,
                name: updatedPlayer.name,
                nickname: updatedPlayer.nickname,
                avatarUrl: updatedPlayer.avatar_url,
                eloRating: updatedPlayer.elo_rating,
                wins: updatedPlayer.wins,
                losses: updatedPlayer.losses,
                active: updatedPlayer.active,
                createdAt: updatedPlayer.created_at,
                updatedAt: updatedPlayer.updated_at
            };

            updatePlayer(formattedPlayer);
            setCurrentPlayer(formattedPlayer);
            setIsEditing(false);

            if (isNewUser) {
                setIsNewUser(false);
                Alert.alert('Profile Created', 'Your player profile has been created successfully!');
            } else {
                Alert.alert('Success', 'Profile updated successfully');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to update profile');
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
                    <View style={styles.avatar}>
                        <User size={60} color={colors.text}/>
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
                    <>
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
                    </>
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
