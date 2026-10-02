import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('renders the empty app shell', () => {
  render(<App />);
  expect(screen.getByTestId('app-shell')).toBeTruthy();
});
