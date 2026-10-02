import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// ARCHITECTURE §8 import rules.
// Patterns match both alias-free relative imports and `src/...` style paths.
const up = (dir) => [`**/${dir}`, `**/${dir}/**`];
const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns: patterns.map(([group, message]) => ({ group, message })) }],
});

export default tseslint.config(
  { ignores: ['dist', 'legacy', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // domain/ is pure TS: no React, nothing from the rest of the app.
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: restrict([
      [['react', 'react-dom', 'react/*', 'react-dom/*', 'react-router', 'react-router/*', 'react-router-dom', 'zustand', 'zustand/*', 'motion', 'motion/*'], 'domain/ is pure TypeScript and must not import React or UI libraries.'],
      [[...up('app'), ...up('data'), ...up('store'), ...up('motion'), ...up('rive'), ...up('ui'), ...up('features'), ...up('styles')], 'domain/ imports nothing from the app.'],
    ]),
  },
  // data/ and store/ may import domain/ only.
  {
    files: ['src/data/**/*.{ts,tsx}', 'src/store/**/*.{ts,tsx}'],
    rules: restrict([
      [[...up('app'), ...up('motion'), ...up('rive'), ...up('ui'), ...up('features')], 'data/ and store/ may only import domain/.'],
    ]),
  },
  // ui/ imports no features/.
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: restrict([[up('features'), 'ui/ must not import features/.']]),
  },
  // features/ do not import each other (a feature may import its own folder via ./ or ../).
  ...['matchList', 'match', 'player', 'insights', 'moments'].map((self) => ({
    files: [`src/features/${self}/**/*.{ts,tsx}`],
    rules: restrict([
      [
        ['matchList', 'match', 'player', 'insights', 'moments'].filter((f) => f !== self).flatMap((f) => [`**/features/${f}`, `**/features/${f}/**`, `../${f}`, `../${f}/**`]),
        'features/ must not import each other; move shared code to ui/ or domain/.',
      ],
      [['**/features', '**/features/index'], 'Import a specific feature folder, never the features barrel.'],
    ]),
  })),
);
