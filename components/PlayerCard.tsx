//components/PlayerCard.tsx
import React from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {ArrowRight} from "lucide-react-native";
import PlayerAvatar from "./PlayerAvatar";
import {Player} from "@/backend/types";
import {colors} from "@/constants/colors";
import {formatWinRate} from "@/utils/formatters";

type PlayerCardProps = {
    player: Player;
    rank?: number;
    showStats?: boolean;
    statValue?: string | number;
    statLabel?: string;
    onPress?: () => void;
};

export default function PlayerCard({
                                       player,
                                       rank,
                                       showStats = true,
                                       statValue,
                                       statLabel,
                                       onPress
                                   }: PlayerCardProps) {
    const router = useRouter();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            router.push(`/player/${player.id}`);
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
            {rank && (
                <View style={styles.rankContainer}>
                    <Text style={styles.rankText}>{rank}</Text>
                </View>
            )}

            <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size={50}/>

            <View style={styles.infoContainer}>
                <Text style={styles.name}>{player.name}</Text>
                {player.nickname && (
                    <Text style={styles.nickname}>"{player.nickname}"</Text>
                )}

                {showStats && !statValue && (
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{player.eloRating}</Text>
                            <Text style={styles.statLabel}>ELO</Text>
                        </View>

                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{player.wins}</Text>
                            <Text style={styles.statLabel}>Wins</Text>
                        </View>

                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{player.losses}</Text>
                            <Text style={styles.statLabel}>Losses</Text>
                        </View>

                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {formatWinRate(player.wins, player.losses)}
                            </Text>
                            <Text style={styles.statLabel}>Win Rate</Text>
                        </View>
                    </View>
                )}

                {statLabel && (
                    <View style={styles.customStatContainer}>
                        <Text style={styles.customStatValue}>{statValue || ''}</Text>
                        <Text style={styles.customStatLabel}>{statLabel}</Text>
                    </View>
                )}
            </View>

            <ArrowRight size={20} color={colors.textLight}/>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,

        elevation: 2,
    },
    pressed: {
        opacity: 0.8,
        backgroundColor: colors.highlight,
    },
    rankContainer: {
        width: 24,
        alignItems: "center",
        marginRight: 10,
    },
    rankText: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.textLight,
    },
    infoContainer: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
    },
    nickname: {
        fontSize: 14,
        color: colors.textLight,
        marginBottom: 4,
    },
    statsContainer: {
        flexDirection: "row",
        marginTop: 6,
    },
    statItem: {
        marginRight: 12,
    },
    statValue: {
        fontSize: 14,
        fontWeight: "bold",
        color: colors.text,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textLight,
    },
    customStatContainer: {
        marginTop: 6,
    },
    customStatValue: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.primary,
    },
    customStatLabel: {
        fontSize: 12,
        color: colors.textLight,
    },
});
