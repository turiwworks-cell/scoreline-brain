/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';

export default defineConfig({
  plugins: [react()],
  define: {
    __RIVE_ASSETS__: JSON.stringify({
      liveIcon: existsSync(new URL('./public/rive/live-icon.riv', import.meta.url)),
      moments: existsSync(new URL('./public/rive/moments.riv', import.meta.url)),
    }),
  },
  css: { modules: { localsConvention: 'camelCaseOnly' } },
  build: { target: 'es2022' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
