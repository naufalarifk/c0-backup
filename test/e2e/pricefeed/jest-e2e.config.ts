import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../../../',
  testEnvironment: 'node',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testTimeout: 60000, // 60 seconds for e2e tests
  moduleNameMapper: {
    '^parse-duration$': '<rootDir>/test/__mocks__/parse-duration.js',
    '^@scure/bip32$': '<rootDir>/test/__mocks__/@scure/bip32.js',
    '^@scure/bip39$': '<rootDir>/test/__mocks__/@scure/bip39.js',
    '^@scure/bip39/wordlists/english$': '<rootDir>/test/__mocks__/@scure/bip39-english.js',
    '^uuid$': '<rootDir>/test/__mocks__/uuid.js',
  },
};

export default config;
