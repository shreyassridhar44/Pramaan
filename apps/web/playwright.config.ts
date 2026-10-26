import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests for the R16 scenarios (claude-code/TEST_PLAN.md Section 2). They share one
 * demo database, so they run in order on one worker, and the global setup resets it first.
 * Prerequisites: `docker compose -f infra/compose.dev.yml up -d` and a seeded database.
 * Set E2E_BASE_URL to run against a deployment instead (the suite resets its demo data).
 */
const deployed = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: deployed ?? 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Every spec runs in the installed Chrome. The pointer and sign-in specs also run in Firefox and
  // in WebKit, the engine behind Safari (`npx playwright install firefox webkit` once).
  projects: [
    { name: 'chrome', use: { channel: 'chrome' } },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
      testMatch: /(signin|interactions)\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
      testMatch: /(signin|interactions)\.spec\.ts/,
    },
  ],
  webServer: deployed
    ? []
    : [
        {
          command: 'uv run uvicorn app.main:app --port 8000',
          cwd: '../../services/api',
          url: 'http://localhost:8000/api/v1/healthz',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
})
