import {Award, Crown, Flame, Gem, Medal, Shield, Star, Sword, Swords, Target, Trophy, Zap} from "lucide-react-native";

export interface Rank {
    id: number;
    name: string;
    icon: string;
    requiredWins: number;
    color: string;
}

export const ranks: Rank[] = [
    {
        id: 1,
        name: "Beginner",
        icon: "award",
        requiredWins: 0,
        color: "#8E8E8E" // Gray
    },
    {
        id: 2,
        name: "Novice",
        icon: "zap",
        requiredWins: 3,
        color: "#CD7F32" // Bronze
    },
    {
        id: 3,
        name: "Amateur",
        icon: "target",
        requiredWins: 7,
        color: "#CD7F32" // Bronze
    },
    {
        id: 4,
        name: "Competitor",
        icon: "flame",
        requiredWins: 12,
        color: "#C0C0C0" // Silver
    },
    {
        id: 5,
        name: "Skilled",
        icon: "shield",
        requiredWins: 18,
        color: "#C0C0C0" // Silver
    },
    {
        id: 6,
        name: "Expert",
        icon: "sword",
        requiredWins: 25,
        color: "#C0C0C0" // Silver
    },
    {
        id: 7,
        name: "Veteran",
        icon: "swords",
        requiredWins: 35,
        color: "#FFD700" // Gold
    },
    {
        id: 8,
        name: "Master",
        icon: "medal",
        requiredWins: 50,
        color: "#FFD700" // Gold
    },
    {
        id: 9,
        name: "Elite",
        icon: "star",
        requiredWins: 75,
        color: "#FFD700" // Gold
    },
    {
        id: 10,
        name: "Champion",
        icon: "trophy",
        requiredWins: 100,
        color: "#B9F2FF" // Diamond
    },
    {
        id: 11,
        name: "Legend",
        icon: "gem",
        requiredWins: 150,
        color: "#B9F2FF" // Diamond
    },
    {
        id: 12,
        name: "Grandmaster",
        icon: "crown",
        requiredWins: 200,
        color: "#B9F2FF" // Diamond
    }
];

export const getRankByWins = (wins: number): Rank => {
    // Find the highest rank that the player qualifies for
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (wins >= ranks[i].requiredWins) {
            return ranks[i];
        }
    }
    // Default to the first rank if no match (should never happen as first rank requires 0 wins)
    return ranks[0];
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
        default:
            return Award;
    }
};
