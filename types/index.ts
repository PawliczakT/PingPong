export interface Player {
    id: string;
    name: string;
    nickname?: string;
    avatarUrl?: string;
    eloRating: number;
    wins: number;
    losses: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
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
    DEFEAT_TOP_PLAYER = 'defeat_top_player',
    DEFEAT_TOP_PLAYERS_5 = 'defeat_top_players_5',
    DEFEAT_TOP_PLAYERS_10 = 'defeat_top_players_10'
}

export interface Achievement {
    type: AchievementType;
    name: string;
    description: string;
    icon: string;
    target: number;
    unlockedAt?: string;
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
