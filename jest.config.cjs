/** @type {import('jest').Config} */
module.exports = {
  globalSetup: '<rootDir>/scripts/jest-global-setup.cjs',
  projects: [
    {
      displayName: 'main',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/main/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { diagnostics: false }],
      },
      moduleNameMapper: {
        '^electron$': '<rootDir>/src/main/__mocks__/electron.ts',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
      },
      setupFiles: ['<rootDir>/src/main/jest.setup.cjs'],
    },
    {
      displayName: 'renderer',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/renderer/**/*.test.tsx',
        '<rootDir>/src/renderer/**/*.test.ts',
        '<rootDir>/src/shared/**/*.test.ts',
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { diagnostics: false }],
      },
      moduleNameMapper: {
        '\\.css$': 'identity-obj-proxy',
        '\\.(png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot)$': '<rootDir>/src/renderer/__mocks__/fileMock.ts',
        '^electron$': '<rootDir>/src/main/__mocks__/electron.ts',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
        '^leaflet$': '<rootDir>/src/renderer/__mocks__/leaflet.ts',
        '^leaflet/.*$': 'identity-obj-proxy',
      },
      setupFilesAfterEnv: ['<rootDir>/src/renderer/setupTests.ts'],
    },
  ],
};
