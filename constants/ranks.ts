import {
    Award,
    Crown,
    Flame,
    Gem,
    Medal,
    Shield,
    Star,
    Sword,
    Swords,
    Target,
    Trophy,
    Zap,
    Sparkles,
    Award as Award2,
    Crosshair,
    Heart,
    Moon,
    Sun,
    Bolt,
    Shield as Shield2,
    Star as Star2,
    Target as Target2
} from "lucide-react-native";

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
    },
    {
        id: 13,
        name: "Mythic",
        icon: "sparkles",
        requiredWins: 275,
        color: "#9B59B6" // Purple
    },
    {
        id: 14,
        name: "Titan",
        icon: "award2",
        requiredWins: 375,
        color: "#9B59B6" // Purple
    },
    {
        id: 15,
        name: "Immortal",
        icon: "crosshair",
        requiredWins: 500,
        color: "#9B59B6" // Purple
    },
    {
        id: 16,
        name: "Celestial",
        icon: "star2",
        requiredWins: 650,
        color: "#E74C3C" // Red
    },
    {
        id: 17,
        name: "Phoenix",
        icon: "flame",
        requiredWins: 850,
        color: "#E74C3C" // Red
    },
    {
        id: 18,
        name: "Dragon",
        icon: "sword",
        requiredWins: 1100,
        color: "#E74C3C" // Red
    },
    {
        id: 19,
        name: "Eternal",
        icon: "heart",
        requiredWins: 1400,
        color: "#E91E63" // Pink
    },
    {
        id: 20,
        name: "Transcendent",
        icon: "moon",
        requiredWins: 1800,
        color: "#E91E63" // Pink
    },
    {
        id: 21,
        name: "Divine",
        icon: "sun",
        requiredWins: 2300,
        color: "#E91E63" // Pink
    },
    {
        id: 22,
        name: "Supreme",
        icon: "lightning",
        requiredWins: 3000,
        color: "#2ECC71" // Green
    },
    {
        id: 23,
        name: "Cosmic",
        icon: "shield2",
        requiredWins: 4000,
        color: "#2ECC71" // Green
    },
    {
        id: 24,
        name: "Ultimate",
        icon: "target2",
        requiredWins: 5000,
        color: "#2ECC71" // Green
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
