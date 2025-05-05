import React from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {ArrowRight, Calendar, Trophy, Users} from "lucide-react-native";
import {Tournament, TournamentStatus} from "@/types";
import {colors} from "@/constants/colors";
import {formatDate} from "@/utils/formatters";
import {usePlayerStore} from "@/store/playerStore";

type TournamentCardProps = {
    tournament: Tournament;
    onPress?: () => void;
};

export default function TournamentCard({tournament, onPress}: TournamentCardProps) {
    const router = useRouter();
    const {getPlayerById} = usePlayerStore();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            router.push(`/tournament/${tournament.id}`);
        }
    };

    const getStatusColor = () => {
        switch (tournament.status) {
            case TournamentStatus.UPCOMING:
                return colors.primary;
            case TournamentStatus.IN_PROGRESS:
                return colors.warning;
            case TournamentStatus.COMPLETED:
                return colors.success;
            default:
                return colors.textLight;
        }
    };

    const getStatusText = () => {
        switch (tournament.status) {
            case TournamentStatus.UPCOMING:
                return "Upcoming";
            case TournamentStatus.IN_PROGRESS:
                return "In Progress";
            case TournamentStatus.COMPLETED:
                return "Completed";
            default:
                return "";
        }
    };

    return (
        <Pressable
            style={({pressed}) => [
                styles.container,
                pressed && styles.pressed
            ]}
            onPress={handlePress}
        >
            <View style={styles.header}>
                <Text style={styles.name}>{tournament.name}</Text>
                <View style={[styles.statusBadge, {backgroundColor: getStatusColor()}]}>
                    <Text style={styles.statusText}>{getStatusText()}</Text>
                </View>
            </View>

            <View style={styles.infoContainer}>
                <View style={styles.infoItem}>
                    <Calendar size={16} color={colors.textLight}/>
                    <Text style={styles.infoText}>{formatDate(tournament.date)}</Text>
                </View>

                <View style={styles.infoItem}>
                    <Users size={16} color={colors.textLight}/>
                    <Text style={styles.infoText}>{tournament.participants.length} players</Text>
                </View>

                {tournament.winner && (
                    <View style={styles.infoItem}>
                        <Trophy size={16} color={colors.success}/>
                        <Text style={[styles.infoText, {color: colors.success}]}>
                            {getPlayerById(tournament.winner)?.name || "Unknown"}
                        </Text>
                    </View>
                )}
            </View>

            <ArrowRight size={20} color={colors.textLight} style={styles.arrow}/>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    pressed: {
        opacity: 0.8,
        backgroundColor: colors.highlight,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    name: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "bold",
    },
    infoContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    infoItem: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 16,
        marginBottom: 4,
    },
    infoText: {
        fontSize: 14,
        color: colors.textLight,
        marginLeft: 4,
    },
    arrow: {
        position: "absolute",
        right: 16,
        top: "50%",
        marginTop: -10,
    },
});
