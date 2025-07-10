import { RatingElo, PlayerId, PlayerStats, MatchRecord, EloOptions } from '@/utils/elo';

describe('RatingElo Class', () => {
  let elo: RatingElo;
  const player1: PlayerId = 'player1';
  const player2: PlayerId = 'player2';
  const player3: PlayerId = 'player3';

  const defaultInitialRating = 1500; // Default in class, unless overridden in constructor

  beforeEach(() => {
    // Reset an elo instance with default options before each test
    elo = new RatingElo();
  });

  describe('Initialization and Player Management', () => {
    it('should initialize with default options if none provided', () => {
      const defaultElo = new RatingElo();
      defaultElo.ensurePlayer(player1);
      expect(defaultElo.getRating(player1)).toBe(defaultInitialRating);
    });

    it('should initialize with custom initialRating', () => {
      const customInitial = 1000;
      const customElo = new RatingElo({ initialRating: customInitial });
      customElo.ensurePlayer(player1);
      expect(customElo.getRating(player1)).toBe(customInitial);
    });

    it('ensurePlayer should create a new player with initial stats', () => {
      elo.ensurePlayer(player1);
      const stats = elo.getPlayerStats(player1);
      expect(stats).toBeDefined();
      expect(stats?.rating).toBe(defaultInitialRating);
      expect(stats?.gamesPlayed).toBe(0);
      expect(stats?.dailyDelta).toBe(0);
      expect(stats?.lastMatchDay).toBe('');
    });

    it('ensurePlayer should not overwrite existing player', () => {
      elo.ensurePlayer(player1);
      elo.updateMatch({ winner: player1, loser: player2, date: new Date(2023, 0, 1) });
      const statsBefore = elo.getPlayerStats(player1);
      elo.ensurePlayer(player1); // Call ensurePlayer again
      const statsAfter = elo.getPlayerStats(player1);
      expect(statsAfter).toEqual(statsBefore);
    });

    it('getPlayerStats should return undefined for non-existent player', () => {
      expect(elo.getPlayerStats('nonExistentPlayer')).toBeUndefined();
    });

    it('getRating should create player and return initial rating if non-existent', () => {
        expect(elo.getRating('newPlayer')).toBe(defaultInitialRating);
        expect(elo.hasPlayer('newPlayer')).toBe(true);
    });

    it('hasPlayer should return true for existing player, false otherwise', () => {
      elo.ensurePlayer(player1);
      expect(elo.hasPlayer(player1)).toBe(true);
      expect(elo.hasPlayer('nonExistentPlayer')).toBe(false);
    });

    it('getPlayerCount should return the correct number of players', () => {
      expect(elo.getPlayerCount()).toBe(0);
      elo.ensurePlayer(player1);
      expect(elo.getPlayerCount()).toBe(1);
      elo.ensurePlayer(player2);
      expect(elo.getPlayerCount()).toBe(2);
    });

    it('removePlayer should remove a player and return true, or false if not found', () => {
      elo.ensurePlayer(player1);
      expect(elo.removePlayer(player1)).toBe(true);
      expect(elo.hasPlayer(player1)).toBe(false);
      expect(elo.getPlayerCount()).toBe(0);
      expect(elo.removePlayer('nonExistentPlayer')).toBe(false);
    });
  });

  describe('Match Updates and Rating Calculations', () => {
    it('should update ratings correctly when player1 wins', () => {
      elo.ensurePlayer(player1); // rating 1500
      elo.ensurePlayer(player2); // rating 1500
      const matchDate = new Date(2023, 0, 1);
      elo.updateMatch({ winner: player1, loser: player2, date: matchDate });

      const p1Stats = elo.getPlayerStats(player1)!;
      const p2Stats = elo.getPlayerStats(player2)!;

      expect(p1Stats.rating).toBeGreaterThan(defaultInitialRating);
      expect(p2Stats.rating).toBeLessThan(defaultInitialRating);
      expect(p1Stats.gamesPlayed).toBe(1);
      expect(p2Stats.gamesPlayed).toBe(1);
      expect(p1Stats.dailyDelta).toBe(p1Stats.rating - defaultInitialRating);
      expect(p2Stats.dailyDelta).toBe(p2Stats.rating - defaultInitialRating);
      expect(p1Stats.lastMatchDay).toBe(matchDate.toISOString().slice(0,10));
    });

    it('should correctly apply K-factors based on gamesPlayed (decayThresholds)', () => {
        const opts: EloOptions = {
            initialRating: 1500,
            kNewbie: 30,
            kIntermediate: 20,
            kPro: 10,
            decayThreshold1: 1, // After 1 game, kIntermediate
            decayThreshold2: 2, // After 2 games, kPro
        };
        const testElo = new RatingElo(opts);
        testElo.ensurePlayer(player1);
        testElo.ensurePlayer(player2);
        testElo.ensurePlayer(player3); // For a third match

        // Match 1: p1 (0 games) vs p2 (0 games) -> kNewbie for both
        const date1 = new Date(2023,0,1);
        testElo.updateMatch({ winner: player1, loser: player2, date: date1 });
        const p1RatingAfterMatch1 = testElo.getRating(player1);
        // Expected change for 1500 vs 1500, k=30: 30 * (1 - 0.5) = 15. So 1500 + 15 = 1515
        expect(p1RatingAfterMatch1).toBe(1500 + 15);

        // Match 2: p1 (1 game) vs p3 (0 games) -> kIntermediate for p1, kNewbie for p3
        const date2 = new Date(2023,0,1);
        testElo.updateMatch({ winner: player1, loser: player3, date: date2 });
        const p1RatingAfterMatch2 = testElo.getRating(player1);
        // p1 (1515, 1 game) vs p3 (1500, 0 games). p1 uses kIntermediate (20)
        // Prob p1 wins = 1 / (1 + 10^((1500-1515)/400)) approx 0.521
        // Delta for p1 = 20 * (1 - 0.521) approx 9.57. So 1515 + 9.57 = 1524.57 -> rounded 1525
        // For simplicity, we check it's greater than if kNewbie was used and less than if kPro was used.
        // Exact calculation: 1515 + 20 * (1 - (1 / (1 + Math.pow(10, (1500 - 1515) / 400))))
        expect(p1RatingAfterMatch2).toBeCloseTo(1515 + 20 * (1 - (1 / (1 + Math.pow(10, (1500 - 1515) / 400)))),0);


        // Match 3: p1 (2 games) vs p2 (1 game) -> kPro for p1, kIntermediate for p2
        const p2RatingBeforeMatch3 = testElo.getRating(player2); // Should be 1500-15 = 1485
        const date3 = new Date(2023,0,1);
        testElo.updateMatch({ winner: player1, loser: player2, date: date3 });
        const p1RatingAfterMatch3 = testElo.getRating(player1);
         // p1 (1524.57, 2 games) vs p2 (1485, 1 game). p1 uses kPro (10)
        expect(p1RatingAfterMatch3).toBeCloseTo(1524.57 + 10 * (1 - (1 / (1 + Math.pow(10, (1485 - 1524.57) / 400)))),0);
    });

    it('should respect maxDailyDelta', () => {
      const mddElo = new RatingElo({ maxDailyDelta: 10, initialRating: 1500, kNewbie: 32 });
      mddElo.ensurePlayer(player1);
      mddElo.ensurePlayer(player2);
      mddElo.ensurePlayer(player3);

      // Match 1: p1 wins, delta would be 16, but capped at 10
      mddElo.updateMatch({ winner: player1, loser: player2, date: new Date(2023, 0, 1) });
      expect(mddElo.getRating(player1)).toBe(1500 + 10);
      expect(mddElo.getPlayerStats(player1)?.dailyDelta).toBe(10);

      // Match 2: p1 wins again, delta would be >0, but dailyDelta already at max, so no change for p1
      // Loser (player3) is new, their delta should be normal (e.g. -16 if initial rating)
      const p3InitialRating = mddElo.getRating(player3);
      mddElo.updateMatch({ winner: player1, loser: player3, date: new Date(2023, 0, 1) });
      expect(mddElo.getRating(player1)).toBe(1500 + 10); // Still 1510
      expect(mddElo.getPlayerStats(player1)?.dailyDelta).toBe(10);
      expect(mddElo.getRating(player3)).toBeLessThan(p3InitialRating); // p3 rating should decrease
    });

    it('dailyDelta should reset on a new day', () => {
      elo.ensurePlayer(player1);
      elo.ensurePlayer(player2);
      elo.updateMatch({ winner: player1, loser: player2, date: new Date(2023, 0, 1, 10,0,0) }); // Day 1
      const p1DeltaDay1 = elo.getPlayerStats(player1)!.dailyDelta;
      expect(p1DeltaDay1).toBeGreaterThan(0);

      elo.updateMatch({ winner: player1, loser: player2, date: new Date(2023, 0, 2, 10,0,0) }); // Day 2
      const p1DeltaDay2 = elo.getPlayerStats(player1)!.dailyDelta;
      // Delta on day 2 should be only from the second match, not cumulative from day 1
      const ratingAfterDay1 = 1500 + p1DeltaDay1;
      const ratingAfterDay2Match = elo.getRating(player1);
      expect(p1DeltaDay2).toBeCloseTo(ratingAfterDay2Match - ratingAfterDay1);
      expect(elo.getPlayerStats(player1)!.lastMatchDay).toBe('2023-01-02');
    });

    it('throws error for invalid match data (missing players, self-play, future date)', () => {
        elo.ensurePlayer(player1);
        expect(() => elo.updateMatch({winner: '', loser: player2, date: new Date()})).toThrow('Brak informacji o graczach');
        expect(() => elo.updateMatch({winner: player1, loser: player1, date: new Date()})).toThrow('Gracz nie może grać sam ze sobą');
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);
        expect(() => elo.updateMatch({winner: player1, loser: player2, date: futureDate})).toThrow('Nieprawidłowa data meczu');
    });

  });

  describe('Leaderboard and Stats Retrieval', () => {
    beforeEach(() => {
      // player1 > player3 > player2
      elo.ensurePlayer(player1); // 1500
      elo.ensurePlayer(player2); // 1500
      elo.ensurePlayer(player3); // 1500

      elo.updateMatch({ winner: player1, loser: player2, date: new Date() }); // p1: 1516, p2: 1484
      elo.updateMatch({ winner: player1, loser: player3, date: new Date() }); // p1: 1516 + X, p3: 1500 - Y
      // To make p3 > p2:
      // p1 wins vs p2 -> p1=1516, p2=1484
      // p3 wins vs p2 -> p3=1516, p2=1484-16=1468
      // Now p1 initial, p2 initial, p3 initial
      elo = new RatingElo();
      elo.ensurePlayer(player1);
      elo.ensurePlayer(player2);
      elo.ensurePlayer(player3);
      elo.updateMatch({ winner: player1, loser: player2, date: new Date(2023,0,1) }); // p1=1516, p2=1484
      elo.updateMatch({ winner: player3, loser: player2, date: new Date(2023,0,1) }); // p3=1516, p2=1484-16=1468. P1 still 1516.
    });

    it('getLeaderboard should return players sorted by rating descending', () => {
      const leaderboard = elo.getLeaderboard();
      expect(leaderboard.length).toBe(3);
      expect(leaderboard[0].id).toBe(player1); // or player3, they might be equal
      expect(leaderboard[1].id).toBe(player3); // or player1
      expect(leaderboard[2].id).toBe(player2);
      expect(leaderboard[0].stats.rating).toBeGreaterThanOrEqual(leaderboard[1].stats.rating);
      expect(leaderboard[1].stats.rating).toBeGreaterThanOrEqual(leaderboard[2].stats.rating);
    });

    it('getTopPlayers should return the top N players', () => {
      const top2 = elo.getTopPlayers(2);
      expect(top2.length).toBe(2);
      expect(top2[0].id).toBe(player1); // or player3
      expect(top2[1].id).toBe(player3); // or player1

      const top5 = elo.getTopPlayers(5); // More than available players
      expect(top5.length).toBe(3);
    });
  });

  describe('Serialization (freeze/load)', () => {
    it('freeze should return a serializable record of player stats', () => {
      elo.ensurePlayer(player1);
      elo.updateMatch({ winner: player1, loser: player2, date: new Date() });
      const frozenData = elo.freeze();
      expect(frozenData).toHaveProperty(player1);
      expect(frozenData).toHaveProperty(player2);
      expect(frozenData[player1].rating).toBe(elo.getRating(player1));
      expect(frozenData[player1].gamesPlayed).toBe(1);
    });

    it('load should clear existing players and load new data', () => {
      elo.ensurePlayer(player1); // Player from before load
      const dataToLoad: Record<PlayerId, PlayerStats> = {
        [player2]: { rating: 1600, gamesPlayed: 5, dailyDelta: 10, lastMatchDay: '2023-01-01' },
        [player3]: { rating: 1400, gamesPlayed: 3, dailyDelta: -5, lastMatchDay: '2023-01-02' },
      };
      elo.load(dataToLoad);

      expect(elo.hasPlayer(player1)).toBe(false);
      expect(elo.hasPlayer(player2)).toBe(true);
      expect(elo.hasPlayer(player3)).toBe(true);
      expect(elo.getPlayerCount()).toBe(2);
      expect(elo.getRating(player2)).toBe(1600);
      expect(elo.getPlayerStats(player3)?.gamesPlayed).toBe(3);
    });

    it('load should correctly handle empty data object', () => {
        elo.ensurePlayer(player1);
        elo.load({});
        expect(elo.getPlayerCount()).toBe(0);
    });
  });
});
