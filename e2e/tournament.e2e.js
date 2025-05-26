const { device, element, by, waitFor } = require('detox');
const helpers = require('./helpers.e2e.js');

describe('Tournament Flow Tests', () => {
  // Player names and stats variables for tournament tests
  let tPlayerA_Name, tPlayerB_Name, tPlayerC_Name, tPlayerD_Name;
  // It's better to re-fetch or pass initial stats rather than relying on global vars for these complex objects
  // let tPlayerA_InitialStats, tPlayerB_InitialStats, tPlayerC_InitialStats, tPlayerD_InitialStats;
  
  // Stats after Round 1 - these might be needed if tests are strictly sequential and dependent
  let tPlayerA_Stats_R1, tPlayerB_Stats_R1, tPlayerC_Stats_R1, tPlayerD_Stats_R1;

  // Finalists - also for sequential dependency
  let finalist1_Name, finalist2_Name;
  let currentTournamentName; // To carry the tournament name across tests

  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Create players needed for the entire tournament suite ONCE
    // This makes tests dependent, but matches the original structure's implied flow.
    // For true independence, each 'it' block would create its own tournament and players.
    const timestamp = Date.now();
    tPlayerA_Name = `TP_A_${timestamp}`;
    tPlayerB_Name = `TP_B_${timestamp}`;
    tPlayerC_Name = `TP_C_${timestamp}`;
    tPlayerD_Name = `TP_D_${timestamp}`;
    currentTournamentName = `Tournament ${timestamp}`;

    await helpers.createPlayer(tPlayerA_Name, 'TPA');
    await helpers.createPlayer(tPlayerB_Name, 'TPB');
    await helpers.createPlayer(tPlayerC_Name, 'TPC');
    await helpers.createPlayer(tPlayerD_Name, 'TPD');
  });

  beforeEach(async () => {
    // Reloading app for each test in a sequence can be problematic if state needs to persist.
    // However, Detox standard practice is to reload for independence.
    // Given the sequential nature of these tournament tests, reload might reset tournament progress.
    // For this refactor, I'll keep reloadReactNative, but acknowledge this might break
    // the specific multi-stage tournament flow if it's not re-navigated properly.
    // The original tests might have implicitly relied on app state remaining.
    await device.reloadReactNative();
    // If login is required for these features, ensure it here.
    // await helpers.ensureLoggedIn(); // Assuming a helper for this if needed
  });

  it('should create a tournament, add dynamic players, and start it', async () => {
    // Record initial stats for each player
    const tPlayerA_InitialStats = await helpers.getPlayerProfileStats(tPlayerA_Name);
    const tPlayerB_InitialStats = await helpers.getPlayerProfileStats(tPlayerB_Name);
    const tPlayerC_InitialStats = await helpers.getPlayerProfileStats(tPlayerC_Name);
    const tPlayerD_InitialStats = await helpers.getPlayerProfileStats(tPlayerD_Name);

    expect(tPlayerA_InitialStats.wins).toBe(0); expect(tPlayerA_InitialStats.losses).toBe(0); expect(tPlayerA_InitialStats.elo).toBe(1000);
    expect(tPlayerB_InitialStats.wins).toBe(0); expect(tPlayerB_InitialStats.losses).toBe(0); expect(tPlayerB_InitialStats.elo).toBe(1000);
    expect(tPlayerC_InitialStats.wins).toBe(0); expect(tPlayerC_InitialStats.losses).toBe(0); expect(tPlayerC_InitialStats.elo).toBe(1000);
    expect(tPlayerD_InitialStats.wins).toBe(0); expect(tPlayerD_InitialStats.losses).toBe(0); expect(tPlayerD_InitialStats.elo).toBe(1000);

    await helpers.navigateToTab('Tournaments');
    await element(by.id('new-tournament-button')).tap();
    await element(by.id('tournament-name-input')).typeText(currentTournamentName);
    await element(by.id('tournament-format-dropdown')).tap();
    await element(by.text('KNOCKOUT')).tap();
    await element(by.id('tournament-date-picker')).tap();
    await element(by.text('OK')).tap();

    await element(by.id('select-players-button')).tap();
    await element(by.text(tPlayerA_Name)).tap();
    await element(by.text(tPlayerB_Name)).tap();
    await element(by.text(tPlayerC_Name)).tap();
    await element(by.text(tPlayerD_Name)).tap();
    await element(by.text('Done')).tap();

    await element(by.id('create-tournament-button')).tap();
    await expect(element(by.text(currentTournamentName))).toBeVisible();
    
    // Start the tournament
    await element(by.text(currentTournamentName)).tap();
    await expect(element(by.text('Participants: 4'))).toBeVisible();
    await element(by.id('start-tournament-button')).tap();
    await expect(element(by.text('Status: In Progress'))).toBeVisible();
    await expect(element(by.text('Round 1'))).toBeVisible();
  });

  it('should record Round 1 match results and verify stat changes', async () => {
    // This test assumes the tournament 'currentTournamentName' is In Progress from the previous test.
    // Due to reloadReactNative in beforeEach, we need to navigate back into the tournament.
    await helpers.navigateToTab('Tournaments');
    await element(by.text(currentTournamentName)).tap(); // Tap on the existing tournament

    // Match 0: tPlayerA vs tPlayerB. Assume tPlayerA wins.
    const statsA_beforeM0 = await helpers.getPlayerProfileStats(tPlayerA_Name);
    const statsB_beforeM0 = await helpers.getPlayerProfileStats(tPlayerB_Name);
    
    await element(by.id('match-0')).tap();
    await element(by.id('set1-player1-score')).typeText('11'); await element(by.id('set1-player2-score')).typeText('5');
    await element(by.id('set2-player1-score')).typeText('11'); await element(by.id('set2-player2-score')).typeText('5');
    await element(by.id('save-match-result-button')).tap();
    await expect(element(by.text('2-0'))).toBeVisible(); 

    tPlayerA_Stats_R1 = await helpers.getPlayerProfileStats(tPlayerA_Name);
    expect(tPlayerA_Stats_R1.wins).toBe(statsA_beforeM0.wins + 1);
    expect(tPlayerA_Stats_R1.elo).not.toBe(statsA_beforeM0.elo);

    tPlayerB_Stats_R1 = await helpers.getPlayerProfileStats(tPlayerB_Name);
    expect(tPlayerB_Stats_R1.losses).toBe(statsB_beforeM0.losses + 1);
    expect(tPlayerB_Stats_R1.elo).not.toBe(statsB_beforeM0.elo);
    finalist1_Name = tPlayerA_Name; // Store winner for next test

    // Navigate back to tournament match list to play the second match
    await helpers.navigateToTab('Tournaments');
    await element(by.text(currentTournamentName)).tap();

    // Match 1: tPlayerC vs tPlayerD. Assume tPlayerC wins.
    const statsC_beforeM1 = await helpers.getPlayerProfileStats(tPlayerC_Name);
    const statsD_beforeM1 = await helpers.getPlayerProfileStats(tPlayerD_Name);

    await element(by.id('match-1')).tap();
    await element(by.id('set1-player1-score')).typeText('11'); await element(by.id('set1-player2-score')).typeText('7');
    await element(by.id('set2-player1-score')).typeText('11'); await element(by.id('set2-player2-score')).typeText('7');
    await element(by.id('save-match-result-button')).tap();
    await expect(element(by.text('2-0'))).toBeVisible();

    tPlayerC_Stats_R1 = await helpers.getPlayerProfileStats(tPlayerC_Name);
    expect(tPlayerC_Stats_R1.wins).toBe(statsC_beforeM1.wins + 1);
    expect(tPlayerC_Stats_R1.elo).not.toBe(statsC_beforeM1.elo);

    tPlayerD_Stats_R1 = await helpers.getPlayerProfileStats(tPlayerD_Name);
    expect(tPlayerD_Stats_R1.losses).toBe(statsD_beforeM1.losses + 1);
    expect(tPlayerD_Stats_R1.elo).not.toBe(statsD_beforeM1.elo);
    finalist2_Name = tPlayerC_Name; // Store winner for next test
  });

  it('should complete the final match and verify winner stats', async () => {
    // This test assumes finalist1_Name and finalist2_Name are set from the previous test,
    // and the tournament 'currentTournamentName' is ready for the final.
    // Due to reloadReactNative, navigate back into the tournament.
    await helpers.navigateToTab('Tournaments');
    await element(by.text(currentTournamentName)).tap();

    // finalist1_Name (e.g. tPlayerA_Name) and finalist2_Name (e.g. tPlayerC_Name)
    const statsF1_beforeFinal = await helpers.getPlayerProfileStats(finalist1_Name);
    const statsF2_beforeFinal = await helpers.getPlayerProfileStats(finalist2_Name);

    await element(by.id('match-2')).tap(); // Assumes match-2 is the final
    // finalist1_Name (e.g. tPlayerA) wins the tournament
    await element(by.id('set1-player1-score')).typeText('11'); await element(by.id('set1-player2-score')).typeText('8');
    await element(by.id('set2-player1-score')).typeText('11'); await element(by.id('set2-player2-score')).typeText('8');
    await element(by.id('save-match-result-button')).tap();

    await expect(element(by.text('Status: Completed'))).toBeVisible();
    await expect(element(by.text(`Winner: ${finalist1_Name}`))).toBeVisible();

    const statsF1_afterFinal = await helpers.getPlayerProfileStats(finalist1_Name);
    expect(statsF1_afterFinal.wins).toBe(statsF1_beforeFinal.wins + 1);
    expect(statsF1_afterFinal.elo).not.toBe(statsF1_beforeFinal.elo);
    expect(statsF1_afterFinal.losses).toBe(statsF1_beforeFinal.losses);

    const statsF2_afterFinal = await helpers.getPlayerProfileStats(finalist2_Name);
    expect(statsF2_afterFinal.losses).toBe(statsF2_beforeFinal.losses + 1);
    expect(statsF2_afterFinal.elo).not.toBe(statsF2_beforeFinal.elo);
    expect(statsF2_afterFinal.wins).toBe(statsF2_beforeFinal.wins);

    // Final check on Tournament Winner's profile
    await helpers.navigateToTab('Players');
    await element(by.text(finalist1_Name)).tap();
    await expect(element(by.id('profile-wins-text'))).toHaveText(`Wins: ${statsF1_afterFinal.wins}`); // Total wins for tournament winner
    await expect(element(by.id('profile-losses-text'))).toHaveText(`Losses: ${statsF1_afterFinal.losses}`);
  });
});
