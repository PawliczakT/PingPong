import {Achievement, AchievementType} from "@/types";
import {Award, Crown, Flame, Medal, Star, Target, Trophy, Zap, Users, ArrowUp} from "lucide-react-native";

export const achievements: Achievement[] = [
    {
        type: AchievementType.FIRST_WIN,
        name: 'First Win',
        description: 'Win your first match.',
        icon: 'award',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WINS_10,
        name: '10 Wins',
        description: 'Win 10 matches.',
        icon: 'award',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.MATCHES_5,
        name: '5 Matches Played',
        description: 'Play 5 matches.',
        icon: 'zap',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WIN_STREAK_3,
        name: '3 Wins Streak',
        description: 'Win 3 matches in a row.',
        icon: 'flame',
        target: 3,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_WIN,
        name: 'Tournament Victory',
        description: 'Win an official tournament.',
        icon: 'trophy',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_HOST,
        name: 'Tournament Organizer',
        description: 'Create and start your first tournament.',
        icon: 'star',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_SERIES,
        name: 'Serial Organizer',
        description: 'Create a tournament with an auto-generated name.',
        icon: 'zap',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_MULTI_FORMAT,
        name: 'Format Explorer',
        description: 'Create tournaments in at least 2 different formats.',
        icon: 'target',
        target: 2,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_OVERSEER,
        name: 'The Tournament Master',
        description: 'Successfully complete 5 tournaments.',
        icon: 'crown',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_PARTY,
        name: 'The More The Merrier',
        description: 'Create a tournament with 8+ participants.',
        icon: 'users',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_UNDERDOG,
        name: 'The Underdog',
        description: 'Win a tournament match against a player with higher rating.',
        icon: 'arrow-up',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.COMEBACK_KING,
        name: 'Comeback King/Queen',
        description: 'Win a match after being 2 sets down.',
        icon: 'star',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.CLEAN_SWEEP,
        name: 'Flawless Victory',
        description: 'Win a match 3-0.',
        icon: 'star',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.MARATHON_MATCH,
        name: 'Marathon Match',
        description: 'Play a 5-set match (e.g., win or lose 3-2).',
        icon: 'zap',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.SOCIAL_BUTTERFLY_5,
        name: 'Social Butterfly',
        description: 'Play against 5 different opponents.',
        icon: 'zap',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.LOSS_STREAK_3,
        name: 'Participation Trophy',
        description: 'Oops! Lose 3 matches in a row.',
        icon: 'medal',
        target: 3,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.PERFECT_SET,
        name: 'Perfect Set',
        description: 'Win a set 11-0.',
        icon: 'star',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.META_UNLOCK_5,
        name: 'The Collector',
        description: 'Unlock 5 other achievements.',
        icon: 'crown',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WIN_STREAK_5,
        name: 'Dominator',
        description: 'Win 5 matches in a row.',
        icon: 'flame',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WIN_STREAK_10,
        name: 'Unstoppable',
        description: 'Win 10 matches in a row.',
        icon: 'flame',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WINS_25,
        name: 'Serial Winner',
        description: 'Win 25 matches in total.',
        icon: 'award',
        target: 25,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.CLUTCH_PERFORMER,
        name: 'Clutch Performer',
        description: 'Win a deciding set in a match.',
        icon: 'target',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.MATCHES_25,
        name: 'Enthusiast',
        description: 'Play 25 matches in total.',
        icon: 'zap',
        target: 25,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.MATCHES_50,
        name: 'Dedicated Player',
        description: 'Play 50 matches in total.',
        icon: 'zap',
        target: 50,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_PARTICIPATE_3,
        name: 'Tournament Regular',
        description: 'Participate in 3 different tournaments.',
        icon: 'trophy',
        target: 3,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_PARTICIPATE_10,
        name: 'Tournament Veteran',
        description: 'Participate in 10 different tournaments.',
        icon: 'trophy',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.SOCIAL_BUTTERFLY_10,
        name: 'Globetrotter',
        description: 'Play against 10 different opponents.',
        icon: 'zap',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WIN_KNOCKOUT_TOURNAMENT,
        name: 'Knockout Specialist',
        description: 'Win a Knockout format tournament.',
        icon: 'trophy',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WIN_ROUND_ROBIN_TOURNAMENT,
        name: 'Round Robin Ruler',
        description: 'Win a Round Robin format tournament.',
        icon: 'trophy',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WIN_GROUP_TOURNAMENT,
        name: 'Group Stage Guru',
        description: 'Win a Group format tournament.',
        icon: 'trophy',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_FINALIST,
        name: 'Podium Finish',
        description: 'Reach the final of any official tournament.',
        icon: 'medal',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.DEFEAT_TOP_SEED_TOURNAMENT,
        name: 'Giant Slayer (Tournament)',
        description: 'Defeat the top-seeded player in a tournament.',
        icon: 'target',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_WIN_FLAWLESS,
        name: 'Invincible Champion',
        description: 'Win a tournament without losing a single match.',
        icon: 'crown',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.DEUCE_SET_WIN,
        name: 'Deuce Master',
        description: 'Win a set that went to deuce (e.g., 12-10).',
        icon: 'star',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.SET_COMEBACK_5_POINTS,
        name: 'Set Comeback Pro',
        description: 'Win a set after being down by 5 or more points.',
        icon: 'star',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.NEAR_PERFECT_SET,
        name: 'Near Perfect Set',
        description: 'Win a set 11-1.',
        icon: 'star',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_RUNNER_UP_3,
        name: 'Always a Bridesmaid',
        description: 'Finish 2nd in 3 different tournaments.',
        icon: 'medal',
        target: 3,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.HEARTBREAKER_LOSS,
        name: 'Heartbreaker Loss',
        description: 'Lose a match 10-12 in the deciding set.',
        icon: 'medal',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.STRATEGIST_WIN,
        name: 'The Strategist',
        description: 'Win a match where every set played had a different score margin.',
        icon: 'award',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.DOUBLE_DUTY_MATCHES,
        name: 'Double Duty',
        description: 'Play 2 official matches in a single day.',
        icon: 'zap',
        target: 2,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.BOUNCE_BACK_WIN,
        name: 'Bounce Back',
        description: 'Win a match immediately after losing the previous one.',
        icon: 'flame',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.META_UNLOCK_10,
        name: 'Achievement Hunter',
        description: 'Unlock 10 achievements in total.',
        icon: 'crown',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.META_UNLOCK_20,
        name: 'Master Achiever',
        description: 'Unlock 20 achievements in total.',
        icon: 'crown',
        target: 20,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.META_UNLOCK_35,
        name: 'Legendary Achiever',
        description: 'Unlock 35 achievements in total.',
        icon: 'crown',
        target: 35,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.META_UNLOCK_15,
        name: 'The Completist (Bronze)',
        description: 'Unlock 15 achievements.',
        icon: 'crown',
        target: 15,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.META_UNLOCK_25,
        name: 'The Completist (Silver)',
        description: 'Unlock 25 achievements.',
        icon: 'crown',
        target: 25,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.META_UNLOCK_40,
        name: 'The Completist (Gold)',
        description: 'Unlock 40 achievements.',
        icon: 'crown',
        target: 40,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.MATCHES_75,
        name: 'Ping Pong Fanatic',
        description: 'Play 75 matches.',
        icon: 'zap',
        target: 75,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_PARTICIPATE_5,
        name: 'Tournament Fiend',
        description: 'Participate in 5 tournaments.',
        icon: 'trophy',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.RIVALRY_STARTER_3,
        name: 'Rivalry Starter',
        description: 'Play the same opponent 3 times.',
        icon: 'target',
        target: 3,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.MATCHES_100,
        name: 'Century Player',
        description: 'Play 100 matches.',
        icon: 'zap',
        target: 100,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.CLEAN_SWEEPS_5,
        name: 'Decisive Victor',
        description: 'Win 5 matches by a 3-0 scoreline.',
        icon: 'star',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.GRINDING_IT_OUT_10,
        name: 'Grinding It Out',
        description: 'Play 10 matches that go to a deciding set.',
        icon: 'flame',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.SOCIAL_BUTTERFLY_15,
        name: 'The Diplomat',
        description: 'Play against 15 different opponents.',
        icon: 'zap',
        target: 15,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_QUARTERFINALIST_3,
        name: 'Tournament Trailblazer',
        description: 'Reach the quarter-finals in 3 different tournaments.',
        icon: 'trophy',
        target: 3,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.WINS_50,
        name: '50 Wins Club',
        description: 'Win 50 matches.',
        icon: 'award',
        target: 50,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.MATCHES_10,
        name: '10 Matches Milestone',
        description: 'Play 10 matches.',
        icon: 'zap',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.LONGEST_STREAK_5,
        name: 'Streak Master (5)',
        description: 'Achieve a win streak of 5.',
        icon: 'flame',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.LONGEST_STREAK_10,
        name: 'Streak Legend (10)',
        description: 'Achieve a win streak of 10.',
        icon: 'flame',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_WINS_3,
        name: 'Tournament Trio',
        description: 'Win 3 official tournaments.',
        icon: 'trophy',
        target: 3,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.TOURNAMENT_WINS_5,
        name: 'Tournament Quintet',
        description: 'Win 5 official tournaments.',
        icon: 'trophy',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.CLEAN_SWEEPS_10,
        name: 'Sweeper Supreme',
        description: 'Achieve 10 clean sweep victories (3-0).',
        icon: 'star',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.DEFEAT_TOP_PLAYER,
        name: 'Top Player Toppler',
        description: 'Defeat a player ranked in the top 3.',
        icon: 'target',
        target: 1,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.DEFEAT_TOP_PLAYERS_5,
        name: 'Elite Hunter (5)',
        description: 'Defeat 5 different top 3 ranked players.',
        icon: 'target',
        target: 5,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.DEFEAT_TOP_PLAYERS_10,
        name: 'Elite Hunter (10)',
        description: 'Defeat 10 different top 3 ranked players.',
        icon: 'target',
        target: 10,
        progress: 0,
        unlocked: false
    },
    {
        type: AchievementType.META_UNLOCK_ALL,
        name: 'Ultimate Ping Pong God',
        description: 'Unlock all other 59 achievements.',
        icon: 'crown',
        target: 59,
        progress: 0,
        unlocked: false
    }
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
        case "users":
            return Users;
        case "arrow-up":
            return ArrowUp;
        default:
            return Award;
    }
};
