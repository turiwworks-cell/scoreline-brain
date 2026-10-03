import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'verification/rive',
  timeout: 90_000,
  workers: 1,
  retries: 0,
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4177 --strictPort',
    url: 'http://127.0.0.1:4177/verification/rive/fixture.html',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:4177',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--enable-precise-memory-info'] },
  },
  projects: [
    { name: 'phone-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'tablet-900x800', use: { viewport: { width: 900, height: 800 } } },
    { name: 'desktop-1280x892', use: { viewport: { width: 1280, height: 892 } } },
  ],
});
