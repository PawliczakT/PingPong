import React, {useEffect} from "react";
import {Pressable, ScrollView, StyleSheet, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {Bell, PlusCircle, Trophy, Users} from "lucide-react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import {useMatchStore} from "@/store/matchStore";
import {useTournamentStore} from "@/store/tournamentStore";
import {useNetworkStore} from "@/store/networkStore";
import {useNotificationStore} from "@/store/notificationStore";
import PlayerCard from "@/components/PlayerCard";
import MatchCard from "@/components/MatchCard";
import TournamentCard from "@/components/TournamentCard";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import NetworkStatusBar from "@/components/NetworkStatusBar";

export default function HomeScreen() {
    const router = useRouter();
    const {getActivePlayersSortedByRating} = usePlayerStore();
    const {getRecentMatches} = useMatchStore();
    const {getUpcomingTournaments, getActiveTournaments} = useTournamentStore();
    const {checkNetworkStatus, syncPendingMatches} = useNetworkStore();
    const {registerForPushNotifications, notificationHistory} = useNotificationStore();

    const topPlayers = getActivePlayersSortedByRating().slice(0, 3);
    const recentMatches = getRecentMatches(3);
    const upcomingTournaments = [...getUpcomingTournaments(), ...getActiveTournaments()].slice(0, 2);
    const unreadNotifications = notificationHistory.filter(n => !n.read).length;

    useEffect(() => {
        checkNetworkStatus().then(isOnline => {
            if (isOnline) {
                syncPendingMatches();
            }
        });
        registerForPushNotifications();
    }, []);

    const navigateToSection = (section: string) => {
        switch (section) {
            case "players":
                router.push("/players");
                break;
            case "matches":
                router.push("/matches");
                break;
            case "tournaments":
                router.push("/tournaments");
                break;
            case "add-match":
                router.push("/add-match");
                break;
            case "add-tournament":
                router.push("/tournament/create");
                break;
            case "notifications":
                router.push("/notifications");
                break;
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <NetworkStatusBar/>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>PingPong StatKeeper</Text>
                        <Pressable
                            style={styles.notificationButton}
                            onPress={() => navigateToSection("notifications")}
                        >
                            <Bell size={24} color={colors.text}/>
                            {unreadNotifications > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.notificationCount}>
                                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    </View>
                    <Text style={styles.subtitle}>Track your matches and rankings</Text>
                </View>

                <View style={styles.quickActions}>
                    <Pressable
                        style={styles.quickAction}
                        onPress={() => navigateToSection("add-match")}
                    >
                        <View style={[styles.quickActionIcon, {backgroundColor: colors.primary}]}>
                            <PlusCircle size={24} color="#fff"/>
                        </View>
                        <Text style={styles.quickActionText}>New Match</Text>
                    </Pressable>

                    <Pressable
                        style={styles.quickAction}
                        onPress={() => navigateToSection("add-tournament")}
                    >
                        <View style={[styles.quickActionIcon, {backgroundColor: colors.secondary}]}>
                            <Trophy size={24} color="#fff"/>
                        </View>
                        <Text style={styles.quickActionText}>New Tournament</Text>
                    </Pressable>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Top Players</Text>
                        <Button
                            title="View All"
                            variant="text"
                            size="small"
                            onPress={() => navigateToSection("players")}
                        />
                    </View>

                    {topPlayers.length > 0 ? (
                        topPlayers.map((player, index) => (
                            <PlayerCard
                                key={player.id}
                                player={player}
                                rank={index + 1}
                            />
                        ))
                    ) : (
                        <EmptyState
                            title="No Players Yet"
                            message="Add players to start tracking their stats"
                            icon={<Users size={40} color={colors.textLight}/>}
                            actionLabel="Add Player"
                            onAction={() => router.push("/player/create")}
                        />
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Matches</Text>
                        <Button
                            title="View All"
                            variant="text"
                            size="small"
                            onPress={() => navigateToSection("matches")}
                        />
                    </View>

                    {recentMatches.length > 0 ? (
                        recentMatches.map((match) => (
                            <MatchCard key={match.id} match={match}/>
                        ))
                    ) : (
                        <EmptyState
                            title="No Matches Yet"
                            message="Record your first match to see it here"
                            icon={<PlusCircle size={40} color={colors.textLight}/>}
                            actionLabel="Record Match"
                            onAction={() => router.push("/add-match")}
                        />
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Upcoming Tournaments</Text>
                        <Button
                            title="View All"
                            variant="text"
                            size="small"
                            onPress={() => navigateToSection("tournaments")}
                        />
                    </View>

                    {upcomingTournaments.length > 0 ? (
                        upcomingTournaments.map((tournament, index) => (
                            <TournamentCard
                                key={`home-upcoming-${tournament.id}-${index}`}
                                tournament={tournament}
                            />
                        ))
                    ) : (
                        <EmptyState
                            title="No Tournaments Scheduled"
                            message="Create a tournament to get started"
                            icon={<Trophy size={40} color={colors.textLight}/>}
                            actionLabel="Create Tournament"
                            onAction={() => router.push("/tournament/create")}
                        />
                    )}
                </View>
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
        padding: 16,
        paddingTop: 8,
    },
    titleContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: colors.text,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textLight,
        marginTop: 4,
    },
    notificationButton: {
        padding: 8,
        position: "relative",
    },
    notificationBadge: {
        position: "absolute",
        top: 0,
        right: 0,
        backgroundColor: colors.secondary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    notificationCount: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "bold",
    },
    quickActions: {
        flexDirection: "row",
        padding: 16,
        paddingTop: 0,
    },
    quickAction: {
        flex: 1,
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 4,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    quickActionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
    quickActionText: {
        fontSize: 14,
        fontWeight: "bold",
        color: colors.text,
    },
    section: {
        padding: 16,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
    },
});
