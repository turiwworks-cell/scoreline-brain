import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoState, DEMO_T0 } from '../../domain/testing/demo';
import { scorelineStore } from '../../store';
import { IconSprite, setPhotoManifest } from '../../ui';
import Insights, { type InsightsProps } from './Insights';

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(DEMO_T0);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  scorelineStore.setState({ domain: demoState() });
  setPhotoManifest({ players: {}, coaches: {} });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(props: Partial<InsightsProps> = {}) {
  const calls = { onOpenPlayer: vi.fn(), onOpenGoal: vi.fn() };
  render(
    <>
      <IconSprite />
      <Insights tab="leaders" matchId={1} followed={{ team: 'arg', n: 10 }} {...calls} {...props} />
    </>,
  );
  return calls;
}

describe('insights views', () => {
  it('renders eight ranked players, real event tags and the followed star', () => {
    setup();
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-insight-leader]')];
    expect(rows).toHaveLength(8);
    expect(rows[0]!.dataset.insightLeader).toBe('fra:10');
    expect(within(rows[0]!).getByRole('img', { name: '1 goal' })).toBeTruthy();
    expect(rows[0]!.querySelector('[data-kit-disc]')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Goals tonight' })).toBeTruthy();
  });
  it('hands the player and their match context to the app', () => {
    const calls = setup();
    const button = screen.getByRole('button', { name: /Open Kylian Mbappé, rating/ });
    fireEvent.click(button);
    expect(calls.onOpenPlayer).toHaveBeenCalledWith({ team: 'fra', n: 10 }, 1, button);
  });
  it('hands the exact historical event to the goal callback', () => {
    const calls = setup();
    const button = document.querySelector<HTMLButtonElement>('[data-insight-goal="1:e1"]')!;
    expect(button.textContent).toContain('1–0');
    fireEvent.click(button);
    expect(calls.onOpenGoal).toHaveBeenCalledWith(1, expect.objectContaining({ id: 'e1', score: [1, 0] }), button);
  });
  it('shows appropriate empty states', () => {
    const d = scorelineStore.getState().domain;
    scorelineStore.setState({ domain: { ...d, matches: {}, matchOrder: [] } });
    setup();
    expect(screen.getByText('Nobody has played yet.')).toBeTruthy();
    expect(screen.getByText('No goals yet.')).toBeTruthy();
  });
  it('shows the friendly explanation when no tables were sent', () => {
    setup({ tab: 'tables' });
    expect(screen.getByRole('heading', { name: 'Standings' })).toBeTruthy();
    expect(screen.getByText('No tables tonight.')).toBeTruthy();
  });
});
