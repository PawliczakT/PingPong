import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import Button from '@/components/Button';
import { colors } from '@/constants/colors';
import { User, Pencil, LogOut } from 'lucide-react-native';
import { usePlayerStore } from '@/store/playerStore';

export default function ProfileScreen() {
    const router = useRouter();
    const { user, logout, isLoading } = useAuthStore();
    const { players, updatePlayer } = usePlayerStore();
    const [currentPlayer, setCurrentPlayer] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');

    useEffect(() => {
        if (user) {
            console.log('Current user ID:', user.id);
            console.log('Available players:', players);
            const player = players.find(p => p.user_id === user.id);
            if (player) {
                console.log('Found player profile:', player);
                setCurrentPlayer(player);
                setName(player.name);
                setNickname(player.nickname || '');
            } else {
                console.log('No player profile found for user ID:', user.id);
                // Create a default player profile if not found
                const defaultPlayer = {
                    id: user.id,
                    user_id: user.id,
                    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Player',
                    nickname: user.user_metadata?.name || '',
                    email: user.email || '',
                    avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
                    eloRating: 1000,
                    wins: 0,
                    losses: 0,
                    active: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                setCurrentPlayer(defaultPlayer);
                setName(defaultPlayer.name);
                setNickname(defaultPlayer.nickname);
            }
        }
    }, [user, players]);

    const handleSave = async () => {
        if (!currentPlayer || !user) return;

        try {
            const playerData = {
                user_id: user.id,
                name,
                nickname: nickname || null,
                avatar_url: currentPlayer.avatarUrl || null,
                elo_rating: currentPlayer.eloRating || 1000,
                wins: currentPlayer.wins || 0,
                losses: currentPlayer.losses || 0,
                active: true,
                updated_at: new Date().toISOString()
            };

            // Check if player exists
            const { data: existingPlayer } = await supabase
                .from('players')
                .select('*')
                .eq('user_id', user.id)
                .single();

            let updatedPlayer;

            if (existingPlayer) {
                // Update existing player
                const { data, error } = await supabase
                    .from('players')
                    .update(playerData)
                    .eq('id', existingPlayer.id)
                    .select()
                    .single();
                
                if (error) throw error;
                updatedPlayer = data;
            } else {
                // Create new player
                const { data, error } = await supabase
                    .from('players')
                    .insert([{ ...playerData, created_at: new Date().toISOString() }])
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
            Alert.alert('Success', 'Profile updated successfully');
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

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <Text>Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.avatar}>
                        <User size={60} color={colors.text} />
                    </View>
                    <Text style={styles.name}>{currentPlayer.name}</Text>
                    {currentPlayer.nickname && (
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
                            />
                        ) : (
                            <Text style={styles.value}>{currentPlayer.name}</Text>
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
                            <Text style={styles.value}>{currentPlayer.nickname || 'Not set'}</Text>
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
                            <Text style={styles.statValue}>{currentPlayer.elo_rating || 1000}</Text>
                            <Text style={styles.statLabel}>ELO</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{currentPlayer.wins || 0}</Text>
                            <Text style={styles.statLabel}>Wins</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{currentPlayer.losses || 0}</Text>
                            <Text style={styles.statLabel}>Losses</Text>
                        </View>
                    </View>
                </View>

                {isEditing ? (
                    <View style={styles.buttonGroup}>
                        <Button
                            title="Save Changes"
                            onPress={handleSave}
                            style={styles.button}
                        />
                        <Button
                            title="Cancel"
                            onPress={() => setIsEditing(false)}
                            variant="outline"
                            style={styles.button}
                        />
                    </View>
                ) : (
                    <Button
                        title="Edit Profile"
                        onPress={() => setIsEditing(true)}
                        icon={<Pencil size={18} color="white" />}
                        style={styles.button}
                    />
                )}

                <Button
                    title="Sign Out"
                    onPress={handleSignOut}
                    variant="secondary"
                    icon={<LogOut size={18} color="white" />}
                    style={[styles.button, styles.signOutButton]}
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
    },
});
