import React from "react";
import {StyleSheet, Text, View} from "react-native";
import {colors} from "@/constants/colors";
import {Achievement} from "@/types";
import {getAchievementIcon} from "@/constants/achievements";

type AchievementBadgeProps = {
    achievement: Achievement;
    size?: "small" | "medium" | "large";
    unlocked?: boolean;
    progress?: number;
    showProgress?: boolean;
};

export default function AchievementBadge({
                                             achievement,
                                             size = "medium",
                                             unlocked = true,
                                             progress = 0,
                                             showProgress = false,
                                         }: AchievementBadgeProps) {
    const Icon = getAchievementIcon(achievement.type);

    const getSize = () => {
        switch (size) {
            case "small":
                return {badge: 60, icon: 24};
            case "large":
                return {badge: 100, icon: 40};
            case "medium":
            default:
                return {badge: 80, icon: 32};
        }
    };

    const {badge: badgeSize, icon: iconSize} = getSize();

    const progressPercentage = Math.min(100, Math.round((progress / achievement.target) * 100));

    return (
        <View style={[
            styles.container,
            {width: badgeSize, height: badgeSize},
            !unlocked && styles.locked
        ]}>
            <View style={styles.iconContainer}>
                <Icon size={iconSize} color={unlocked ? colors.primary : colors.inactive}/>
            </View>

            {showProgress && !unlocked && (
                <View style={styles.progressContainer}>
                    <View
                        style={[
                            styles.progressBar,
                            {width: `${progressPercentage}%`}
                        ]}
                    />
                    <Text style={styles.progressText}>
                        {progress}/{achievement.target}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 100,
        backgroundColor: colors.card,
        justifyContent: "center",
        alignItems: "center",

        elevation: 2,
        margin: 8,
    },
    locked: {
        opacity: 0.6,
        backgroundColor: colors.border,
    },
    iconContainer: {
        justifyContent: "center",
        alignItems: "center",
    },
    progressContainer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 20,
        backgroundColor: "rgba(0, 0, 0, 0.1)",
        borderBottomLeftRadius: 100,
        borderBottomRightRadius: 100,
        overflow: "hidden",
    },
    progressBar: {
        position: "absolute",
        top: 0,
        left: 0,
        height: "100%",
        backgroundColor: colors.primary + "40",
    },
    progressText: {
        fontSize: 10,
        color: colors.text,
        textAlign: "center",
        fontWeight: "bold",
    },
});
