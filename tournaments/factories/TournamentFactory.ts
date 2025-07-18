/**
 * Tournament Factory
 * Implements the Factory Pattern for creating tournament instances
 */
import { TournamentFormat } from '../../backend/types';
import { ITournamentStrategy } from '../types/BaseTournament';
import { KnockoutTournamentStrategy } from '../types/KnockoutTournament';
import { RoundRobinTournamentStrategy } from '../types/RoundRobinTournament';
import { DoubleEliminationTournamentStrategy } from '../types/DoubleEliminationTournament';
import { TournamentRepository } from '../repositories/TournamentRepository';

export interface ITournamentFactory {
  createTournamentStrategy(format: TournamentFormat): ITournamentStrategy;
  getSupportedFormats(): TournamentFormat[];
}

export class TournamentFactory implements ITournamentFactory {
  private repository: TournamentRepository;
  private strategies = new Map<TournamentFormat, ITournamentStrategy>();

  constructor(repository?: TournamentRepository) {
    this.repository = repository || new TournamentRepository();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies.set(
      TournamentFormat.KNOCKOUT,
      new KnockoutTournamentStrategy(this.repository)
    );
    
    this.strategies.set(
      TournamentFormat.ROUND_ROBIN,
      new RoundRobinTournamentStrategy(this.repository)
    );
    
    this.strategies.set(
      TournamentFormat.DOUBLE_ELIMINATION,
      new DoubleEliminationTournamentStrategy(this.repository)
    );
  }

  createTournamentStrategy(format: TournamentFormat): ITournamentStrategy {
    const strategy = this.strategies.get(format);
    
    if (!strategy) {
      throw new Error(`Unsupported tournament format: ${format}`);
    }
    
    return strategy;
  }

  getSupportedFormats(): TournamentFormat[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Register a new tournament strategy
   * Allows for easy extension with new tournament types
   */
  registerStrategy(format: TournamentFormat, strategy: ITournamentStrategy): void {
    this.strategies.set(format, strategy);
  }

  /**
   * Validate if a format is supported
   */
  isFormatSupported(format: TournamentFormat): boolean {
    return this.strategies.has(format);
  }

  /**
   * Get strategy without throwing error
   */
  getStrategy(format: TournamentFormat): ITournamentStrategy | null {
    return this.strategies.get(format) || null;
  }
}

let factoryInstance: TournamentFactory | null = null;

export function getTournamentFactory(): TournamentFactory {
  if (!factoryInstance) {
    factoryInstance = new TournamentFactory();
  }
  return factoryInstance;
}

export function resetTournamentFactory(): void {
  factoryInstance = null;
}
