import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { TEAMS } from '../../data/demo/data';
import { DevKit } from './DevKit';


afterEach(cleanup);

test('the kit shows every Part 6 material', () => {
  render(<DevKit />);
  for (const name of ['Colours', 'Spectrum', 'Type scale', 'Glass', 'SoftLight', 'Hover light', 'Button', 'Pill', 'Tabs']) {
    expect(screen.getByRole('region', { name })).toBeTruthy();
  }
  expect(screen.getAllByRole('tablist')).toHaveLength(3);
});

test('the kit shows every Part 7 primitive, and each team-coloured one for every demo team', () => {
  render(<DevKit />);
  for (const name of ['Icons', 'Tags', 'RatingBadge', 'MatchClock', 'PlayerPhoto', 'Feed crests', 'Teams']) {
    expect(screen.getByRole('region', { name })).toBeTruthy();
  }
  const teams = screen.getByTestId('kit-teams');
  for (const t of TEAMS) {
    const row = teams.querySelector(`[data-team="${t.id}"]`) as HTMLElement;
    expect(row, t.id).toBeTruthy();
    expect(within(row).getByRole('img', { name: t.name })).toBeTruthy();
    expect(row.querySelectorAll(`[data-crest="${t.id}"]`).length, t.id).toBeGreaterThanOrEqual(4);
    expect(row.querySelectorAll(`[data-kit-disc="${t.id}"]`), t.id).toHaveLength(3);
  }
});
