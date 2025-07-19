/**
 * Tournament Builder
 * Implements the Builder Pattern for tournament configuration
 */
import {TournamentFormat, TournamentStatus} from '../../backend/types';

export interface TournamentConfig {
    name: string;
    date: string;
    format: TournamentFormat;
    playerIds: string[];
    status?: TournamentStatus;
    maxParticipants?: number;
    minParticipants?: number;
    description?: string;
    rules?: string[];
    prizes?: string[];
    registrationDeadline?: string;
    venue?: string;
    organizer?: string;
}

export interface ITournamentBuilder {
    setName(name: string): ITournamentBuilder;

    setDate(date: string): ITournamentBuilder;

    setFormat(format: TournamentFormat): ITournamentBuilder;

    setParticipants(playerIds: string[]): ITournamentBuilder;

    addParticipant(playerId: string): ITournamentBuilder;

    removeParticipant(playerId: string): ITournamentBuilder;

    setStatus(status: TournamentStatus): ITournamentBuilder;

    setMaxParticipants(max: number): ITournamentBuilder;

    setMinParticipants(min: number): ITournamentBuilder;

    setDescription(description: string): ITournamentBuilder;

    addRule(rule: string): ITournamentBuilder;

    setRules(rules: string[]): ITournamentBuilder;

    setPrizes(prizes: string[]): ITournamentBuilder;

    setRegistrationDeadline(deadline: string): ITournamentBuilder;

    setVenue(venue: string): ITournamentBuilder;

    setOrganizer(organizer: string): ITournamentBuilder;

    validate(): { valid: boolean; errors: string[] };

    build(): TournamentConfig;

    reset(): ITournamentBuilder;
}

export class TournamentBuilder implements ITournamentBuilder {
    private config: Partial<TournamentConfig> = {};

    setName(name: string): ITournamentBuilder {
        this.config.name = name.trim();
        return this;
    }

    setDate(date: string): ITournamentBuilder {
        this.config.date = date;
        return this;
    }

    setFormat(format: TournamentFormat): ITournamentBuilder {
        this.config.format = format;
        return this;
    }

    setParticipants(playerIds: string[]): ITournamentBuilder {
        this.config.playerIds = [...playerIds];
        return this;
    }

    addParticipant(playerId: string): ITournamentBuilder {
        if (!this.config.playerIds) {
            this.config.playerIds = [];
        }
        if (!this.config.playerIds.includes(playerId)) {
            this.config.playerIds.push(playerId);
        }
        return this;
    }

    removeParticipant(playerId: string): ITournamentBuilder {
        if (this.config.playerIds) {
            this.config.playerIds = this.config.playerIds.filter(id => id !== playerId);
        }
        return this;
    }

    setStatus(status: TournamentStatus): ITournamentBuilder {
        this.config.status = status;
        return this;
    }

    setMaxParticipants(max: number): ITournamentBuilder {
        this.config.maxParticipants = max;
        return this;
    }

    setMinParticipants(min: number): ITournamentBuilder {
        this.config.minParticipants = min;
        return this;
    }

    setDescription(description: string): ITournamentBuilder {
        this.config.description = description;
        return this;
    }

    addRule(rule: string): ITournamentBuilder {
        if (!this.config.rules) {
            this.config.rules = [];
        }
        this.config.rules.push(rule);
        return this;
    }

    setRules(rules: string[]): ITournamentBuilder {
        this.config.rules = [...rules];
        return this;
    }

    setPrizes(prizes: string[]): ITournamentBuilder {
        this.config.prizes = [...prizes];
        return this;
    }

    setRegistrationDeadline(deadline: string): ITournamentBuilder {
        this.config.registrationDeadline = deadline;
        return this;
    }

    setVenue(venue: string): ITournamentBuilder {
        this.config.venue = venue;
        return this;
    }

    setOrganizer(organizer: string): ITournamentBuilder {
        this.config.organizer = organizer;
        return this;
    }

    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!this.config.name || this.config.name.trim().length === 0) {
            errors.push('Tournament name is required');
        }

        if (!this.config.date) {
            errors.push('Tournament date is required');
        } else {
            const tournamentDate = new Date(this.config.date);
            if (isNaN(tournamentDate.getTime())) {
                errors.push('Invalid tournament date format');
            } else {
                // Compare only dates, not times - allow tournaments today or in the future
                const today = new Date();
                const tournamentDateOnly = new Date(tournamentDate.getFullYear(), tournamentDate.getMonth(), tournamentDate.getDate());
                const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                
                if (tournamentDateOnly < todayDateOnly) {
                    errors.push('Tournament date cannot be in the past');
                }
            }
        }

        if (!this.config.format) {
            errors.push('Tournament format is required');
        }

        if (!this.config.playerIds || this.config.playerIds.length === 0) {
            errors.push('At least one participant is required');
        }

        if (this.config.format && this.config.playerIds) {
            const playerCount = this.config.playerIds.length;

            switch (this.config.format) {
                case TournamentFormat.KNOCKOUT:
                case TournamentFormat.DOUBLE_ELIMINATION:
                    if (playerCount % 4 !== 0) {
                        errors.push(`${this.config.format} tournaments require a number of players divisible by 4`);
                    }
                    break;
                case TournamentFormat.ROUND_ROBIN:
                    if (playerCount < 2) {
                        errors.push('Round robin tournaments require at least 2 players');
                    }
                    if (playerCount > 20) {
                        errors.push('Round robin tournaments with more than 20 players may be impractical');
                    }
                    break;
                case TournamentFormat.GROUP:
                    if (playerCount < 6) {
                        errors.push('Group tournaments require at least 6 players');
                    }
                    break;
            }
        }

        if (this.config.minParticipants && this.config.playerIds &&
            this.config.playerIds.length < this.config.minParticipants) {
            errors.push(`Tournament requires at least ${this.config.minParticipants} participants`);
        }

        if (this.config.maxParticipants && this.config.playerIds &&
            this.config.playerIds.length > this.config.maxParticipants) {
            errors.push(`Tournament cannot have more than ${this.config.maxParticipants} participants`);
        }

        if (this.config.registrationDeadline) {
            const deadline = new Date(this.config.registrationDeadline);
            const tournamentDate = new Date(this.config.date || '');

            if (isNaN(deadline.getTime())) {
                errors.push('Invalid registration deadline format');
            } else if (deadline >= tournamentDate) {
                errors.push('Registration deadline must be before tournament date');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    build(): TournamentConfig {
        const validation = this.validate();
        if (!validation.valid) {
            throw new Error(`Invalid tournament configuration: ${validation.errors.join(', ')}`);
        }

        return {
            name: this.config.name!,
            date: this.config.date!,
            format: this.config.format!,
            playerIds: this.config.playerIds!,
            status: this.config.status || TournamentStatus.UPCOMING,
            maxParticipants: this.config.maxParticipants,
            minParticipants: this.config.minParticipants,
            description: this.config.description,
            rules: this.config.rules,
            prizes: this.config.prizes,
            registrationDeadline: this.config.registrationDeadline,
            venue: this.config.venue,
            organizer: this.config.organizer,
        };
    }

    reset(): ITournamentBuilder {
        this.config = {};
        return this;
    }

    /**
     * Create a tournament from existing tournament data
     */
    static fromExisting(tournament: Partial<TournamentConfig>): TournamentBuilder {
        const builder = new TournamentBuilder();

        if (tournament.name) builder.setName(tournament.name);
        if (tournament.date) builder.setDate(tournament.date);
        if (tournament.format) builder.setFormat(tournament.format);
        if (tournament.playerIds) builder.setParticipants(tournament.playerIds);
        if (tournament.status) builder.setStatus(tournament.status);
        if (tournament.maxParticipants) builder.setMaxParticipants(tournament.maxParticipants);
        if (tournament.minParticipants) builder.setMinParticipants(tournament.minParticipants);
        if (tournament.description) builder.setDescription(tournament.description);
        if (tournament.rules) builder.setRules(tournament.rules);
        if (tournament.prizes) builder.setPrizes(tournament.prizes);
        if (tournament.registrationDeadline) builder.setRegistrationDeadline(tournament.registrationDeadline);
        if (tournament.venue) builder.setVenue(tournament.venue);
        if (tournament.organizer) builder.setOrganizer(tournament.organizer);

        return builder;
    }

    /**
     * Quick builder for common tournament types
     */
    static quickKnockout(name: string, date: string, playerIds: string[]): TournamentBuilder {
        const builder = new TournamentBuilder();
        return builder
            .setName(name)
            .setDate(date)
            .setFormat(TournamentFormat.KNOCKOUT)
            .setParticipants(playerIds) as TournamentBuilder;
    }

    static quickRoundRobin(name: string, date: string, playerIds: string[]): TournamentBuilder {
        const builder = new TournamentBuilder();
        return builder
            .setName(name)
            .setDate(date)
            .setFormat(TournamentFormat.ROUND_ROBIN)
            .setParticipants(playerIds) as TournamentBuilder;
    }

    static quickDoubleElimination(name: string, date: string, playerIds: string[]): TournamentBuilder {
        const builder = new TournamentBuilder();
        return builder
            .setName(name)
            .setDate(date)
            .setFormat(TournamentFormat.DOUBLE_ELIMINATION)
            .setParticipants(playerIds) as TournamentBuilder;
    }
}

/**
 * Fluent interface for creating tournaments
 */
export function createTournament(): TournamentBuilder {
    return new TournamentBuilder();
}
