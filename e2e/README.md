# End-to-End Testing with Detox

This directory contains end-to-end tests for the PingPong app using Detox.

## Setup

Detox has been configured for this project with the following files:

- `.detoxrc.js` - Detox configuration file
- `e2e/jest.config.js` - Jest configuration for Detox tests
- `e2e/init.js` - Initialization file for Detox tests
- `e2e/app.e2e.test.js` - Comprehensive E2E test for the application

## Prerequisites

Before running the tests, make sure you have the following installed:

1. For Android testing:
   - Android SDK
   - Android Emulator with a device created (Pixel_4_API_30 is configured by default)

2. For iOS testing:
   - Xcode
   - iOS Simulator

## Running the Tests

The following npm scripts have been added to package.json for running Detox tests:

```bash
# Build the app for E2E testing (default configuration)
npm run e2e:build

# Run the E2E tests (default configuration)
npm run e2e:test

# Build the app for Android E2E testing
npm run e2e:build:android

# Run the E2E tests on Android
npm run e2e:test:android

# Build the app for iOS E2E testing
npm run e2e:build:ios

# Run the E2E tests on iOS
npm run e2e:test:ios
```

## Test Coverage

The comprehensive E2E test (`app.e2e.test.js`) covers the following functionality:

1. Navigation through the main tabs of the application
2. Creating a new player and verifying it appears in the players list
3. Creating a new match and verifying it appears in recent matches
4. Creating a tournament and verifying it appears in the tournaments list
5. Viewing tournament details and starting the tournament
6. Recording match results in the tournament
7. Completing the tournament and verifying the winner
8. Checking player profile and verifying stats and achievements
9. Checking the rankings in the Stats tab
10. Checking the achievements tab and verifying unlocked achievements
11. Checking the settings and app information

This test ensures that all major features of the application work together correctly, providing confidence that implementing new features won't break existing functionality.

## Customizing Tests

To add more tests or modify existing ones:

1. Create new test files in the `e2e` directory with the `.e2e.test.js` extension
2. Follow the Detox API for writing tests (see [Detox documentation](https://github.com/wix/Detox/blob/master/docs/README.md))
3. Run the tests using the npm scripts mentioned above

## Troubleshooting

If you encounter issues running the tests:

1. Make sure the emulator/simulator is running before starting the tests
2. Check that the app builds correctly with `npm run e2e:build`
3. Verify that the device configuration in `.detoxrc.js` matches your available devices
4. For more detailed logs, add the `--loglevel verbose` flag to the test command
