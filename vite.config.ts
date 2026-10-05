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
  build: {
    target: 'es2022',
    rolldownOptions: {
      treeshake: {
        // Boundary schemas only construct validators: no listeners, timers or registrations.
        // Re-exporting them from domain/index must not eagerly ship Zod to the app shell.
        // Sources retain all used validators in their own chunks. Other modules keep defaults.
        moduleSideEffects: (id) => /[\\/]src[\\/]domain[\\/]schemas\.ts$/.test(id) ? false : undefined,
      },
      output: {
        // React, routing and Motion are already needed by the shell. Compress their used
        // exports together; feature screens, validation and Rive keep their lazy boundaries.
        codeSplitting: {
          groups: [
            { name: 'app-vendor', test: /[\\/]node_modules[\\/](?:react|react-dom|react-router|scheduler|motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
