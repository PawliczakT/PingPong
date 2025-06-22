//app/(tabs)/tournaments.tsx
import React, {useState} from "react";
import {FlatList, Pressable, StyleSheet, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {Plus, Trophy} from "lucide-react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {useTournamentStore} from "@/store/tournamentStore";
import TournamentCard from "@/components/TournamentCard";
import EmptyState from "@/components/EmptyState";
import Button from "@/components/Button";

export default function TournamentsScreen() {
    const router = useRouter();
    const {
        tournaments,
        getUpcomingTournaments,
        getActiveTournaments,
        getCompletedTournaments
    } = useTournamentStore();

    const [activeTab, setActiveTab] = useState<"upcoming" | "active" | "completed">("upcoming");

    const upcomingTournaments = getUpcomingTournaments();
    const activeTournaments = getActiveTournaments();
    const completedTournaments = getCompletedTournaments();

    const renderTournaments = () => {
        let data = [];

        switch (activeTab) {
            case "upcoming":
                data = upcomingTournaments;
                break;
            case "active":
                data = activeTournaments;
                break;
            case "completed":
                data = completedTournaments;
                break;
        }

        if (data.length === 0) {
            let message = "";

            switch (activeTab) {
                case "upcoming":
                    message = "No upcoming tournaments scheduled";
                    break;
                case "active":
                    message = "No tournaments currently in progress";
                    break;
                case "completed":
                    message = "No completed tournaments yet";
                    break;
            }

            return (
                <EmptyState
                    title={`No ${activeTab} Tournaments`}
                    message={message}
                    icon={<Trophy size={40} color={colors.textLight}/>}
                    actionLabel={activeTab === "upcoming" ? "Create Tournament" : undefined}
                    onAction={activeTab === "upcoming" ? () => router.push("/tournament/create") : undefined}
                />
            );
        }

        return (
            <FlatList
                data={data}
                keyExtractor={(item) => item.id}
                renderItem={({item}) => (
                    <TournamentCard tournament={item}/>
                )}
                contentContainerStyle={styles.listContent}
            />
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <View style={styles.header}>
                <Text style={styles.title}>Tournaments</Text>
                <Button
                    title="Create"
                    onPress={() => router.push("/tournament/create")}
                    icon={<Plus size={18} color="#fff"/>}
                    size="small"
                />
            </View>

            <View style={styles.tabs}>
                <Pressable
                    style={[
                        styles.tab,
                        activeTab === "upcoming" && styles.activeTab
                    ]}
                    onPress={() => setActiveTab("upcoming")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "upcoming" && styles.activeTabText
                        ]}
                    >
                        Upcoming
                    </Text>
                </Pressable>

                <Pressable
                    style={[
                        styles.tab,
                        activeTab === "active" && styles.activeTab
                    ]}
                    onPress={() => setActiveTab("active")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "active" && styles.activeTabText
                        ]}
                    >
                        Active
                    </Text>
                </Pressable>

                <Pressable
                    style={[
                        styles.tab,
                        activeTab === "completed" && styles.activeTab
                    ]}
                    onPress={() => setActiveTab("completed")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "completed" && styles.activeTabText
                        ]}
                    >
                        Completed
                    </Text>
                </Pressable>
            </View>

            {tournaments.length > 0 ? (
                renderTournaments()
            ) : (
                <EmptyState
                    title="No Tournaments Yet"
                    message="Create your first tournament to get started"
                    icon={<Trophy size={60} color={colors.textLight}/>}
                    actionLabel="Create Tournament"
                    onAction={() => router.push("/tournament/create")}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        paddingBottom: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
    },
    tabs: {
        flexDirection: "row",
        paddingHorizontal: 16,
        marginBottom: 8,
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
    listContent: {
        padding: 16,
    },
});
