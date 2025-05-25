const { device, element, by, waitFor } = require('detox');

describe('PingPong App E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should navigate through the main tabs of the application', async () => {
    // Check if we're on the home screen
    await expect(element(by.text('Recent Matches'))).toBeVisible();

    // Navigate to Players tab
    await element(by.text('Players')).tap();
    await expect(element(by.text('Active Players'))).toBeVisible();

    // Navigate to Tournaments tab
    await element(by.text('Tournaments')).tap();
    await expect(element(by.text('Upcoming Tournaments'))).toBeVisible();

    // Navigate to Stats tab
    await element(by.text('Stats')).tap();
    await expect(element(by.text('Player Rankings'))).toBeVisible();

    // Navigate to Achievements tab
    await element(by.text('Achievements')).tap();
    await expect(element(by.text('Your Achievements'))).toBeVisible();

    // Navigate back to Home tab
    await element(by.text('Home')).tap();
    await expect(element(by.text('Recent Matches'))).toBeVisible();
  });

  it('should create a new player and verify it appears in the players list', async () => {
    // Navigate to Players tab
    await element(by.text('Players')).tap();
    await expect(element(by.text('Active Players'))).toBeVisible();

    // Tap on Add Player button
    await element(by.id('add-player-button')).tap();

    // Fill in player details
    await element(by.id('player-name-input')).typeText('John Doe');
    await element(by.id('player-nickname-input')).typeText('JD');

    // Save the new player
    await element(by.id('save-player-button')).tap();

    // Verify the new player appears in the list
    await expect(element(by.text('John Doe'))).toBeVisible();
  });

  it('should create a new match and verify it appears in recent matches', async () => {
    // Navigate to Home tab
    await element(by.text('Home')).tap();

    // Tap on New Match button
    await element(by.id('new-match-button')).tap();

    // Select players
    await element(by.id('select-player1')).tap();
    await element(by.text('John Doe')).tap();

    await element(by.id('select-player2')).tap();
    await element(by.text('Jane Smith')).tap();

    // Enter scores
    await element(by.id('set1-player1-score')).typeText('11');
    await element(by.id('set1-player2-score')).typeText('9');

    await element(by.id('set2-player1-score')).typeText('11');
    await element(by.id('set2-player2-score')).typeText('7');

    await element(by.id('set3-player1-score')).typeText('9');
    await element(by.id('set3-player2-score')).typeText('11');

    await element(by.id('set4-player1-score')).typeText('11');
    await element(by.id('set4-player2-score')).typeText('8');

    // Save the match
    await element(by.id('save-match-button')).tap();

    // Verify the match appears in recent matches
    await expect(element(by.text('John Doe vs Jane Smith'))).toBeVisible();
    await expect(element(by.text('3-1'))).toBeVisible();
  });

  it('should create a tournament and verify it appears in the tournaments list', async () => {
    // Navigate to Tournaments tab
    await element(by.text('Tournaments')).tap();

    // Tap on New Tournament button
    await element(by.id('new-tournament-button')).tap();

    // Fill in tournament details
    await element(by.id('tournament-name-input')).typeText('Summer Championship');

    // Select tournament format
    await element(by.id('tournament-format-dropdown')).tap();
    await element(by.text('KNOCKOUT')).tap();

    // Select tournament date
    await element(by.id('tournament-date-picker')).tap();
    await element(by.text('OK')).tap();

    // Select players
    await element(by.id('select-players-button')).tap();
    await element(by.text('John Doe')).tap();
    await element(by.text('Jane Smith')).tap();
    await element(by.text('Bob Johnson')).tap();
    await element(by.text('Alice Brown')).tap();
    await element(by.text('Done')).tap();

    // Create the tournament
    await element(by.id('create-tournament-button')).tap();

    // Verify the tournament appears in the list
    await expect(element(by.text('Summer Championship'))).toBeVisible();
    await expect(element(by.text('KNOCKOUT'))).toBeVisible();
  });

  it('should view tournament details and start the tournament', async () => {
    // Navigate to Tournaments tab
    await element(by.text('Tournaments')).tap();

    // Tap on the tournament
    await element(by.text('Summer Championship')).tap();

    // Verify tournament details
    await expect(element(by.text('Summer Championship'))).toBeVisible();
    await expect(element(by.text('KNOCKOUT'))).toBeVisible();
    await expect(element(by.text('Participants: 4'))).toBeVisible();

    // Start the tournament
    await element(by.id('start-tournament-button')).tap();

    // Verify tournament status changed
    await expect(element(by.text('Status: In Progress'))).toBeVisible();

    // Verify matches were generated
    await expect(element(by.text('Round 1'))).toBeVisible();
  });

  it('should record match results in the tournament', async () => {
    // Navigate to Tournaments tab
    await element(by.text('Tournaments')).tap();

    // Tap on the tournament
    await element(by.text('Summer Championship')).tap();

    // Tap on a match to record result
    await element(by.id('match-0')).tap();

    // Enter scores
    await element(by.id('set1-player1-score')).typeText('11');
    await element(by.id('set1-player2-score')).typeText('9');

    await element(by.id('set2-player1-score')).typeText('11');
    await element(by.id('set2-player2-score')).typeText('7');

    await element(by.id('set3-player1-score')).typeText('11');
    await element(by.id('set3-player2-score')).typeText('5');

    // Save the match result
    await element(by.id('save-match-result-button')).tap();

    // Verify match result was recorded
    await expect(element(by.text('3-0'))).toBeVisible();

    // Record result for the second match
    await element(by.id('match-1')).tap();

    // Enter scores
    await element(by.id('set1-player1-score')).typeText('9');
    await element(by.id('set1-player2-score')).typeText('11');

    await element(by.id('set2-player1-score')).typeText('11');
    await element(by.id('set2-player2-score')).typeText('8');

    await element(by.id('set3-player1-score')).typeText('7');
    await element(by.id('set3-player2-score')).typeText('11');

    await element(by.id('set4-player1-score')).typeText('11');
    await element(by.id('set4-player2-score')).typeText('9');

    await element(by.id('set5-player1-score')).typeText('11');
    await element(by.id('set5-player2-score')).typeText('7');

    // Save the match result
    await element(by.id('save-match-result-button')).tap();

    // Verify match result was recorded
    await expect(element(by.text('3-2'))).toBeVisible();
  });

  it('should complete the tournament and verify the winner', async () => {
    // Navigate to Tournaments tab
    await element(by.text('Tournaments')).tap();

    // Tap on the tournament
    await element(by.text('Summer Championship')).tap();

    // Tap on the final match to record result
    await element(by.id('match-2')).tap();

    // Enter scores
    await element(by.id('set1-player1-score')).typeText('11');
    await element(by.id('set1-player2-score')).typeText('9');

    await element(by.id('set2-player1-score')).typeText('11');
    await element(by.id('set2-player2-score')).typeText('7');

    await element(by.id('set3-player1-score')).typeText('11');
    await element(by.id('set3-player2-score')).typeText('5');

    // Save the match result
    await element(by.id('save-match-result-button')).tap();

    // Verify tournament is completed
    await expect(element(by.text('Status: Completed'))).toBeVisible();

    // Verify the winner
    await expect(element(by.text('Winner:'))).toBeVisible();
    await expect(element(by.text('John Doe'))).toBeVisible();
  });

  it('should check player profile and verify stats and achievements', async () => {
    // Navigate to Players tab
    await element(by.text('Players')).tap();

    // Tap on a player to view profile
    await element(by.text('John Doe')).tap();

    // Verify player details
    await expect(element(by.text('John Doe'))).toBeVisible();
    await expect(element(by.text('JD'))).toBeVisible();

    // Verify player stats
    await expect(element(by.text('Matches'))).toBeVisible();
    await expect(element(by.text('Wins'))).toBeVisible();
    await expect(element(by.text('Win Rate'))).toBeVisible();

    // Navigate to player's achievements
    await element(by.text('Achievements')).tap();

    // Verify some achievements are unlocked
    await expect(element(by.text('First Win'))).toBeVisible();
    await expect(element(by.text('Tournament Victory'))).toBeVisible();
  });

  it('should check the rankings in the Stats tab', async () => {
    // Navigate to Stats tab
    await element(by.text('Stats')).tap();

    // Verify rankings are displayed
    await expect(element(by.text('Player Rankings'))).toBeVisible();
    await expect(element(by.text('John Doe'))).toBeVisible();

    // Check ELO ratings
    await expect(element(by.id('player-rating-0'))).toBeVisible();

    // Navigate to Match History
    await element(by.text('Match History')).tap();

    // Verify match history is displayed
    await expect(element(by.text('Recent Matches'))).toBeVisible();
    await expect(element(by.text('John Doe vs Jane Smith'))).toBeVisible();
  });

  it('should check the achievements tab and verify unlocked achievements', async () => {
    // Navigate to Achievements tab
    await element(by.text('Achievements')).tap();

    // Verify achievements page is displayed
    await expect(element(by.text('Your Achievements'))).toBeVisible();

    // Check for unlocked achievements
    await expect(element(by.text('First Win'))).toBeVisible();
    await expect(element(by.text('Tournament Victory'))).toBeVisible();

    // Check for locked achievements
    await expect(element(by.text('10 Wins'))).toBeVisible();
    await expect(element(by.text('Win 10 matches in a row'))).toBeVisible();
  });

  it('should check the settings and app information', async () => {
    // Navigate to Settings
    await element(by.id('settings-button')).tap();

    // Verify settings page is displayed
    await expect(element(by.text('App Settings'))).toBeVisible();

    // Check notification settings
    await expect(element(by.text('Notifications'))).toBeVisible();

    // Toggle a notification setting
    await element(by.id('toggle-match-results')).tap();

    // Check app version
    await expect(element(by.text('App Version'))).toBeVisible();

    // Go back to home
    await element(by.id('back-button')).tap();
    await expect(element(by.text('Recent Matches'))).toBeVisible();
  });
});
