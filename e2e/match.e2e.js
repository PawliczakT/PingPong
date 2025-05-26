const { device, element, by, waitFor } = require('detox');
const helpers = require('./helpers.e2e.js');

describe('Match Management Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    // If tests need a logged-in state, ensure it here.
  });

  it('should create a new match and verify stats/ELO changes', async () => {
    const player1Name = 'MatchPlayerA' + Date.now();
    const player2Name = 'MatchPlayerB' + Date.now();

    // Create Players
    await helpers.createPlayer(player1Name, 'MPA');
    // Need to navigate to Players tab again for the second player if createPlayer doesn't return there
    // helpers.createPlayer already ensures it's on Players tab.
    await helpers.createPlayer(player2Name, 'MPB');

    // Capture Initial ELOs by navigating to profiles
    const initialStatsP1 = await helpers.getPlayerProfileStats(player1Name);
    const initialStatsP2 = await helpers.getPlayerProfileStats(player2Name);
    
    expect(initialStatsP1.elo).toBe(1000); // Assuming default ELO
    expect(initialStatsP2.elo).toBe(1000);

    // Create Match (P1 wins 3-1)
    const setScores = [
      { p1: 11, p2: 9 },
      { p1: 11, p2: 7 },
      { p1: 9,  p2: 11 },
      { p1: 11, p2: 8 },
    ];
    await helpers.createMatch(player1Name, player2Name, setScores);
    // createMatch already verifies visibility on home screen.
    // Now check for score display (e.g., '3-1')
    await expect(element(by.text('3-1'))).toBeVisible();


    // Assert Post-Match Stats for Player 1 (Winner)
    const postMatchStatsP1 = await helpers.getPlayerProfileStats(player1Name);
    expect(postMatchStatsP1.wins).toBe(initialStatsP1.wins + 1);
    expect(postMatchStatsP1.losses).toBe(initialStatsP1.losses);
    expect(postMatchStatsP1.elo).not.toBe(initialStatsP1.elo);

    // Assert Post-Match Stats for Player 2 (Loser)
    const postMatchStatsP2 = await helpers.getPlayerProfileStats(player2Name);
    expect(postMatchStatsP2.wins).toBe(initialStatsP2.wins);
    expect(postMatchStatsP2.losses).toBe(initialStatsP2.losses + 1);
    expect(postMatchStatsP2.elo).not.toBe(initialStatsP2.elo);

    // (Optional) Assert ELO Changes in Rankings Tab
    await helpers.navigateToTab('Stats');
    await expect(element(by.text('Player Rankings'))).toBeVisible();
    // This check remains complex without unique IDs per player row in rankings.
    // For now, verifying on profile is primary.
    await expect(element(by.text(player1Name)).withAncestor(by.id('player-rankings-list'))).toBeVisible();
    await expect(element(by.text(player2Name)).withAncestor(by.id('player-rankings-list'))).toBeVisible();
    // await expect(element(by.text(`ELO: ${postMatchStatsP1.elo}`)).withAncestor(by.id('player-rankings-list'))).toBeVisible();
    // await expect(element(by.text(`ELO: ${postMatchStatsP2.elo}`)).withAncestor(by.id('player-rankings-list'))).toBeVisible();
  });

  it('should edit an existing match score and verify changes', async () => {
    const playerXName = 'PEMA_X' + Date.now();
    const playerYName = 'PEMA_Y' + Date.now();

    await helpers.createPlayer(playerXName, 'PX');
    await helpers.createPlayer(playerYName, 'PY');

    const initialStatsX = await helpers.getPlayerProfileStats(playerXName);
    const initialStatsY = await helpers.getPlayerProfileStats(playerYName);

    // Create Initial Match (Player X wins 2-0)
    const initialSetScores = [{p1: 11, p2: 5}, {p1: 11, p2: 5}];
    await helpers.createMatch(playerXName, playerYName, initialSetScores);
    await expect(element(by.text('2-0'))).toBeVisible();

    // Capture stats after first match
    const statsX_afterMatch1 = await helpers.getPlayerProfileStats(playerXName);
    const statsY_afterMatch1 = await helpers.getPlayerProfileStats(playerYName);
    expect(statsX_afterMatch1.wins).toBe(1);
    expect(statsY_afterMatch1.losses).toBe(1);

    // Navigate to Edit Match
    await helpers.navigateToTab('Home');
    await element(by.text(`${playerXName} vs ${playerYName}`)).tap();
    await element(by.id('edit-match-button')).tap();

    // Modify Score (Player X still wins, but 2-1)
    await element(by.id('set1-player1-score')).clearText();
    await element(by.id('set1-player1-score')).typeText('11');
    await element(by.id('set1-player2-score')).clearText();
    await element(by.id('set1-player2-score')).typeText('8');

    await element(by.id('set2-player1-score')).clearText();
    await element(by.id('set2-player1-score')).typeText('8');
    await element(by.id('set2-player2-score')).clearText();
    await element(by.id('set2-player2-score')).typeText('11');

    await element(by.id('set3-player1-score')).typeText('11');
    await element(by.id('set3-player2-score')).typeText('6');
    
    await element(by.id('save-match-button')).tap(); // On edit screen

    // Verify Changes on match details screen
    await expect(element(by.text('2-1'))).toBeVisible();

    // Stat/ELO Verification (Win/Loss counts should be the same)
    const statsX_afterEdit = await helpers.getPlayerProfileStats(playerXName);
    expect(statsX_afterEdit.wins).toBe(1); 
    if (isNaN(statsX_afterEdit.elo)) throw new Error('Player X ELO is not a number after edit.');
    // ELO might change due to different set scores, or might not if only final game score matters.
    // For this test, we mainly care that win/loss counts are correct.

    const statsY_afterEdit = await helpers.getPlayerProfileStats(playerYName);
    expect(statsY_afterEdit.losses).toBe(1);
    if (isNaN(statsY_afterEdit.elo)) throw new Error('Player Y ELO is not a number after edit.');
  });

  it('should delete an existing match and verify stat/ELO reversal', async () => {
    const playerAName = 'PDMA_A' + Date.now();
    const playerBName = 'PDMA_B' + Date.now();

    await helpers.createPlayer(playerAName, 'PA');
    await helpers.createPlayer(playerBName, 'PB');

    const initialStatsA = await helpers.getPlayerProfileStats(playerAName);
    const initialStatsB = await helpers.getPlayerProfileStats(playerBName);

    // Create Initial Match (Player A wins 2-0)
    const setScores = [{p1: 11, p2: 6}, {p1: 11, p2: 6}];
    await helpers.createMatch(playerAName, playerBName, setScores);

    // Capture stats after match (ensure they changed)
    const statsA_afterMatch = await helpers.getPlayerProfileStats(playerAName);
    expect(statsA_afterMatch.wins).toBe(initialStatsA.wins + 1);
    expect(statsA_afterMatch.elo).not.toBe(initialStatsA.elo);

    const statsB_afterMatch = await helpers.getPlayerProfileStats(playerBName);
    expect(statsB_afterMatch.losses).toBe(initialStatsB.losses + 1);
    expect(statsB_afterMatch.elo).not.toBe(initialStatsB.elo);

    // Navigate and Delete Match
    await helpers.navigateToTab('Home');
    await element(by.text(`${playerAName} vs ${playerBName}`)).tap(); 
    await element(by.id('delete-match-button')).tap(); 
    await element(by.text('Delete')).tap(); // Confirm deletion

    // Verify Deletion from UI
    await helpers.navigateToTab('Home');
    await expect(element(by.text(`${playerAName} vs ${playerBName}`))).not.toBeVisible();

    // Verify Stats & ELO Reversal for Player A
    const statsA_afterDelete = await helpers.getPlayerProfileStats(playerAName);
    expect(statsA_afterDelete.wins).toBe(initialStatsA.wins);
    expect(statsA_afterDelete.losses).toBe(initialStatsA.losses);
    expect(statsA_afterDelete.elo).toBe(initialStatsA.elo);
    
    // Verify Stats & ELO Reversal for Player B
    const statsB_afterDelete = await helpers.getPlayerProfileStats(playerBName);
    expect(statsB_afterDelete.wins).toBe(initialStatsB.wins);
    expect(statsB_afterDelete.losses).toBe(initialStatsB.losses);
    expect(statsB_afterDelete.elo).toBe(initialStatsB.elo);
  });
});
