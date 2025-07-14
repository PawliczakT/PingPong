//app/(tabs)/players.tsx
import React, {useMemo, useState} from "react";
import {FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View} from "react-native";
import {useRouter} from "expo-router";
import {Search, Users, X} from "lucide-react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore, fetchPlayersFromSupabase} from "@/store/playerStore";
import PlayerCard from "@/components/PlayerCard";
import EmptyState from "@/components/EmptyState";
import {useEloStore} from "@/store/eloStore";

export default function PlayersScreen() {
    const router = useRouter();
    const {getPlayerById, players} = usePlayerStore();
    const {isInitialized, getLeaderboard} = useEloStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchPlayersFromSupabase();
        } catch (e) {
            console.warn("Failed to refresh players", e);
        } finally {
            setRefreshing(false);
        }
    };

    const sortedAndFilteredPlayers = useMemo(() => {
        if (!isInitialized) {
            return [];
        }

        const leaderboard = getLeaderboard();
        const sortedPlayers = leaderboard
            .map(entry => getPlayerById(entry.id))
            .filter((player): player is NonNullable<typeof player> => !!player && player.active);

        if (!searchQuery) {
            return sortedPlayers;
        }

        return sortedPlayers.filter(player =>
            player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (player.nickname && player.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [isInitialized, getLeaderboard, getPlayerById, searchQuery, players]);

    const activePlayersExist = useMemo(() => players.some(p => p.active), [players]);

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <View style={styles.header}>
                <View style={styles.searchContainer}>
                    <Search size={20} color={colors.textLight}/>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search players..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery("")}>
                            <X size={18} color={colors.textLight}/>
                        </Pressable>
                    )}
                </View>
            </View>

            {activePlayersExist ? (
                <FlatList
                    data={sortedAndFilteredPlayers}
                    keyExtractor={(item) => item.id}
                    renderItem={({item, index}) => (
                        <PlayerCard player={item} rank={index + 1}/>
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptySearch}>
                            <Text style={styles.emptySearchText}>No players found</Text>
                        </View>
                    }
                />
            ) : (
                <EmptyState
                    title="No Players Yet"
                    message="Players can only be added during login"
                    icon={<Users size={60} color={colors.textLight}/>}
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
        alignItems: "center",
        padding: 16,
        paddingBottom: 8,
    },
    searchContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginRight: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        marginLeft: 8,
        fontSize: 16,
        color: colors.text,
    },
    listContent: {
        padding: 16,
        paddingTop: 8,
    },
    emptySearch: {
        padding: 20,
        alignItems: "center",
    },
    emptySearchText: {
        fontSize: 16,
        color: colors.textLight,
    },
});
