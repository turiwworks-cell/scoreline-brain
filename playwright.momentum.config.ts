import { defineConfig } from '@playwright/test';

// Isolated component verification: no changes to Part 11's screen or the app's browser suite.
export default defineConfig({
  testDir: 'verification/momentum',
  workers: 1,
  retries: 0,
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/verification/momentum/fixture.html',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'phone-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'tablet-900x800', use: { viewport: { width: 900, height: 800 } } },
    { name: 'desktop-1280x892', use: { viewport: { width: 1280, height: 892 } } },
  ],
});
