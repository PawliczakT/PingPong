/**
 * Tournament Observer
 * Implements the Observer Pattern for tournament state updates
 */
export interface TournamentEvent {
    type: 'TOURNAMENT_CREATED' | 'TOURNAMENT_STARTED' | 'TOURNAMENT_COMPLETED' |
        'MATCH_COMPLETED' | 'MATCH_STARTED' | 'PLAYER_ADVANCED';
    tournamentId: string;
    data?: any;
    timestamp: number;
}

export interface ITournamentObserver {
    onTournamentEvent(event: TournamentEvent): void | Promise<void>;
}

export interface ITournamentSubject {
    subscribe(observer: ITournamentObserver): void;

    unsubscribe(observer: ITournamentObserver): void;

    notify(event: TournamentEvent): Promise<void>;
}

export class TournamentEventManager implements ITournamentSubject {
    private observers: Set<ITournamentObserver> = new Set();
    private eventHistory: TournamentEvent[] = [];
    private readonly MAX_HISTORY = 1000;

    subscribe(observer: ITournamentObserver): void {
        this.observers.add(observer);
    }

    unsubscribe(observer: ITournamentObserver): void {
        this.observers.delete(observer);
    }

    async notify(event: TournamentEvent): Promise<void> {
        this.eventHistory.push(event);
        if (this.eventHistory.length > this.MAX_HISTORY) {
            this.eventHistory.shift();
        }

        const notifications = Array.from(this.observers).map(async observer => {
            try {
                await observer.onTournamentEvent(event);
            } catch (error) {
                console.error('Error in tournament observer:', error);
            }
        });

        await Promise.allSettled(notifications);
    }

    getEventHistory(tournamentId?: string): TournamentEvent[] {
        if (tournamentId) {
            return this.eventHistory.filter(event => event.tournamentId === tournamentId);
        }
        return [...this.eventHistory];
    }

    clearHistory(): void {
        this.eventHistory = [];
    }

    getObserverCount(): number {
        return this.observers.size;
    }
}

/**
 * Built-in observers for common functionality
 */
export class NotificationObserver implements ITournamentObserver {
    async onTournamentEvent(event: TournamentEvent): Promise<void> {
        switch (event.type) {
            case 'TOURNAMENT_COMPLETED':
                await this.handleTournamentCompleted(event);
                break;
            case 'MATCH_COMPLETED':
                await this.handleMatchCompleted(event);
                break;
            case 'TOURNAMENT_STARTED':
                await this.handleTournamentStarted(event);
                break;
        }
    }

    private async handleTournamentCompleted(event: TournamentEvent): Promise<void> {
        try {
            const {dispatchSystemNotification} = require('../../app/services/notificationService');
            const {usePlayerStore} = require('../../store/playerStore');

            if (event.data?.winnerId && event.data?.tournamentName) {
                const playerStore = usePlayerStore.getState();
                const winner = playerStore.getPlayerById(event.data.winnerId);

                if (winner) {
                    await dispatchSystemNotification('tournament_won', {
                        notification_type: 'tournament_won',
                        winnerNickname: winner.nickname || winner.name,
                        tournamentName: event.data.tournamentName,
                        tournamentId: event.tournamentId,
                    });
                }
            }
        } catch (error) {
            console.error('Failed to dispatch tournament completion notification:', error);
        }
    }

    private async handleMatchCompleted(event: TournamentEvent): Promise<void> {
        console.log(`Match completed in tournament ${event.tournamentId}`);
    }

    private async handleTournamentStarted(event: TournamentEvent): Promise<void> {
        console.log(`Tournament ${event.tournamentId} started`);
    }
}

export class StatisticsObserver implements ITournamentObserver {
    private stats = new Map<string, any>();

    async onTournamentEvent(event: TournamentEvent): Promise<void> {
        const tournamentStats = this.stats.get(event.tournamentId) || {
            matchesCompleted: 0,
            startTime: null,
            endTime: null,
            participants: 0
        };

        switch (event.type) {
            case 'TOURNAMENT_STARTED':
                tournamentStats.startTime = event.timestamp;
                tournamentStats.participants = event.data?.participantCount || 0;
                break;
            case 'MATCH_COMPLETED':
                tournamentStats.matchesCompleted++;
                break;
            case 'TOURNAMENT_COMPLETED':
                tournamentStats.endTime = event.timestamp;
                break;
        }

        this.stats.set(event.tournamentId, tournamentStats);
    }

    getTournamentStats(tournamentId: string): any {
        return this.stats.get(tournamentId) || null;
    }

    getAllStats(): Map<string, any> {
        return new Map(this.stats);
    }

    clearStats(): void {
        this.stats.clear();
    }
}

let eventManagerInstance: TournamentEventManager | null = null;

export function getTournamentEventManager(): TournamentEventManager {
    if (!eventManagerInstance) {
        eventManagerInstance = new TournamentEventManager();

        eventManagerInstance.subscribe(new NotificationObserver());
        eventManagerInstance.subscribe(new StatisticsObserver());
    }
    return eventManagerInstance;
}

export function resetTournamentEventManager(): void {
    eventManagerInstance = null;
}
