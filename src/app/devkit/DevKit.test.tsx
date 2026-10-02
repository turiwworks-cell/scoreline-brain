import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { DevKit } from './DevKit';

test('the kit shows every Part 6 material', () => {
  render(<DevKit />);
  for (const name of ['Colours', 'Spectrum', 'Type scale', 'Glass', 'SoftLight', 'Hover light', 'Button', 'Pill', 'Tabs']) {
    expect(screen.getByRole('region', { name })).toBeTruthy();
  }
  expect(screen.getAllByRole('tablist')).toHaveLength(3);
});
