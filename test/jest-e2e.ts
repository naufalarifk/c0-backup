import type { Config } from 'jest';

export default {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  testTimeout: 120000,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  bail: true,
  forceExit: true,
  detectOpenHandles: true,
  globalSetup: '<rootDir>/setup/jest-global-setup.ts',
  globalTeardown: '<rootDir>/setup/jest-global-teardown.ts',
} as Config;
