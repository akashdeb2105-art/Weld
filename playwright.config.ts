import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke — boots the API (hermetic SQLite + seed) and the production web
 * build, then proves the deterministic sample game actually boots, accepts
 * input, and reports state through its read-only test bridge.
 *
 * Hermetic: no Docker, no Postgres, no paid model calls required (§92/§93).
 */

const API_PORT = 8871;
const WEB_PORT = 3370;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npm run e2e:serve -w @weld/api`,
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: `sqlite+pysqlite:///${process.cwd().replace(/\\/g, '/')}/e2e/.tmp/weld-e2e.db`,
        ENVIRONMENT: 'test',
        WELD_API_PORT: String(API_PORT),
      },
    },
    {
      command: `npm run build && npm run start -- -p ${WEB_PORT}`,
      cwd: 'frontend',
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        WELD_API_URL: `http://localhost:${API_PORT}`,
        NODE_ENV: 'production',
      },
    },
  ],
});
