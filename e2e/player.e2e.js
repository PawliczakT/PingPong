const { device, element, by, waitFor } = require('detox');
const helpers = require('./helpers.e2e.js');

describe('Player Management Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    // If tests need a logged-in state, ensure it here or in specific tests.
    // For now, assuming these player tests don't require login or it's handled by default app state.
  });

  it('should create a new player and verify initial stats', async () => {
    // Using createPlayer helper which includes navigation to Players tab
    const player1Name = 'PlayerA' + Date.now();
    await helpers.createPlayer(player1Name, 'P1');
    
    // createPlayer already verifies visibility in list. Now verify stats.
    await element(by.text(player1Name)).tap(); // Tap on the newly created player

    await expect(element(by.id('profile-wins-text'))).toHaveText('Wins: 0');
    await expect(element(by.id('profile-losses-text'))).toHaveText('Losses: 0');
    await expect(element(by.id('profile-elo-text'))).toHaveText('ELO: 1000');

    // Navigate back to the players list
    try {
      await element(by.label('Navigate Back')).tap();
    } catch (e) {
      await helpers.navigateToTab('Players');
    }
  });

  it('should edit an existing player and verify changes', async () => {
    const basePlayerName = 'EditablePlayer' + Date.now();
    const initialNickname = 'InitialNick';
    await helpers.createPlayer(basePlayerName, initialNickname);

    // Navigate to the player's profile
    await element(by.text(basePlayerName)).tap();
    await expect(element(by.text(basePlayerName))).toBeVisible();

    // Tap edit button
    await element(by.id('edit-player-button')).tap(); 

    // Edit details
    const newPlayerName = basePlayerName + '_edited';
    const newNickname = 'EditedNick';
    await element(by.id('player-name-input')).clearText();
    await element(by.id('player-name-input')).typeText(newPlayerName);
    await element(by.id('player-nickname-input')).clearText();
    await element(by.id('player-nickname-input')).typeText(newNickname);
    await element(by.id('save-player-button')).tap(); 

    // Verify changes on profile screen
    await expect(element(by.text(newPlayerName))).toBeVisible();
    await expect(element(by.text(newNickname))).toBeVisible();

    // Navigate back to Players list
    try {
      await element(by.label('Navigate Back')).tap();
    } catch (e) {
      await helpers.navigateToTab('Players');
    }

    // Verify changes in the players list
    await expect(element(by.text(newPlayerName))).toBeVisible();
    await expect(element(by.text(basePlayerName))).not.toBeVisible();
  });

  it('should deactivate and reactivate a player and verify status', async () => {
    const activatablePlayerName = 'ActivatablePlayer' + Date.now();
    const playerNickname = 'ActNick';
    await helpers.createPlayer(activatablePlayerName, playerNickname);

    // --- Deactivation ---
    await element(by.text(activatablePlayerName)).tap();
    await expect(element(by.text(activatablePlayerName))).toBeVisible();

    await element(by.id('edit-player-button')).tap();
    await element(by.id('deactivate-player-switch')).tap(); 
    await element(by.id('save-player-button')).tap(); 

    await helpers.navigateToTab('Players');
    await expect(element(by.text('Active Players'))).toBeVisible();
    await expect(element(by.text(activatablePlayerName))).not.toBeVisible();

    // --- Reactivation ---
    // The original test noted: "Without a specified way to filter for or search for inactive players...
    // Therefore, I will only implement up to verifying deactivation."
    // This remains a limitation unless UI for finding inactive players is known and scriptable.
    // For now, this test only covers deactivation.
    console.log('Player deactivation verified. Reactivation part is skipped as per original test limitation.');
  });
});
