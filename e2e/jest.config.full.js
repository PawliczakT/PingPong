module.exports = {
    rootDir: '..',
    testMatch: ['<rootDir>/e2e/full_journey.e2e.js'],
    testTimeout: 120000,
    maxWorkers: 1,
    globalSetup: 'detox/runners/jest/globalSetup',
    globalTeardown: 'detox/runners/jest/globalTeardown',
    reporters: ['detox/runners/jest/reporter'],
    testEnvironment: 'detox/runners/jest/testEnvironment',
    setupFilesAfterEnv: ['<rootDir>/e2e/jest.setup.js'],
    verbose: true,
};
