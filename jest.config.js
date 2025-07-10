module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|isows|@supabase/.*|@trpc/.*|superjson|zustand))',
  ],
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    './jest.setup.js'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^react-native-get-random-values$': '<rootDir>/__mocks__/react-native-get-random-values.js',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/app/lib/$1',
    '^@/store/(.*)$': '<rootDir>/store/$1',
    '^@/constants/(.*)$': '<rootDir>/constants/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/screens/(.*)$': '<rootDir>/screens/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/(.*)$': '<rootDir>/$1'
  },
  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest.setup.js',
    '!**/coverage/**',
    '!**/metro.config.js',
    '!**/app.config.js'
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70
    }
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/'
  ]
};
