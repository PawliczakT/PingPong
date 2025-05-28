import React from "react";
import {StyleSheet, View} from "react-native";
import {getRankIcon, Rank} from "@/constants/ranks";

type RankBadgeProps = {
    rank: Rank;
    size?: "small" | "medium" | "large";
};

export default function RankBadge({
                                      rank,
                                      size = "small",
                                  }: RankBadgeProps) {
    const Icon = getRankIcon(rank.icon);

    const getSize = () => {
        switch (size) {
            case "small":
                return {badge: 24, icon: 14};
            case "large":
                return {badge: 48, icon: 24};
            case "medium":
            default:
                return {badge: 32, icon: 18};
        }
    };

    const {badge: badgeSize, icon: iconSize} = getSize();

    return (
        <View
            style={[
                styles.container,
                {
                    width: badgeSize,
                    height: badgeSize,
                    backgroundColor: rank.color + "40", // Add transparency
                    borderColor: rank.color,
                },
            ]}
        >
            <Icon size={iconSize} color={rank.color}/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 100,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        marginHorizontal: 4,
    },
});
