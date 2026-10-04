import { defineConfig } from '@playwright/test';
import base from './playwright.rive.config';

export default defineConfig({
  ...base,
  testDir: 'verification/live-export',
  grep: /selected Live artboard/,
  use: { ...base.use, screenshot: 'only-on-failure' },
});
