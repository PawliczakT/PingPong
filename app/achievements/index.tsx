//app/achievements/index.tsx
import {Pressable, ScrollView, Text, TouchableWithoutFeedback, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Stack} from 'expo-router';
import {useAchievementStore} from '@/store/achievementStore';
import {usePlayerStore} from '@/store/playerStore';
import {useEffect, useRef, useState} from 'react';
import {getAchievementIcon} from '@/constants/achievements';
import {AchievementType} from '@/backend/types';
import {ChevronDown, LucideIcon, User} from 'lucide-react-native';

type DisplayAchievement = {
    type: AchievementType;
    name: string;
    description: string;
    unlocked: boolean;
    unlockedAt?: string;
    progress?: number;
    target?: number;
};

export default function AchievementsScreen() {
    const {
        getDisplayAchievements,
        checkAndUpdateAchievements,
        isLoading,
        initializePlayerAchievements
    } = useAchievementStore();
    const {getActivePlayersSortedByRating} = usePlayerStore();

    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [showPlayerSelector, setShowPlayerSelector] = useState(false);
    const [achievementsToDisplay, setAchievementsToDisplay] = useState<DisplayAchievement[]>([]);
    const selectorRef = useRef<View>(null);

    const activePlayers = getActivePlayersSortedByRating();

    useEffect(() => {
        if (activePlayers.length > 0 && !selectedPlayerId) {
            setSelectedPlayerId(activePlayers[0].id);
        }
    }, [activePlayers, selectedPlayerId]);

    useEffect(() => {
        if (selectedPlayerId) {
            initializePlayerAchievements(selectedPlayerId);
            checkAndUpdateAchievements(selectedPlayerId);
            setAchievementsToDisplay(getDisplayAchievements(selectedPlayerId));
        }
    }, [selectedPlayerId, initializePlayerAchievements, checkAndUpdateAchievements, getDisplayAchievements]);

    const selectedPlayer = activePlayers.find(p => p.id === selectedPlayerId);

    if (isLoading && achievementsToDisplay.length === 0) {
        return (
            <SafeAreaView style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                <Text>Loading achievements...</Text>
            </SafeAreaView>
        );
    }

    return (
        <TouchableWithoutFeedback onPress={() => showPlayerSelector && setShowPlayerSelector(false)}>
            <SafeAreaView style={{flex: 1, backgroundColor: '#f0f0f0'}}>
                <Stack.Screen options={{title: 'Achievements'}}/>

                <View
                    ref={selectorRef}
                    style={{
                        padding: 16,
                        backgroundColor: '#fff',
                        shadowColor: '#000',
                        shadowOffset: {width: 0, height: 1},
                        shadowOpacity: 0.2,
                        shadowRadius: 2,
                        elevation: 2,
                        zIndex: 1
                    }}>
                    <Pressable
                        onPress={() => setShowPlayerSelector(!showPlayerSelector)}
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 10,
                            borderWidth: 1,
                            borderColor: '#ddd',
                            borderRadius: 8,
                        }}
                    >
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <User size={20} color="#00796b" style={{marginRight: 8}}/>
                            <Text style={{fontSize: 16, color: '#333'}}>
                                {selectedPlayer ? selectedPlayer.name : 'Select a player'}
                            </Text>
                        </View>
                        <ChevronDown size={20} color="#00796b"/>
                    </Pressable>

                    {showPlayerSelector && (
                        <View style={{
                            position: 'absolute',
                            top: 68,
                            left: 16,
                            right: 16,
                            backgroundColor: '#fff',
                            borderWidth: 1,
                            borderColor: '#ddd',
                            borderRadius: 8,
                            zIndex: 999,
                            maxHeight: 300,
                            shadowColor: '#000',
                            shadowOffset: {width: 0, height: 2},
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                            elevation: 5,
                        }}>
                            <TouchableWithoutFeedback>
                                <ScrollView>
                                    {activePlayers.map(player => (
                                        <Pressable
                                            key={player.id}
                                            onPress={() => {
                                                setSelectedPlayerId(player.id);
                                                setShowPlayerSelector(false);
                                            }}
                                            style={{
                                                padding: 12,
                                                borderBottomWidth: 1,
                                                borderBottomColor: '#eee',
                                                backgroundColor: selectedPlayerId === player.id ? '#e6fffa' : '#fff'
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 16,
                                                color: selectedPlayerId === player.id ? '#00796b' : '#333'
                                            }}>
                                                {player.name}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </TouchableWithoutFeedback>
                        </View>
                    )}
                </View>

                {selectedPlayerId ? (
                    <ScrollView contentContainerStyle={{padding: 16}}>
                        <Text style={{fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#333'}}>
                            {selectedPlayer?.name}'s Achievements
                        </Text>
                        {achievementsToDisplay.length > 0 ? (
                            achievementsToDisplay.map((achievement: DisplayAchievement) => {
                                const IconComponent = getAchievementIcon(achievement.type as AchievementType) as LucideIcon | undefined;
                                return (
                                    <View
                                        key={achievement.type}
                                        style={{
                                            backgroundColor: achievement.unlocked ? '#e6fffa' : '#fff',
                                            padding: 16,
                                            borderRadius: 8,
                                            marginBottom: 12,
                                            shadowColor: '#000',
                                            shadowOffset: {width: 0, height: 1},
                                            shadowOpacity: 0.22,
                                            shadowRadius: 2.22,
                                            elevation: 3,
                                            opacity: achievement.unlocked ? 1 : 0.6,
                                        }}
                                    >
                                        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                                            {IconComponent && (
                                                <IconComponent
                                                    size={24}
                                                    color={achievement.unlocked ? '#00A36C' : '#A0A0A0'}
                                                    style={{marginRight: 8}}
                                                />
                                            )}
                                            <Text style={{
                                                fontSize: 18,
                                                fontWeight: 'bold',
                                                color: achievement.unlocked ? '#00796b' : '#555'
                                            }}>
                                                {achievement.name}
                                            </Text>
                                        </View>
                                        <Text style={{fontSize: 14, color: achievement.unlocked ? '#004d40' : '#777'}}>
                                            {achievement.description}
                                        </Text>
                                        {achievement.unlocked && achievement.unlockedAt && (
                                            <Text style={{
                                                fontSize: 12,
                                                color: '#00796b',
                                                marginTop: 4,
                                                textAlign: 'right'
                                            }}>
                                                Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                                            </Text>
                                        )}
                                        {!achievement.unlocked && (
                                            <Text
                                                style={{fontSize: 12, color: '#777', marginTop: 4, textAlign: 'right'}}>
                                                Progress: {achievement.progress} / {achievement.target}
                                            </Text>
                                        )}
                                    </View>
                                );
                            })
                        ) : (
                            <View style={{padding: 20, alignItems: 'center'}}>
                                <Text style={{fontSize: 16, color: '#777', textAlign: 'center'}}>
                                    No achievements to display for this player yet.
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                ) : (
                    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
                        <Text style={{fontSize: 16, color: '#777', textAlign: 'center'}}>
                            {activePlayers.length > 0
                                ? 'Select a player to view their achievements'
                                : 'No players available. Add players first.'}
                        </Text>
                    </View>
                )}
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}
