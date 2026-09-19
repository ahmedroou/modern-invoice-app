import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: 'smoke.spec.ts',
  timeout: 15000,
  retries: 0,
  workers: 1,
});
