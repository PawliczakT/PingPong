// app/(tabs)/profile.tsx
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';
import {Image} from 'expo-image';
import {useAuth} from '@/store/authStore';
import {usePlayerStore} from '@/store/playerStore';
import {useNotificationStore} from '@/store/notificationStore';
import {supabase} from '@/backend/server/lib/supabase';
import {usePlayerProfile} from '@/hooks/usePlayerProfile';
import {useImageUpload} from '@/hooks/useImageUpload';
import {Rank, ranks} from "@/constants";

export const getRankByWins = (wins: number): Rank => {
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (wins >= ranks[i].requiredWins) {
            return ranks[i];
        }
    }
    return ranks[0];
};

export default function ProfileScreen() {
    const {user, logout} = useAuth();
    const {players, updatePlayer, addPlayer} = usePlayerStore();
    const {notificationHistory} = useNotificationStore();

    const [formState, setFormState] = useState({
        name: '',
        nickname: '',
        isEditing: false,
        isSaving: false
    });

    const updateFormState = useCallback((updates: Partial<typeof formState>) => {
        setFormState(prev => ({...prev, ...updates}));
    }, []);

    const {
        currentPlayer,
        isLoadingProfile,
        isNewUser,
        profileError,
        refreshProfile
    } = usePlayerProfile(user, players);

    const {isUploadingImage, pickAndUploadImage} = useImageUpload(
        currentPlayer,
        user,
        (avatarUrl) => {
            if (currentPlayer) {
                updatePlayer({
                    ...currentPlayer,
                    avatarUrl
                });
                refreshProfile();
            }
        }
    );

    const unreadCount = useMemo(() =>
            notificationHistory.filter(n => !n.read).length,
        [notificationHistory]
    );

    const playerStats = useMemo(() => {
        if (!currentPlayer) return null;

        const totalGames = currentPlayer.wins + currentPlayer.losses;
        const winRate = totalGames > 0 ? (currentPlayer.wins / totalGames * 100).toFixed(1) : '0';

        return {
            totalGames,
            winRate,
            rank: getRankByWins(currentPlayer.wins)
        };
    }, [currentPlayer]);

    React.useEffect(() => {
        if (currentPlayer) {
            setFormState(prev => ({
                ...prev,
                name: currentPlayer.name || '',
                nickname: currentPlayer.nickname || ''
            }));
        }
    }, [currentPlayer]);

    const handleSave = useCallback(async () => {
        if (!user || !currentPlayer) return;

        updateFormState({isSaving: true});

        try {
            const {error} = await supabase
                .from('players')
                .update({
                    name: formState.name.trim(),
                    nickname: formState.nickname.trim(),
                })
                .eq('id', currentPlayer.id);

            if (error) {
                throw error;
            }

            await updatePlayer({
                ...currentPlayer,
                name: formState.name.trim(),
                nickname: formState.nickname.trim(),
            });

            updateFormState({isEditing: false});
            Alert.alert('Success', 'Profile updated successfully!');

        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert(
                'Error',
                `Failed to save profile: ${(error as Error)?.message || 'Please try again.'}`
            );
        } finally {
            updateFormState({isSaving: false});
        }
    }, [user, currentPlayer, formState.name, formState.nickname, updatePlayer, updateFormState]);

    const handleCreateProfile = useCallback(async () => {
        if (!user || !formState.name.trim()) {
            Alert.alert('Error', 'Please enter your name');
            return;
        }

        updateFormState({isSaving: true});

        try {
            const newPlayer = await addPlayer(
                formState.name.trim(),
                formState.nickname.trim() || null,
                null
            );

            if (newPlayer) {
                Alert.alert('Success', 'Profile created successfully!');
                refreshProfile();
            }
        } catch (error) {
            console.error('Error creating profile:', error);
            Alert.alert(
                'Error',
                `Failed to create profile: ${(error as Error)?.message || 'Please try again.'}`
            );
        } finally {
            updateFormState({isSaving: false});
        }
    }, [user, formState.name, formState.nickname, addPlayer, updateFormState, refreshProfile]);

    const handleLogout = useCallback(async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                {text: 'Cancel', style: 'cancel'},
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await logout();
                        } catch (error) {
                            console.error('Logout error:', error);
                            Alert.alert('Error', 'Failed to logout. Please try again.');
                        }
                    }
                }
            ]
        );
    }, [logout]);

    if (isLoadingProfile) {
        return (
            <SafeAreaView
                style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F27'}}>
                <ActivityIndicator size="large" color="#007AFF"/>
                <Text style={{marginTop: 16, fontSize: 16, color: '#666'}}>
                    Loading profile...
                </Text>
            </SafeAreaView>
        );
    }

    if (profileError) {
        return (
            <SafeAreaView style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
                backgroundColor: '#F2F2F27'
            }}>
                <Ionicons name="alert-circle" size={50} color="#FF3B30"/>
                <Text style={{marginTop: 16, fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#000'}}>
                    Error Loading Profile
                </Text>
                <Text style={{marginTop: 8, fontSize: 16, color: '#666', textAlign: 'center'}}>
                    {profileError}
                </Text>
                <TouchableOpacity
                    style={{
                        marginTop: 20,
                        backgroundColor: '#007AFF',
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8
                    }}
                    onPress={refreshProfile}
                >
                    <Text style={{color: 'white', fontSize: 16, fontWeight: 'bold'}}>
                        Try Again
                    </Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (isNewUser) {
        return (
            <SafeAreaView style={{flex: 1, backgroundColor: '#F2F2F27'}}>
                <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={{flex: 1}}
                >
                    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
                        <BlurView intensity={20} style={{
                            padding: 30,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            width: '100%',
                            maxWidth: 400
                        }}>
                            <Text style={{
                                fontSize: 28,
                                fontWeight: 'bold',
                                color: 'white',
                                textAlign: 'center',
                                marginBottom: 10
                            }}>
                                Welcome to Ping Pong!
                            </Text>
                            <Text style={{
                                fontSize: 16,
                                color: 'white',
                                textAlign: 'center',
                                marginBottom: 30,
                                opacity: 0.9
                            }}>
                                Let's set up your profile to get started
                            </Text>

                            <View style={{marginBottom: 20}}>
                                <Text style={{color: 'white', fontSize: 16, marginBottom: 8}}>Name *</Text>
                                <TextInput
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.9)',
                                        padding: 15,
                                        borderRadius: 10,
                                        fontSize: 16,
                                        color: '#000'
                                    }}
                                    value={formState.name}
                                    onChangeText={(text) => updateFormState({name: text})}
                                    placeholder="Enter your name"
                                    placeholderTextColor="#666"
                                />
                            </View>

                            <View style={{marginBottom: 30}}>
                                <Text style={{color: 'white', fontSize: 16, marginBottom: 8}}>Nickname (Optional)</Text>
                                <TextInput
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.9)',
                                        padding: 15,
                                        borderRadius: 10,
                                        fontSize: 16,
                                        color: '#000'
                                    }}
                                    value={formState.nickname}
                                    onChangeText={(text) => updateFormState({nickname: text})}
                                    placeholder="Enter your nickname"
                                    placeholderTextColor="#666"
                                />
                            </View>

                            <TouchableOpacity
                                style={{
                                    backgroundColor: formState.name.trim() ? '#007AFF' : '#666',
                                    padding: 15,
                                    borderRadius: 10,
                                    alignItems: 'center'
                                }}
                                onPress={handleCreateProfile}
                                disabled={!formState.name.trim() || formState.isSaving}
                            >
                                {formState.isSaving ? (
                                    <ActivityIndicator color="white"/>
                                ) : (
                                    <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}>
                                        Create Profile
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </BlurView>
                    </View>
                </LinearGradient>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: '#F2F2F27'}}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={{
                        paddingTop: 20,
                        paddingBottom: 40,
                        paddingHorizontal: 20,
                        borderBottomLeftRadius: 30,
                        borderBottomRightRadius: 30,
                    }}
                >
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 30
                    }}>
                        <Text style={{fontSize: 28, fontWeight: 'bold', color: 'white'}}>
                            Profile
                        </Text>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            {unreadCount > 0 && (
                                <View style={{
                                    backgroundColor: '#FF3B30',
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    marginRight: 10
                                }}>
                                    <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>
                                        {unreadCount}
                                    </Text>
                                </View>
                            )}
                            <TouchableOpacity onPress={handleLogout}>
                                <Ionicons name="log-out-outline" size={24} color="white"/>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{alignItems: 'center'}}>
                        <TouchableOpacity
                            onPress={pickAndUploadImage}
                            disabled={isUploadingImage}
                            style={{
                                position: 'relative',
                                marginBottom: 20
                            }}
                        >
                            <View style={{
                                width: 120,
                                height: 120,
                                borderRadius: 60,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: 4,
                                borderColor: 'white'
                            }}>
                                {currentPlayer?.avatarUrl ? (
                                    <Image
                                        source={{uri: currentPlayer.avatarUrl}}
                                        style={{width: 112, height: 112, borderRadius: 56}}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <Ionicons name="person" size={50} color="white"/>
                                )}
                            </View>

                            {isUploadingImage && (
                                <View style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    borderRadius: 60,
                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}>
                                    <ActivityIndicator color="white"/>
                                </View>
                            )}

                            <View style={{
                                position: 'absolute',
                                bottom: 5,
                                right: 5,
                                backgroundColor: '#007AFF',
                                borderRadius: 15,
                                width: 30,
                                height: 30,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: 2,
                                borderColor: 'white'
                            }}>
                                <Ionicons name="camera" size={16} color="white"/>
                            </View>
                        </TouchableOpacity>

                        <Text style={{fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center'}}>
                            {currentPlayer?.name || 'Unknown Player'}
                        </Text>
                        {currentPlayer?.nickname && (
                            <Text style={{
                                fontSize: 16,
                                color: 'rgba(255,255,255,0.8)',
                                textAlign: 'center',
                                marginTop: 4
                            }}>
                                "{currentPlayer.nickname}"
                            </Text>
                        )}
                        {playerStats && (
                            <Text style={{
                                fontSize: 14,
                                color: 'rgba(255,255,255,0.9)',
                                textAlign: 'center',
                                marginTop: 8
                            }}>
                                {playerStats.rank.name} • {playerStats.totalGames} games • {playerStats.winRate}% win
                                rate
                            </Text>
                        )}
                    </View>
                </LinearGradient>

                {currentPlayer && playerStats && (
                    <View style={{paddingHorizontal: 20, marginTop: -20, marginBottom: 20}}>
                        <View style={{
                            backgroundColor: 'white',
                            borderRadius: 15,
                            padding: 20,
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            shadowColor: '#000',
                            shadowOffset: {width: 0, height: 2},
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 3
                        }}>
                            <View style={{alignItems: 'center'}}>
                                <Text style={{fontSize: 24, fontWeight: 'bold', color: '#007AFF'}}>
                                    {currentPlayer.wins}
                                </Text>
                                <Text style={{fontSize: 12, color: '#666', marginTop: 4}}>
                                    Wins
                                </Text>
                            </View>
                            <View style={{alignItems: 'center'}}>
                                <Text style={{fontSize: 24, fontWeight: 'bold', color: '#FF3B30'}}>
                                    {currentPlayer.losses}
                                </Text>
                                <Text style={{fontSize: 12, color: '#666', marginTop: 4}}>
                                    Losses
                                </Text>
                            </View>
                            <View style={{alignItems: 'center'}}>
                                <Text style={{fontSize: 24, fontWeight: 'bold', color: '#FF9500'}}>
                                    {currentPlayer.eloRating}
                                </Text>
                                <Text style={{fontSize: 12, color: '#666', marginTop: 4}}>
                                    ELO Rating
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={{paddingHorizontal: 20, marginBottom: 20}}>
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 15,
                        padding: 20,
                        shadowColor: '#000',
                        shadowOffset: {width: 0, height: 2},
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 3
                    }}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 20
                        }}>
                            <Text style={{fontSize: 20, fontWeight: 'bold', color: '#000'}}>
                                Profile Details
                            </Text>
                            <TouchableOpacity
                                onPress={() => updateFormState({isEditing: !formState.isEditing})}
                                disabled={formState.isSaving}
                            >
                                <Ionicons
                                    name={formState.isEditing ? "close" : "pencil"}
                                    size={20}
                                    color="#007AFF"
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={{marginBottom: 15}}>
                            <Text style={{fontSize: 14, color: '#666', marginBottom: 8}}>Name</Text>
                            {formState.isEditing ? (
                                <TextInput
                                    style={{
                                        borderWidth: 1,
                                        borderColor: '#E5E5EA',
                                        borderRadius: 8,
                                        padding: 12,
                                        fontSize: 16,
                                        backgroundColor: '#F9F9F9'
                                    }}
                                    value={formState.name}
                                    onChangeText={(text) => updateFormState({name: text})}
                                    placeholder="Enter your name"
                                />
                            ) : (
                                <Text style={{fontSize: 16, color: '#000'}}>
                                    {currentPlayer?.name || 'Not set'}
                                </Text>
                            )}
                        </View>

                        <View style={{marginBottom: formState.isEditing ? 20 : 15}}>
                            <Text style={{fontSize: 14, color: '#666', marginBottom: 8}}>Nickname</Text>
                            {formState.isEditing ? (
                                <TextInput
                                    style={{
                                        borderWidth: 1,
                                        borderColor: '#E5E5EA',
                                        borderRadius: 8,
                                        padding: 12,
                                        fontSize: 16,
                                        backgroundColor: '#F9F9F9'
                                    }}
                                    value={formState.nickname}
                                    onChangeText={(text) => updateFormState({nickname: text})}
                                    placeholder="Enter your nickname"
                                />
                            ) : (
                                <Text style={{fontSize: 16, color: '#000'}}>
                                    {currentPlayer?.nickname || 'Not set'}
                                </Text>
                            )}
                        </View>

                        {formState.isEditing && (
                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#F2F2F7',
                                        padding: 12,
                                        borderRadius: 8,
                                        alignItems: 'center',
                                        marginRight: 10
                                    }}
                                    onPress={() => {
                                        updateFormState({
                                            isEditing: false,
                                            name: currentPlayer?.name || '',
                                            nickname: currentPlayer?.nickname || ''
                                        });
                                    }}
                                    disabled={formState.isSaving}
                                >
                                    <Text style={{color: '#666', fontSize: 16, fontWeight: '600'}}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#007AFF',
                                        padding: 12,
                                        borderRadius: 8,
                                        alignItems: 'center',
                                        marginLeft: 10
                                    }}
                                    onPress={handleSave}
                                    disabled={formState.isSaving || !formState.name.trim()}
                                >
                                    {formState.isSaving ? (
                                        <ActivityIndicator color="white" size="small"/>
                                    ) : (
                                        <Text style={{color: 'white', fontSize: 16, fontWeight: '600'}}>
                                            Save
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={{marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#E5E5EA'}}>
                            <Text style={{fontSize: 14, color: '#666', marginBottom: 8}}>Email</Text>
                            <Text style={{fontSize: 16, color: '#000'}}>
                                {user?.email || 'Not available'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Sekcja "Ustawienia" tylko z wylogowaniem */}
                <View style={{paddingHorizontal: 20, marginBottom: 30}}>
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 15,
                        shadowColor: '#000',
                        shadowOffset: {width: 0, height: 2},
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 3
                    }}>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 16
                            }}
                            onPress={handleLogout}
                        >
                            <Ionicons name="log-out-outline" size={20} color="#FF3B30"/>
                            <Text style={{marginLeft: 12, fontSize: 16, color: '#FF3B30', flex: 1}}>
                                Logout
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
