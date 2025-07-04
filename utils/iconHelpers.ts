import {
    ArrowUp, Award, Crown, Flame, Medal, Star, Target, Trophy, Users, Zap,
    Award as Award2, Bolt, Crosshair, Gem, Heart, Moon, Shield,
    Shield as Shield2, Sparkles, Star as Star2, Sun, Sword, Swords,
    Target as Target2
} from "lucide-react-native";
import {AchievementType} from "../backend/types";
import {achievements} from "@constants/achievements";

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
        case "users":
            return Users;
        case "arrow-up":
            return ArrowUp;
        default:
            return Award;
    }
};

export const getRankIcon = (iconName: string) => {
    switch (iconName) {
        case "award":
            return Award;
        case "zap":
            return Zap;
        case "target":
            return Target;
        case "flame":
            return Flame;
        case "shield":
            return Shield;
        case "sword":
            return Sword;
        case "swords":
            return Swords;
        case "medal":
            return Medal;
        case "star":
            return Star;
        case "trophy":
            return Trophy;
        case "gem":
            return Gem;
        case "crown":
            return Crown;
        case "sparkles":
            return Sparkles;
        case "award2":
            return Award2;
        case "crosshair":
            return Crosshair;
        case "heart":
            return Heart;
        case "moon":
            return Moon;
        case "sun":
            return Sun;
        case "lightning":
            return Bolt;
        case "shield2":
            return Shield2;
        case "star2":
            return Star2;
        case "target2":
            return Target2;
        default:
            return Award;
    }
};
