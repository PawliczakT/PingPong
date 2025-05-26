const { device, element, by, waitFor } = require('detox');
const helpers = require('./helpers.e2e.js');

describe('Authentication', () => {
  // beforeEach for auth tests is not strictly necessary here if ensureLoggedOut is called in each test
  // but can be kept if there are other suite-specific setups in the future.
  beforeEach(async () => {
    // device.reloadReactNative() is in the main beforeEach of original file,
    // which will be replicated in each new test file's main describe.
    // ensureLoggedOut will be called at the start of each 'it' block.
  });

  it('should display an error for invalid login attempt', async () => {
    await helpers.ensureLoggedOut();
    await element(by.id('email-input')).typeText(helpers.INVALID_EMAIL);
    await element(by.id('password-input')).typeText(helpers.INVALID_PASSWORD);
    await element(by.id('login-button')).tap();
    
    await waitFor(element(by.text('Invalid credentials'))).toBeVisible().withTimeout(2000); 
    await expect(element(by.id('login-button'))).toBeVisible();
  });

  it('should login with valid credentials and then logout', async () => {
    await helpers.ensureLoggedOut();

    // Login
    await element(by.id('email-input')).typeText(helpers.VALID_EMAIL);
    await element(by.id('password-input')).typeText(helpers.VALID_PASSWORD);
    await element(by.id('login-button')).tap();
    
    await waitFor(element(by.text('Recent Matches'))).toBeVisible().withTimeout(5000); 

    // Logout
    // Simplified logout navigation as ensureLoggedOut handles complex cases.
    // This assumes that from 'Recent Matches', a settings/logout path is available.
    // The ensureLoggedOut function itself provides more robust ways to get to settings.
    // For this test, we are testing the logout *after* a successful login.
    let settingsButtonVisible = await helpers.isElementVisible(by.id('settings-button'));
    if (settingsButtonVisible) {
        await element(by.id('settings-button')).tap();
    } else if (await helpers.isElementVisible(by.text('Settings'))) {
        await element(by.text('Settings')).tap();
    } else {
        // Attempt a more direct navigation if common buttons aren't found
        // This might involve navigating to a specific tab first if settings is nested
        await helpers.navigateToTab('Home'); // Go home first
        if (await helpers.isElementVisible(by.id('settings-button'))) {
            await element(by.id('settings-button')).tap();
        } else {
             console.warn("Settings button not found for direct logout in test. The ensureLoggedOut helper has more complex navigation attempts.");
             // If logout is directly accessible or via another known path from home:
             // await element(by.id('some_other_logout_path_button')).tap();
        }
    }
    
    await element(by.id('logout-button')).tap();
    await waitFor(element(by.id('login-button'))).toBeVisible().withTimeout(5000);
  });
});
