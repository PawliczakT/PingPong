import React from "react";
import {Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {ChevronDown, User} from "lucide-react-native";
import {colors} from "@/constants/colors";
import {Player} from "@/types";
import PlayerAvatar from "./PlayerAvatar";

interface PlayerSelectorProps {
    label: string;
    value: Player | null;
    players: Player[];
    onChange: (player: Player) => void;
    excludePlayerId?: string;
}

export default function PlayerSelector({
                                           label,
                                           value,
                                           players,
                                           onChange,
                                           excludePlayerId,
                                       }: PlayerSelectorProps) {
    const [isModalVisible, setIsModalVisible] = React.useState(false);

    const filteredPlayers = excludePlayerId
        ? players.filter(player => player.id !== excludePlayerId)
        : players;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>

            <TouchableOpacity
                style={styles.selector}
                onPress={() => setIsModalVisible(true)}
            >
                {value ? (
                    <View style={styles.selectedPlayer}>
                        <PlayerAvatar name={value.name} avatarUrl={value.avatarUrl} size={32}/>
                        <Text style={styles.playerName}>{value.name}</Text>
                    </View>
                ) : (
                    <View style={styles.placeholder}>
                        <User size={20} color={colors.textLight}/>
                        <Text style={styles.placeholderText}>Select Player</Text>
                    </View>
                )}

                <ChevronDown size={20} color={colors.textLight}/>
            </TouchableOpacity>

            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select {label}</Text>

                        <ScrollView style={styles.playersList}>
                            {filteredPlayers.length > 0 ? (
                                filteredPlayers.map(player => (
                                    <TouchableOpacity
                                        key={player.id}
                                        style={styles.playerItem}
                                        onPress={() => {
                                            onChange(player);
                                            setIsModalVisible(false);
                                        }}
                                    >
                                        <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size={40}/>
                                        <View style={styles.playerInfo}>
                                            <Text style={styles.playerItemName}>{player.name}</Text>
                                            <Text style={styles.playerRating}>Rating: {player.eloRating}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={styles.noPlayersText}>No players available</Text>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setIsModalVisible(false)}
                        >
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 8,
    },
    selector: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    selectedPlayer: {
        flexDirection: "row",
        alignItems: "center",
    },
    playerName: {
        fontSize: 16,
        color: colors.text,
        marginLeft: 12,
    },
    placeholder: {
        flexDirection: "row",
        alignItems: "center",
    },
    placeholderText: {
        fontSize: 16,
        color: colors.textLight,
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 16,
        maxHeight: "80%",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 16,
        textAlign: "center",
    },
    playersList: {
        maxHeight: 400,
    },
    playerItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    playerInfo: {
        marginLeft: 12,
    },
    playerItemName: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
    },
    playerRating: {
        fontSize: 14,
        color: colors.textLight,
        marginTop: 2,
    },
    closeButton: {
        marginTop: 16,
        backgroundColor: colors.card,
        padding: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.primary,
    },
    noPlayersText: {
        fontSize: 16,
        color: colors.textLight,
        textAlign: "center",
        padding: 20,
    },
});
