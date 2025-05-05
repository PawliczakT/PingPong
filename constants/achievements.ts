import {Achievement, AchievementType} from "@/types";
import {Award, Crown, Flame, Medal, Star, Target, Trophy, Zap} from "lucide-react-native";

export const achievements: Achievement[] = [
    {
        type: AchievementType.FIRST_WIN,
        name: "First Victory",
        description: "Win your first match",
        icon: "award",
        target: 1,
    },
    {
        type: AchievementType.WINS_10,
        name: "Consistent Winner",
        description: "Win 10 matches",
        icon: "award",
        target: 10,
    },
    {
        type: AchievementType.WINS_25,
        name: "Victory Machine",
        description: "Win 25 matches",
        icon: "award",
        target: 25,
    },
    {
        type: AchievementType.WINS_50,
        name: "Ping Pong Master",
        description: "Win 50 matches",
        icon: "award",
        target: 50,
    },
    {
        type: AchievementType.MATCHES_10,
        name: "Getting Started",
        description: "Play 10 matches",
        icon: "zap",
        target: 10,
    },
    {
        type: AchievementType.MATCHES_25,
        name: "Regular Player",
        description: "Play 25 matches",
        icon: "zap",
        target: 25,
    },
    {
        type: AchievementType.MATCHES_50,
        name: "Dedicated Player",
        description: "Play 50 matches",
        icon: "zap",
        target: 50,
    },
    {
        type: AchievementType.MATCHES_100,
        name: "Ping Pong Veteran",
        description: "Play 100 matches",
        icon: "zap",
        target: 100,
    },
    {
        type: AchievementType.WIN_STREAK_3,
        name: "On Fire",
        description: "Win 3 matches in a row",
        icon: "flame",
        target: 3,
    },
    {
        type: AchievementType.WIN_STREAK_5,
        name: "Unstoppable",
        description: "Win 5 matches in a row",
        icon: "flame",
        target: 5,
    },
    {
        type: AchievementType.WIN_STREAK_10,
        name: "Legendary Streak",
        description: "Win 10 matches in a row",
        icon: "flame",
        target: 10,
    },
    {
        type: AchievementType.LONGEST_STREAK_5,
        name: "Streak Master",
        description: "Achieve a 5-match winning streak",
        icon: "flame",
        target: 5,
    },
    {
        type: AchievementType.LONGEST_STREAK_10,
        name: "Streak Legend",
        description: "Achieve a 10-match winning streak",
        icon: "flame",
        target: 10,
    },
    {
        type: AchievementType.TOURNAMENT_WIN,
        name: "Tournament Champion",
        description: "Win a tournament",
        icon: "trophy",
        target: 1,
    },
    {
        type: AchievementType.TOURNAMENT_WINS_3,
        name: "Serial Champion",
        description: "Win 3 tournaments",
        icon: "trophy",
        target: 3,
    },
    {
        type: AchievementType.TOURNAMENT_WINS_5,
        name: "Tournament Legend",
        description: "Win 5 tournaments",
        icon: "trophy",
        target: 5,
    },
    {
        type: AchievementType.CLEAN_SWEEP,
        name: "Clean Sweep",
        description: "Win a match without losing a set",
        icon: "star",
        target: 1,
    },
    {
        type: AchievementType.CLEAN_SWEEPS_5,
        name: "Dominator",
        description: "Win 5 matches without losing a set",
        icon: "star",
        target: 5,
    },
    {
        type: AchievementType.CLEAN_SWEEPS_10,
        name: "Perfect Player",
        description: "Win 10 matches without losing a set",
        icon: "star",
        target: 10,
    },
    {
        type: AchievementType.DEFEAT_TOP_PLAYER,
        name: "Giant Slayer",
        description: "Defeat a player in the top 3 of the rankings",
        icon: "target",
        target: 1,
    },
    {
        type: AchievementType.DEFEAT_TOP_PLAYERS_5,
        name: "Elite Killer",
        description: "Defeat players in the top 3 of the rankings 5 times",
        icon: "target",
        target: 5,
    },
    {
        type: AchievementType.DEFEAT_TOP_PLAYERS_10,
        name: "Champion Slayer",
        description: "Defeat players in the top 3 of the rankings 10 times",
        icon: "target",
        target: 10,
    },
];

export const getAchievementIcon = (type: AchievementType) => {
    const achievement = achievements.find(a => a.type === type);

    switch (achievement?.icon) {
        case "trophy":
            return Trophy;
        case "zap":
            return Zap;
        case "target":
            return Target;
        case "medal":
            return Medal;
        case "flame":
            return Flame;
        case "crown":
            return Crown;
        case "star":
            return Star;
        case "award":
        default:
            return Award;
    }
};
