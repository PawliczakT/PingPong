//utils/elo.ts
export type PlayerId = string;

export interface PlayerStats {
    rating: number;
    gamesPlayed: number;
    dailyDelta: number;
    lastMatchDay: string;
}

export interface MatchRecord {
    winner: PlayerId;
    loser: PlayerId;
    date: Date;
}

export interface EloOptions {
    kNewbie?: number;
    kIntermediate?: number;
    kPro?: number;
    decayThreshold1?: number;
    decayThreshold2?: number;
    maxDailyDelta?: number;
    scale?: number;
    initialRating?: number;
}

export class RatingElo {
    private players: Map<PlayerId, PlayerStats>;
    private readonly opts: Required<EloOptions>;

    constructor(options?: EloOptions) {
        this.opts = {
            kNewbie: 32,
            kIntermediate: 16,
            kPro: 8,
            decayThreshold1: 100,
            decayThreshold2: 300,
            maxDailyDelta: 100,
            scale: 400,
            initialRating: 1500,
            ...options,
        };
        this.players = new Map();
    }

    public ensurePlayer(id: PlayerId): void {
        if (!this.players.has(id)) {
            this.players.set(id, {
                rating: this.opts.initialRating,
                gamesPlayed: 0,
                dailyDelta: 0,
                lastMatchDay: '',
            });
        }
    }

    private currentK(games: number): number {
        if (games < this.opts.decayThreshold1) return this.opts.kNewbie;
        if (games < this.opts.decayThreshold2) return this.opts.kIntermediate;
        return this.opts.kPro;
    }

    private probability(rA: number, rB: number): number {
        return 1 / (1 + Math.pow(10, (rB - rA) / this.opts.scale));
    }

    public updateMatch(match: MatchRecord): void {
        if (!match.winner || !match.loser) {
            throw new Error('No winner or loser specified ');
        }

        if (match.winner === match.loser) {
            throw new Error('Player cannot play against himself');
        }

        if (!match.date || match.date > new Date()) {
            throw new Error('Wrong date specified');
        }

        const dayKey = match.date.toISOString().slice(0, 10);

        this.ensurePlayer(match.winner);
        this.ensurePlayer(match.loser);

        const winner = this.players.get(match.winner)!;
        const loser = this.players.get(match.loser)!;

        if (winner.lastMatchDay !== dayKey) winner.dailyDelta = 0;
        if (loser.lastMatchDay !== dayKey) loser.dailyDelta = 0;

        const pWin = this.probability(winner.rating, loser.rating);
        const kWinner = this.currentK(winner.gamesPlayed);
        const kLoser = this.currentK(loser.gamesPlayed);

        const deltaWinner = kWinner * (1 - pWin);
        const deltaLoser = kLoser * (0 - (1 - pWin));

        const allowedWinner =
            Math.max(
                -this.opts.maxDailyDelta - winner.dailyDelta,
                Math.min(this.opts.maxDailyDelta - winner.dailyDelta, deltaWinner),
            );
        const allowedLoser =
            Math.max(
                -this.opts.maxDailyDelta - loser.dailyDelta,
                Math.min(this.opts.maxDailyDelta - loser.dailyDelta, deltaLoser),
            );

        winner.rating += allowedWinner;
        loser.rating += allowedLoser;

        winner.gamesPlayed += 1;
        loser.gamesPlayed += 1;

        winner.dailyDelta += allowedWinner;
        loser.dailyDelta += allowedLoser;

        winner.lastMatchDay = dayKey;
        loser.lastMatchDay = dayKey;
    }

    public getRating(id: PlayerId): number {
        this.ensurePlayer(id);
        return this.players.get(id)!.rating;
    }

    public getPlayerStats(id: PlayerId): PlayerStats | undefined {
        return this.players.get(id);
    }

    public getLeaderboard(): Array<{ id: PlayerId, stats: PlayerStats }> {
        return Array.from(this.players.entries())
            .map(([id, stats]) => ({id, stats}))
            .sort((a, b) => b.stats.rating - a.stats.rating);
    }

    public getTopPlayers(limit: number = 10): Array<{ id: PlayerId, stats: PlayerStats }> {
        return this.getLeaderboard().slice(0, limit);
    }

    public hasPlayer(id: PlayerId): boolean {
        return this.players.has(id);
    }

    public getPlayerCount(): number {
        return this.players.size;
    }

    public removePlayer(id: PlayerId): boolean {
        return this.players.delete(id);
    }

    public freeze(): Record<PlayerId, PlayerStats> {
        const out: Record<PlayerId, PlayerStats> = {};
        this.players.forEach((v, k) => {
            out[k] = {...v};
        });
        return out;
    }

    public load(data: Record<PlayerId, PlayerStats>): void {
        this.players.clear();
        Object.entries(data).forEach(([id, stats]) => {
            this.players.set(id, {...stats});
        });
    }
}
