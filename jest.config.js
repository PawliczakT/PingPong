module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['@babel/preset-typescript'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/app/lib/$1',
    '^@/store/(.*)$': '<rootDir>/store/$1',
    '^@/constants/(.*)$': '<rootDir>/constants/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/screens/(.*)$': '<rootDir>/screens/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/backend/(.*)$': '<rootDir>/backend/$1',
    '^@/(.*)$': '<rootDir>/$1'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/'
  ],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};
