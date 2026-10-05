import { defineConfig } from '@playwright/test';

// Part 18's "done when": the dev panel's triggers play both scenes and the toast. The dev panel is
// dev-only (Part 16), so this runs on the dev server, apart from the production browser suite.
export default defineConfig({
  testDir: 'verification/moments',
  workers: 1,
  retries: 0,
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175/',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:4175',
    launchOptions: { args: ['--enable-unsafe-swiftshader'], ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) },
  },
  projects: [
    { name: 'phone-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'tablet-900x800', use: { viewport: { width: 900, height: 800 } } },
    { name: 'desktop-1280x892', use: { viewport: { width: 1280, height: 892 } } },
  ],
});

