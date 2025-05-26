const { element, by, expect, waitFor } = require('detox');

// --- Auth Constants ---
const VALID_EMAIL = 'testuser@example.com';
const VALID_PASSWORD = 'password123';
const INVALID_EMAIL = 'invalid@example.com';
const INVALID_PASSWORD = 'wrongpassword';

// --- General Visibility Helper ---
async function isElementVisible(matcher) {
  try {
    await expect(element(matcher)).toBeVisible();
    return true;
  } catch (e) {
    return false;
  }
}

// --- Navigation Helper ---
async function navigateToTab(tabName) {
  await element(by.text(tabName)).tap();
  // Basic verification (example: expect 'Recent Matches' for 'Home' tab)
  // This needs to be adapted based on actual content of each tab
  if (tabName === 'Home') {
    await expect(element(by.text('Recent Matches'))).toBeVisible();
  } else if (tabName === 'Players') {
    await expect(element(by.text('Active Players'))).toBeVisible();
  } else if (tabName === 'Tournaments') {
    await expect(element(by.text('Upcoming Tournaments'))).toBeVisible();
  } else if (tabName === 'Stats') {
    await expect(element(by.text('Player Rankings'))).toBeVisible();
  } else if (tabName === 'Achievements') {
    await expect(element(by.text('Your Achievements'))).toBeVisible();
  }
}

// --- Auth Helper ---
async function ensureLoggedOut() {
  console.log('Attempting to ensure logged out state...');
  if (await isElementVisible(by.id('login-button'))) {
    console.log('Already on the login screen.');
    return;
  }
  try {
    if (await isElementVisible(by.id('settings-button'))) {
      await element(by.id('settings-button')).tap();
    } else if (await isElementVisible(by.text('Settings'))) {
      await element(by.text('Settings')).tap();
    } else if (await isElementVisible(by.id('profile-tab-button'))) {
      await element(by.id('profile-tab-button')).tap();
      if (await isElementVisible(by.id('settings-button-in-profile'))) {
        await element(by.id('settings-button-in-profile')).tap();
      } else {
        await element(by.text('Settings')).tap();
      }
    } else {
      if (await isElementVisible(by.text('Home'))) {
          await navigateToTab('Home'); // Use new helper
          if (await isElementVisible(by.id('settings-button'))) {
              await element(by.id('settings-button')).tap();
          }
      }
    }
    await element(by.id('logout-button')).tap();
    console.log('Logout button tapped.');
    await waitFor(element(by.id('login-button'))).toBeVisible().withTimeout(5000);
    console.log('Successfully logged out, login button visible.');
  } catch (e) {
    console.log('Could not perform logout sequence, attempting to check if on login screen. Error:', e.message);
    if (await isElementVisible(by.id('login-button'))) {
      console.log('On login screen after attempted logout sequence.');
      return;
    }
    console.error("Failed to ensure logged out state and not on login screen.");
    throw new Error("Failed to ensure logged out state. App might be in an unexpected state or logout path is incorrect.");
  }
}

// --- Player Helper ---
async function createPlayer(name, nickname) {
  await navigateToTab('Players'); // Use new helper
  await element(by.id('add-player-button')).tap();
  await element(by.id('player-name-input')).typeText(name);
  await element(by.id('player-nickname-input')).typeText(nickname);
  await element(by.id('save-player-button')).tap();
  await expect(element(by.text(name))).toBeVisible();
}

// --- Match Helper ---
async function createMatch(p1Name, p2Name, setScores, matchDescription = '') {
  // setScores is an array of objects e.g. [{p1: 11, p2: 5}, {p1: 5, p2: 11}]
  await navigateToTab('Home'); // Use new helper
  await element(by.id('new-match-button')).tap();
  
  await element(by.id('select-player1')).tap();
  await element(by.text(p1Name)).tap();
  
  await element(by.id('select-player2')).tap();
  await element(by.text(p2Name)).tap();

  for (let i = 0; i < setScores.length; i++) {
    const set = setScores[i];
    await element(by.id(`set${i+1}-player1-score`)).typeText(String(set.p1));
    await element(by.id(`set${i+1}-player2-score`)).typeText(String(set.p2));
  }
  
  await element(by.id('save-match-button')).tap();
  if (matchDescription) {
      await expect(element(by.text(matchDescription))).toBeVisible();
  } else {
      await expect(element(by.text(`${p1Name} vs ${p2Name}`))).toBeVisible();
  }
}

// --- Stats/Profile Helper ---
async function getPlayerProfileStats(playerName) {
  await navigateToTab('Players'); // Use new helper
  await element(by.text(playerName)).tap();
  const winsAttrs = await element(by.id('profile-wins-text')).getAttributes();
  const lossesAttrs = await element(by.id('profile-losses-text')).getAttributes();
  const eloAttrs = await element(by.id('profile-elo-text')).getAttributes();
  const stats = {
    wins: parseInt(winsAttrs.text.split('Wins: ')[1]),
    losses: parseInt(lossesAttrs.text.split('Losses: ')[1]),
    elo: parseInt(eloAttrs.text.split('ELO: ')[1]),
  };
  // Navigate back to Players list after fetching stats from profile
  // This could be made more generic, e.g., navigate back or to a specific tab
  try { 
    await element(by.label('Navigate Back')).tap(); 
  } catch (e) { 
    await navigateToTab('Players'); // Fallback to ensure we are back on players list
  }
  return stats;
}

// --- Achievement Helper ---
async function checkAchievement(achievementName, expectedStatus = 'Unlocked', playerSpecific = false, playerName = '') {
  if (playerSpecific && playerName) {
    await navigateToTab('Players');
    await element(by.text(playerName)).tap();
    await element(by.text('Achievements')).tap(); // Assumed button/tab on profile
  } else {
    await navigateToTab('Achievements'); // Main tab
  }

  const achievementTextMatcher = by.text(achievementName);
  const unlockedListMatcher = by.id('unlocked-achievements-list');
  const lockedListMatcher = by.id('locked-achievements-list');

  if (expectedStatus === 'Unlocked') {
    await expect(element(achievementTextMatcher).withAncestor(unlockedListMatcher)).toBeVisible();
  } else { // Expected 'Locked'
    await expect(element(achievementTextMatcher).withAncestor(lockedListMatcher)).toBeVisible();
    // await expect(element(achievementTextMatcher).withAncestor(unlockedListMatcher)).not.toBeVisible();
  }
  await navigateToTab('Home'); // Navigate back to a common screen
}

module.exports = {
  VALID_EMAIL,
  VALID_PASSWORD,
  INVALID_EMAIL,
  INVALID_PASSWORD,
  isElementVisible,
  navigateToTab,
  ensureLoggedOut,
  createPlayer,
  createMatch,
  getPlayerProfileStats,
  checkAchievement,
};
