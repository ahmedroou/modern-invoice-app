import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 20000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  workers: 1, // Single worker for Electron desktop window lifecycle
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    trace: 'on-first-retry',
  },
});
