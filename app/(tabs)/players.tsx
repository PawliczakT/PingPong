//app/(tabs)/players.tsx
import React, {useState} from "react";
import {FlatList, Pressable, StyleSheet, Text, TextInput, View} from "react-native";
import {useRouter} from "expo-router";
import {Search, Users, X} from "lucide-react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {colors} from "@/constants/colors";
import {usePlayerStore} from "@/store/playerStore";
import PlayerCard from "@/components/PlayerCard";
import EmptyState from "@/components/EmptyState";

export default function PlayersScreen() {
    const router = useRouter();
    const {players} = usePlayerStore();
    const [searchQuery, setSearchQuery] = useState("");

    const activePlayers = players.filter(player => player.active);

    const filteredPlayers = activePlayers.filter(player =>
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (player.nickname && player.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => b.eloRating - a.eloRating);

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

                {/* Temporarily disabled adding new players except during login
                <Button
                    title="Add Player"
                    onPress={() => router.push("/player/create")}
                    icon={<Plus size={18} color="#fff"/>}
                    size="small"
                />
                */}
            </View>

            {activePlayers.length > 0 ? (
                <FlatList
                    data={filteredPlayers}
                    keyExtractor={(item) => item.id}
                    renderItem={({item, index}) => (
                        <PlayerCard player={item} rank={index + 1}/>
                    )}
                    contentContainerStyle={styles.listContent}
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
                    /* Temporarily disabled adding new players except during login
                    actionLabel="Add Player"
                    onAction={() => router.push("/player/create")}
                    */
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
