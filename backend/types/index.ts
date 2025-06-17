//backend/types/index.ts
export interface Player {
    id: string;
    user_id?: string;
    name: string;
    nickname?: string;
    avatarUrl?: string;
    eloRating: number;
    wins: number;
    losses: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    rank?: {
        id: number;
        name: string;
        icon: string;
        requiredWins: number;
        color: string;
    };
    stats?: {
        winRate?: number;
        longestWinStreak?: number;
        [key: string]: any;
    };
}

export interface Set {
    player1Score: number;
    player2Score: number;
}

export interface Match {
    winnerId: number;
    id: string;
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    sets: Set[];
    date: string;
    tournamentId?: string;
    roundName?: string;
    winner?: string;
    isComplete?: boolean;
}

export enum TournamentFormat {
    KNOCKOUT = 'KNOCKOUT',
    ROUND_ROBIN = 'ROUND_ROBIN',
    DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
    GROUP = 'GROUP'
}

export enum TournamentStatus {
    UPCOMING = 'pending',
    IN_PROGRESS = 'active',
    COMPLETED = 'completed'
}

export interface Tournament {
    id: string;
    name: string;
    date: string;
    format: TournamentFormat;
    status: TournamentStatus;
    participants: string[];
    matches: TournamentMatch[];
    winner?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface TournamentMatch {
    id: string;
    tournamentId: string;
    round: number;
    group?: number;
    matchNumber?: number;
    player1Id: string | null;
    player2Id: string | null;
    player1Score: number | null;
    player2Score: number | null;
    winner: string | null;
    matchId: string | null;
    nextMatchId: string | null;
    status: 'pending' | 'scheduled' | 'completed' | 'bye';
    sets?: Set[];
}

export interface HeadToHead {
    player1Id: string;
    player2Id: string;
    player1Wins: number;
    player2Wins: number;
    matches: Match[];
    player1Sets?: number;
    player2Sets?: number;
    player1Points?: number;
    player2Points?: number;
    averagePointsPerMatch?: {
        player1: number;
        player2: number;
    } | null;
}

export interface RankingChange {
    id: string;
    playerId: string;
    oldRating: number;
    newRating: number;
    matchId: string;
    date: string;
}

export enum AchievementType {
    FIRST_WIN = 'first_win',
    WINS_10 = 'wins_10',
    WINS_25 = 'wins_25',
    WINS_50 = 'wins_50',
    MATCHES_10 = 'matches_10',
    MATCHES_25 = 'matches_25',
    MATCHES_50 = 'matches_50',
    MATCHES_100 = 'matches_100',
    WIN_STREAK_3 = 'win_streak_3',
    WIN_STREAK_5 = 'win_streak_5',
    WIN_STREAK_10 = 'win_streak_10',
    LONGEST_STREAK_5 = 'longest_streak_5',
    LONGEST_STREAK_10 = 'longest_streak_10',
    TOURNAMENT_WIN = 'tournament_win',
    TOURNAMENT_WINS_3 = 'tournament_wins_3',
    TOURNAMENT_WINS_5 = 'tournament_wins_5',
    CLEAN_SWEEP = 'clean_sweep',
    CLEAN_SWEEPS_5 = 'clean_sweeps_5',
    CLEAN_SWEEPS_10 = 'clean_sweeps_10',
    DEFEAT_TOP_PLAYER = 'defeat_top_player', // Defeat a player in the top 3 of the rankings
    DEFEAT_TOP_PLAYERS_5 = 'defeat_top_players_5',
    DEFEAT_TOP_PLAYERS_10 = 'defeat_top_players_10',

    // New achievement types (38)
    MATCHES_5 = 'matches_5',
    COMEBACK_KING = 'comeback_king', // Win match after being 2 sets down
    MARATHON_MATCH = 'marathon_match', // Play a 5-set match
    SOCIAL_BUTTERFLY_5 = 'social_butterfly_5', // Play against 5 different opponents
    LOSS_STREAK_3 = 'loss_streak_3', // Lose 3 matches in a row
    PERFECT_SET = 'perfect_set', // Win a set 11-0
    META_UNLOCK_5 = 'meta_unlock_5', // Unlock 5 other achievements
    CLUTCH_PERFORMER = 'clutch_performer', // Win a deciding set in a match
    TOURNAMENT_PARTICIPATE_3 = 'tournament_participate_3', // Participate in 3 different tournaments
    TOURNAMENT_PARTICIPATE_10 = 'tournament_participate_10', // Participate in 10 different tournaments
    SOCIAL_BUTTERFLY_10 = 'social_butterfly_10', // Play against 10 different opponents
    WIN_KNOCKOUT_TOURNAMENT = 'win_knockout_tournament',
    WIN_ROUND_ROBIN_TOURNAMENT = 'win_round_robin_tournament',
    WIN_GROUP_TOURNAMENT = 'win_group_tournament',
    TOURNAMENT_FINALIST = 'tournament_finalist', // Reach the final of any official tournament
    DEFEAT_TOP_SEED_TOURNAMENT = 'defeat_top_seed_tournament', // Defeat the top-seeded player in a tournament
    TOURNAMENT_WIN_FLAWLESS = 'tournament_win_flawless', // Win a tournament without losing a single match
    TOURNAMENT_HOST = 'tournament_host', // Create and start a tournament
    TOURNAMENT_SERIES = 'tournament_series', // Create tournament with auto-generated name
    TOURNAMENT_MULTI_FORMAT = 'tournament_multi_format', // Create tournaments in different formats
    TOURNAMENT_OVERSEER = 'tournament_overseer', // Complete 5 tournaments
    TOURNAMENT_PARTY = 'tournament_party', // Create tournament with 8+ participants
    TOURNAMENT_UNDERDOG = 'tournament_underdog', // Win against higher rated player in tournament
    DEUCE_SET_WIN = 'deuce_set_win', // Win a set that went to deuce
    SET_COMEBACK_5_POINTS = 'set_comeback_5_points', // Win a set after being down by 5 or more points
    NEAR_PERFECT_SET = 'near_perfect_set', // Win a set 11-1
    TOURNAMENT_RUNNER_UP_3 = 'tournament_runner_up_3', // Finish 2nd in 3 different tournaments
    HEARTBREAKER_LOSS = 'heartbreaker_loss', // Lose a match 10-12 in the deciding set
    STRATEGIST_WIN = 'strategist_win', // Win a match where every set played had a different score margin
    DOUBLE_DUTY_MATCHES = 'double_duty_matches', // Play 2 official matches in a single day
    BOUNCE_BACK_WIN = 'bounce_back_win', // Win a match immediately after losing the previous one
    META_UNLOCK_10 = 'meta_unlock_10',
    META_UNLOCK_15 = 'meta_unlock_15',
    META_UNLOCK_20 = 'meta_unlock_20',
    META_UNLOCK_25 = 'meta_unlock_25',
    META_UNLOCK_35 = 'meta_unlock_35',
    META_UNLOCK_40 = 'meta_unlock_40',
    MATCHES_75 = 'matches_75',
    TOURNAMENT_PARTICIPATE_5 = 'tournament_participate_5',
    RIVALRY_STARTER_3 = 'rivalry_starter_3', // Play the same opponent 3 times
    GRINDING_IT_OUT_10 = 'grinding_it_out_10', // Play 10 matches that go to a deciding set
    SOCIAL_BUTTERFLY_15 = 'social_butterfly_15', // Play against 15 different opponents
    TOURNAMENT_QUARTERFINALIST_3 = 'tournament_quarterfinalist_3', // Reach the quarter-finals in 3 different tournaments
    META_UNLOCK_ALL = 'meta_unlock_all', // Unlock all other 49 achievements
    PERFECT_GAME_FLAWLESS = 'perfect_game_flawless', // Win a match without opponent scoring any points in any set
    STRATEGIST = 'strategist', // Win a match with unique set margins (e.g., 11-5, 11-7, 11-9)
    HEARTBREAKER = 'heartbreaker', // Win a set 12-10 (or similar deuce point)
    BOUNCE_BACK_KING = 'bounce_back_king', // Win a match after losing the previous one
    MAX_MATCHES_DAY = 'max_matches_day', // Play X matches in a single day
    RIVALRY_MASTER = 'rivalry_master', // Defeat X unique opponents
    KNOCKOUT_WINNER = 'knockout_winner', // Win a knockout tournament
    ROUND_ROBIN_WINNER = 'round_robin_winner', // Win a round-robin tournament
    CHAMPION_NO_LOSSES = 'champion_no_losses', // Win a tournament without losing a single match
    ALWAYS_A_BRIDESMAID = 'always_a_bridesmaid', // Finish as runner-up X times

    // Meta Achievements
}

export interface Achievement {
    progress: number;
    unlocked: boolean;
    type: AchievementType;
    name: string;
    description: string;
    icon: string;
    target: number;
    unlockedAt?: string;
}

export interface DisplayAchievement extends Achievement {
    progress: number;
    unlocked: boolean;
    // unlockedAt is already optional in Achievement type
}

export interface AchievementProgress {
    type: AchievementType;
    progress: number;
    unlocked: boolean;
    unlockedAt: string | null;
}

export interface PlayerAchievement {
    playerId: string;
    achievementId: string;
    unlockedAt: string;
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'match' | 'tournament' | 'achievement' | 'ranking';
    read: boolean;
    data?: {
        match?: {
            id: string;
        };
        tournament?: {
            id: string;
        };
        player?: {
            id: string;
        };
    };
    createdAt: string;
}

export type NotificationRecord = {
    id: string;
    title: string;
    message: string;
    type: 'match' | 'tournament' | 'achievement' | 'ranking';
    read: boolean;
    data?: {
        match?: {
            id: string;
        };
        tournament?: {
            id: string;
        };
        player?: {
            id: string;
        };
    };
    createdAt: string;
};

export interface PendingMatch {
    id: string;
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    sets: Set[];
    createdAt: string;
}

export interface PlayerStreak {
    playerId: string;
    currentStreak: number;
    currentStreakType: 'win' | 'loss';
    longestWinStreak: number;
    longestLossStreak: number;
}

export interface NotificationSettings {
    matchResults: boolean;
    rankingChanges: boolean;
    tournamentUpdates: boolean;
    newTournaments: boolean;
    achievements: boolean;
}
