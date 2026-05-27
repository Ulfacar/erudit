import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite for ERUDIT. Runs against a locally running dev server (next dev --webpack)
 * backed by the local Dockerised Postgres (see .env -> localhost:5433).
 * Start the server first: `npm run dev`.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: false,
  workers: 1, // shared dev server + mutating scenarios -> keep serial
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/.report', open: 'never' }],
    ['json', { outputFile: 'e2e/.results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    navigationTimeout: 90_000, // first hit on a route triggers an on-demand webpack compile
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'e2e',
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
