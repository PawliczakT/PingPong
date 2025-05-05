import React from "react";
import {StyleSheet, Text, View} from "react-native";
import {colors} from "@/constants/colors";
import {HeadToHead} from "@/types";
import {usePlayerStore} from "@/store/playerStore";
import PlayerAvatar from "./PlayerAvatar";

type HeadToHeadStatsProps = {
    headToHead: HeadToHead;
};

export default function HeadToHeadStats({headToHead}: HeadToHeadStatsProps) {
    const {getPlayerById} = usePlayerStore();

    const player1 = getPlayerById(headToHead.player1Id);
    const player2 = getPlayerById(headToHead.player2Id);

    if (!player1 || !player2) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Player data not found</Text>
            </View>
        );
    }

    const totalMatches = headToHead.player1Wins + headToHead.player2Wins;
    const player1WinRate = totalMatches > 0
        ? Math.round((headToHead.player1Wins / totalMatches) * 100)
        : 0;
    const player2WinRate = totalMatches > 0
        ? Math.round((headToHead.player2Wins / totalMatches) * 100)
        : 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.playerInfo}>
                    <PlayerAvatar name={player1.name} avatarUrl={player1.avatarUrl} size={40}/>
                    <Text style={styles.playerName}>{player1.name}</Text>
                </View>

                <View style={styles.vsContainer}>
                    <Text style={styles.vsText}>VS</Text>
                </View>

                <View style={styles.playerInfo}>
                    <PlayerAvatar name={player2.name} avatarUrl={player2.avatarUrl} size={40}/>
                    <Text style={styles.playerName}>{player2.name}</Text>
                </View>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statRow}>
                    <Text style={styles.statValue}>{headToHead.player1Wins}</Text>
                    <Text style={styles.statLabel}>Matches Won</Text>
                    <Text style={styles.statValue}>{headToHead.player2Wins}</Text>
                </View>

                <View style={styles.winRateContainer}>
                    <View style={[
                        styles.winRateBar,
                        styles.player1Bar,
                        {width: `${player1WinRate}%`}
                    ]}/>
                    <View style={[
                        styles.winRateBar,
                        styles.player2Bar,
                        {width: `${player2WinRate}%`, right: 0}
                    ]}/>
                    <Text style={styles.winRateText}>{player1WinRate}% - {player2WinRate}%</Text>
                </View>

                {headToHead.player1Sets !== undefined && headToHead.player2Sets !== undefined && (
                    <View style={styles.statRow}>
                        <Text style={styles.statValue}>{headToHead.player1Sets}</Text>
                        <Text style={styles.statLabel}>Sets Won</Text>
                        <Text style={styles.statValue}>{headToHead.player2Sets}</Text>
                    </View>
                )}

                {headToHead.player1Points !== undefined && headToHead.player2Points !== undefined && (
                    <View style={styles.statRow}>
                        <Text style={styles.statValue}>{headToHead.player1Points}</Text>
                        <Text style={styles.statLabel}>Total Points</Text>
                        <Text style={styles.statValue}>{headToHead.player2Points}</Text>
                    </View>
                )}

                {headToHead.averagePointsPerMatch && (
                    <View style={styles.statRow}>
                        <Text style={styles.statValue}>
                            {headToHead.averagePointsPerMatch.player1.toFixed(1)}
                        </Text>
                        <Text style={styles.statLabel}>Avg Points/Match</Text>
                        <Text style={styles.statValue}>
                            {headToHead.averagePointsPerMatch.player2.toFixed(1)}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.matchesInfo}>
                <Text style={styles.matchesText}>
                    {totalMatches} match{totalMatches !== 1 ? 'es' : ''} played
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    playerInfo: {
        alignItems: "center",
        width: "40%",
    },
    playerName: {
        fontSize: 14,
        fontWeight: "bold",
        color: colors.text,
        marginTop: 8,
        textAlign: "center",
    },
    vsContainer: {
        width: "20%",
        alignItems: "center",
    },
    vsText: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.textLight,
    },
    statsContainer: {
        marginBottom: 16,
    },
    statRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    statLabel: {
        fontSize: 14,
        color: colors.textLight,
        textAlign: "center",
    },
    statValue: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
        width: "30%",
        textAlign: "center",
    },
    winRateContainer: {
        height: 24,
        backgroundColor: colors.background,
        borderRadius: 12,
        marginVertical: 12,
        position: "relative",
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },
    winRateBar: {
        position: "absolute",
        top: 0,
        height: "100%",
    },
    player1Bar: {
        left: 0,
        backgroundColor: colors.primary + "80",
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
    },
    player2Bar: {
        backgroundColor: colors.secondary + "80",
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
    },
    winRateText: {
        fontSize: 12,
        fontWeight: "bold",
        color: colors.text,
    },
    matchesInfo: {
        alignItems: "center",
    },
    matchesText: {
        fontSize: 14,
        color: colors.textLight,
    },
    errorText: {
        fontSize: 16,
        color: colors.error,
        textAlign: "center",
        padding: 16,
    },
});
