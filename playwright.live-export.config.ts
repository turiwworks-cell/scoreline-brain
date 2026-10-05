import { defineConfig } from '@playwright/test';
import base from './playwright.rive.config';

export default defineConfig({
  ...base,
  grep: /corrected Live production export|full Live host/,
  use: { ...base.use, screenshot: 'only-on-failure' },
});
