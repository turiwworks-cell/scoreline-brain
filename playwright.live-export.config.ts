import { defineConfig } from '@playwright/test';
import base from './playwright.rive.config';

export default defineConfig({
  ...base,
  grep: /corrected Live candidate/,
  use: { ...base.use, screenshot: 'only-on-failure' },
});
