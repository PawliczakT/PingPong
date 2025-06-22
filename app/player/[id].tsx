//app/player/[id].tsx
import React, {useEffect, useState} from "react";
import {Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View} from "react-native";
import {Stack, useLocalSearchParams, useRouter} from "expo-router";
import {Award, Medal, User, Zap} from "lucide-react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {Image} from "expo-image";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import {useMatchStore} from "@/store/matchStore";
import {useStatsStore} from "@/store/statsStore";
import {useAchievementStore} from "@/store/achievementStore";
import {formatWinRate} from "@/utils/formatters";
import MatchCard from "@/components/MatchCard";
import Button from "@/components/Button";
import StreakDisplay from "@/components/StreakDisplay";
import AchievementBadge from "@/components/AchievementBadge";
import RankBadge from "@/components/RankBadge";
import * as Haptics from "expo-haptics";
import {Rank} from "@/constants/ranks";

export default function PlayerDetailScreen() {
    const {id} = useLocalSearchParams();
    const router = useRouter();
    const {getPlayerById, deactivatePlayer} = usePlayerStore();
    const {getMatchesByPlayerId} = useMatchStore();
    const {getPlayerStreak} = useStatsStore();
    const {getUnlockedAchievements, checkAndUpdateAchievements} = useAchievementStore();

    const player = getPlayerById(id as string);
    const matches = getMatchesByPlayerId(id as string);
    const streak = getPlayerStreak(id as string);
    const achievements = getUnlockedAchievements(id as string);

    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [activeTab, setActiveTab] = useState<"matches" | "achievements" | "ranks">("matches");

    useEffect(() => {
        if (player) {
            checkAndUpdateAchievements(player.id).catch((e) => {
                console.error("Error checking achievements:", e);
            });
        }
    }, [player?.id]);

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

    const handleDelete = async () => {
        if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        if (showConfirmDelete) {
            try {
                await deactivatePlayer(player.id);
                Alert.alert(
                    "Success",
                    "Player deactivated successfully",
                    [{text: "OK", onPress: () => router.back()}]
                );
            } catch (error) {
                Alert.alert("Error", "Failed to deactivate player");
            }
        } else {
            setShowConfirmDelete(true);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <Stack.Screen
                options={{
                    title: player.name,
                    headerShadowVisible: false,
                    headerStyle: {
                        backgroundColor: colors.background,
                    },
                }}
            />

            <ScrollView>
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        {player.avatarUrl ? (
                            <Image
                                source={{uri: player.avatarUrl}}
                                style={styles.avatar}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <User size={60} color={colors.textLight}/>
                            </View>
                        )}
                    </View>

                    <View style={styles.nameContainer}>
                        <Text style={styles.name}>{player.name}</Text>
                        {player.rank && (
                            <RankBadge rank={player.rank} size="small"/>
                        )}
                    </View>
                    {player.nickname && (
                        <Text style={styles.nickname}>"{player.nickname}"</Text>
                    )}

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{player.eloRating}</Text>
                            <Text style={styles.statLabel}>ELO Rating</Text>
                        </View>

                        <View style={styles.statDivider}/>

                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{player.wins}</Text>
                            <Text style={styles.statLabel}>Wins</Text>
                        </View>

                        <View style={styles.statDivider}/>

                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{player.losses}</Text>
                            <Text style={styles.statLabel}>Losses</Text>
                        </View>

                        <View style={styles.statDivider}/>

                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {formatWinRate(player.wins, player.losses)}
                            </Text>
                            <Text style={styles.statLabel}>Win Rate</Text>
                        </View>
                    </View>

                    <View style={styles.streakContainer}>
                        <StreakDisplay
                            currentStreak={streak.current}
                            longestStreak={streak.longest}
                        />
                    </View>

                    <View style={styles.actions}>
                        {/*<Button*/}
                        {/*    title="Edit"*/}
                        {/*    variant="outline"*/}
                        {/*    icon={<Edit size={16} color={colors.primary}/>}*/}
                        {/*    style={styles.actionButton}*/}
                        {/*    onPress={() => router.push(`/player/edit/${player.id}`)}*/}
                        {/*/>*/}

                        {/*<Button*/}
                        {/*    title={showConfirmDelete ? "Confirm Delete" : "Delete"}*/}
                        {/*    variant={showConfirmDelete ? "secondary" : "outline"}*/}
                        {/*    icon={<Trash size={16} color={showConfirmDelete ? "#fff" : colors.error}/>}*/}
                        {/*    style={[*/}
                        {/*        styles.actionButton,*/}
                        {/*        showConfirmDelete ? styles.deleteButton : styles.deleteOutlineButton*/}
                        {/*    ]}*/}
                        {/*    textStyle={showConfirmDelete ? styles.deleteButtonText : styles.deleteOutlineText}*/}
                        {/*    onPress={handleDelete}*/}
                        {/*/>*/}
                    </View>
                </View>

                <View style={styles.tabs}>
                    <Pressable
                        style={[
                            styles.tab,
                            activeTab === "matches" && styles.activeTab
                        ]}
                        onPress={() => setActiveTab("matches")}
                    >
                        <View style={styles.tabContent}>
                            <Zap
                                size={16}
                                color={activeTab === "matches" ? colors.primary : colors.textLight}
                                style={styles.tabIcon}
                            />
                            <Text
                                style={[
                                    styles.tabText,
                                    activeTab === "matches" && styles.activeTabText
                                ]}
                            >
                                Match History
                            </Text>
                        </View>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.tab,
                            activeTab === "achievements" && styles.activeTab
                        ]}
                        onPress={() => setActiveTab("achievements")}
                    >
                        <View style={styles.tabContent}>
                            <Award
                                size={16}
                                color={activeTab === "achievements" ? colors.primary : colors.textLight}
                                style={styles.tabIcon}
                            />
                            <Text
                                style={[
                                    styles.tabText,
                                    activeTab === "achievements" && styles.activeTabText
                                ]}
                            >
                                Achievements
                            </Text>
                        </View>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.tab,
                            activeTab === "ranks" && styles.activeTab
                        ]}
                        onPress={() => setActiveTab("ranks")}
                    >
                        <View style={styles.tabContent}>
                            <Medal
                                size={16}
                                color={activeTab === "ranks" ? colors.primary : colors.textLight}
                                style={styles.tabIcon}
                            />
                            <Text
                                style={[
                                    styles.tabText,
                                    activeTab === "ranks" && styles.activeTabText
                                ]}
                            >
                                Ranks
                            </Text>
                        </View>
                    </Pressable>
                </View>

                {activeTab === "matches" ? (
                    <View style={styles.section}>
                        {matches.length > 0 ? (
                            matches.map((match) => (
                                <MatchCard key={match.id} match={match}/>
                            ))
                        ) : (
                            <View style={styles.emptyMatches}>
                                <Text style={styles.emptyText}>No matches played yet</Text>
                            </View>
                        )}
                    </View>
                ) : activeTab === "achievements" ? (
                    <View style={styles.section}>
                        {achievements.length > 0 ? (
                            <View style={styles.achievementsContainer}>
                                {achievements.map((achievement) => (
                                    <View key={achievement.type} style={styles.achievementItem}>
                                        <AchievementBadge achievement={achievement}/>
                                        <Text style={styles.achievementName}>{achievement.name}</Text>
                                        <Text style={styles.achievementDescription}>{achievement.description}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyAchievements}>
                                <Award size={40} color={colors.textLight}/>
                                <Text style={styles.emptyText}>No achievements unlocked yet</Text>
                                <Text style={styles.achievementHint}>
                                    Play more matches and win tournaments to earn achievements!
                                </Text>
                            </View>
                        )}
                    </View>
                ) : activeTab === "ranks" ? (
                    <View style={styles.section}>
                        <View style={styles.rankLegendContainer}>
                            <Text style={styles.rankLegendTitle}>Player Ranks</Text>
                            <Text style={styles.rankLegendDescription}>
                                Ranks are based on the number of wins. Win more matches to achieve higher ranks!
                            </Text>

                            {/* Import ranks from constants and map through them */}
                            {require('@/constants/ranks').ranks.map((rank: Rank) => (
                                <View key={rank.id} style={styles.rankItem}>
                                    <RankBadge rank={rank} size="medium"/>
                                    <View style={styles.rankInfo}>
                                        <Text style={styles.rankName}>{rank.name}</Text>
                                        <Text style={styles.rankRequirement}>
                                            {rank.requiredWins} {rank.requiredWins === 1 ? 'win' : 'wins'} required
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={styles.section}>
                        <Text style={styles.emptyText}>Select a tab to view content</Text>
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
    header: {
        alignItems: "center",
        padding: 20,
        backgroundColor: colors.card,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        overflow: "hidden",
        marginBottom: 16,
        backgroundColor: colors.background,
    },
    avatar: {
        width: 100,
        height: 100,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    nameContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    name: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
    },
    nickname: {
        fontSize: 18,
        color: colors.textLight,
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: 16,
        marginVertical: 16,
    },
    statItem: {
        alignItems: "center",
    },
    statValue: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.text,
    },
    statLabel: {
        fontSize: 14,
        color: colors.textLight,
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        height: "100%",
        backgroundColor: colors.border,
    },
    streakContainer: {
        marginVertical: 16,
    },
    actions: {
        flexDirection: "row",
        marginTop: 8,
    },
    actionButton: {
        marginHorizontal: 8,
        minWidth: 120,
    },
    deleteButton: {
        backgroundColor: colors.error,
        borderColor: colors.error,
    },
    deleteOutlineButton: {
        borderColor: colors.error,
    },
    deleteButtonText: {
        color: "#fff",
    },
    deleteOutlineText: {
        color: colors.error,
    },
    tabs: {
        flexDirection: "row",
        paddingHorizontal: 16,
        marginTop: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    activeTab: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: 16,
        color: colors.textLight,
        fontWeight: "500",
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: "bold",
    },
    tabContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    tabIcon: {
        marginRight: 6,
    },
    section: {
        padding: 16,
    },
    emptyMatches: {
        padding: 20,
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: 12,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textLight,
    },
    achievementsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    achievementItem: {
        width: "48%",
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    achievementName: {
        fontSize: 14,
        fontWeight: "bold",
        color: colors.text,
        marginTop: 8,
        textAlign: "center",
    },
    achievementDescription: {
        fontSize: 12,
        color: colors.textLight,
        marginTop: 4,
        textAlign: "center",
    },
    emptyAchievements: {
        padding: 40,
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: 12,
    },
    achievementHint: {
        fontSize: 14,
        color: colors.textLight,
        marginTop: 8,
        textAlign: "center",
    },
    rankLegendContainer: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    rankLegendTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 8,
        textAlign: "center",
    },
    rankLegendDescription: {
        fontSize: 14,
        color: colors.textLight,
        marginBottom: 16,
        textAlign: "center",
    },
    rankItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    rankInfo: {
        marginLeft: 12,
        flex: 1,
    },
    rankName: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
    },
    rankRequirement: {
        fontSize: 14,
        color: colors.textLight,
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
});
