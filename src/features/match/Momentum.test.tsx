import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchEvent, Team } from '../../domain';
import { MotionProvider } from '../../motion/MotionProvider';
import { IconSprite } from '../../ui/IconSprite';
import * as geometry from './momentumGeometry';
import { Momentum, type MomentumProps } from './Momentum';

const home: Team = { id: 'fra', name: 'France', short: 'FRA', colors: ['#0055A4', '#EF4135'] };
const away: Team = { id: 'arg', name: 'Argentina', short: 'ARG', colors: ['#74ACDF', '#F6B40E'] };
const goals: MatchEvent[] = [
  { id: 'g1', seq: 1, kind: 'goal', side: 'home', minute: 12 },
  { id: 'g2', seq: 2, kind: 'goal', side: 'away', minute: 24 },
];
const props: MomentumProps = { matchId: 1, minute: 30, status: 'finished', momentum: Array(31).fill(0.5) as number[], events: goals, home, away };
const view = (patch: Partial<MomentumProps> = {}) => <MotionProvider><IconSprite /><Momentum {...props} {...patch} /></MotionProvider>;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Momentum', () => {
  it('renders the pressure heading, accessible chart and team/axis labels', () => {
    const { container } = render(view());
    expect(screen.getByRole('heading', { name: 'France on top' })).toBeTruthy();
    expect(screen.getByText('100% of the pressure in the last 10 minutes')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Match momentum/ })).toBeTruthy();
    expect(container.querySelector('svg.chart')?.getAttribute('viewBox')).toBe('0 0 322 156');
    expect(screen.getByText('HT')).toBeTruthy();
  });
  it('draws goal balls on opposite scoring sides, capped at 90 minutes', () => {
    const { container } = render(view({ events: [goals[0]!, { ...goals[1]!, minute: 94 }] }));
    const uses = [...container.querySelectorAll('[data-momentum-goal] use')];
    expect(uses.map((u) => u.getAttribute('y'))).toEqual(['2.5', '138.5']);
    expect(uses[1]!.getAttribute('x')).toBe('314.5');
    expect(uses.every((u) => u.getAttribute('href') === '#sl-t-goal')).toBe(true);
  });
  it('shows the live endpoint and future-minutes midline only for an unfinished match', () => {
    const { container, rerender } = render(view({ status: 'live' }));
    expect(container.querySelector('[data-momentum-now]')).toBeTruthy();
    expect(container.querySelector('[data-future-minutes]')).toBeTruthy();
    rerender(view());
    expect(container.querySelector('[data-momentum-now]')).toBeNull();
    expect(container.querySelector('[data-future-minutes]')).toBeNull();
  });
  it('skips chart rendering on parent clock ticks and path computation on minute-only changes', () => {
    const spy = vi.spyOn(geometry, 'momentumPaths');
    const { rerender, container } = render(view());
    const reveal = container.querySelector('[data-wave-reveal]');
    expect(spy).toHaveBeenCalledTimes(1);
    rerender(view());
    expect(spy).toHaveBeenCalledTimes(1);
    rerender(view({ minute: 31 }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-wave-reveal]')).toBe(reveal);
    rerender(view({ momentum: [...props.momentum!] }));
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('uses unique SVG definitions when multiple match charts are mounted', () => {
    const { container } = render(<MotionProvider><Momentum {...props} /><Momentum {...props} matchId={2} /></MotionProvider>);
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('has an even, finite chart without momentum or scoring events', () => {
    const { container } = render(view({ momentum: undefined, events: [], minute: 0, status: 'scheduled' }));
    expect(screen.getByRole('heading', { name: 'Evenly matched' })).toBeTruthy();
    expect(container.querySelectorAll('[data-momentum-goal]')).toHaveLength(0);
    expect(container.querySelector('[data-wave="home"]')?.getAttribute('d')).not.toContain('NaN');
  });
});
