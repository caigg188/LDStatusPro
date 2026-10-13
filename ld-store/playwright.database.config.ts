import { defineConfig, devices } from '@playwright/test';

if (process.env.REPORT_DATABASE_E2E !== 'true' || process.env.NODE_ENV === 'production')
  throw new Error('Run database acceptance explicitly in an isolated test environment');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/report-workflow.database.spec.ts',
  outputDir: './test-results/database',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4198',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } }
  ],
  webServer: [
    {
      command: 'node --import ./scripts/test-sandbox.mjs --import tsx scripts/acceptance/report-server.mjs',
      cwd: '../../ld-store-backend-new',
      url: 'http://127.0.0.1:8798/api/health',
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      command: 'node node_modules/vite/bin/vite.js --config vite.database.config.js',
      url: 'http://127.0.0.1:4198',
      reuseExistingServer: false
    },
    {
      command: 'node node_modules/vite/bin/vite.js --config vite.database.config.js',
      cwd: '../../ldsp-admin-panel',
      url: 'http://127.0.0.1:4174/login',
      reuseExistingServer: false
    }
  ]
});
