import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173',
    // Sandboxes without a matching Playwright download can point at a local Chromium.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'phone-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'tablet-900x800', use: { viewport: { width: 900, height: 800 } } },
    { name: 'desktop-1280x892', use: { viewport: { width: 1280, height: 892 } } },
  ],
});
