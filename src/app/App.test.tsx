import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';


afterEach(cleanup);

test('renders the empty app shell', () => {
  render(<App />);
  expect(screen.getByTestId('app-shell')).toBeTruthy();
});

test('mounts the one icon sprite at the root', () => {
  render(<App />);
  expect(screen.getAllByTestId('icon-sprite')).toHaveLength(1);
});
