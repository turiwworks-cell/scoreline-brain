import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoSource } from '../../data/demo';
import { FakeScheduler } from '../../data/testing/fakes';
import type { Feed } from '../../domain';
import { scorelineStore } from '../../store';
import { IconSprite, parsePhotoManifest, setPhotoManifest } from '../../ui';
import { PlayerView, type PlayerViewProps } from './PlayerView';

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function demoFeed(): Feed {
  const feeds: Feed[] = [];
  createDemoSource({ scheduler: new FakeScheduler() }).start((f) => feeds.push(f), () => {}, () => {});
  return feeds[0]!;
}

beforeEach(() => {
  scorelineStore.getState().actions.applyFeed(demoFeed(), Date.now());
  setPhotoManifest(parsePhotoManifest({ players: { 'fra:10': { path: 'fra/10' } }, coaches: {} }));
});
afterEach(() => {
  cleanup();
  setPhotoManifest(null);
});

function setup(props: Partial<PlayerViewProps> = {}) {
  const p = { onFollow: vi.fn(), onBack: vi.fn(), onStep: vi.fn(), ...props };
  const view = render(
    <>
      <IconSprite />
      <PlayerView team="fra" n={10} matchId={1} following={false} chrome="back" missing={<p>missing</p>} {...p} />
    </>,
  );
  return { ...view, ...p };
}

describe('the player view', () => {
  it('shows the bust, the giant number, his name and facts', () => {
    const { container } = setup();
    const end = container.querySelector('[data-pv="bust"]')!;
    expect(end.querySelector('img')?.getAttribute('src')).toBe('/img/players/fra/10-bust@1x.webp');
    expect(end.querySelector('source[type="image/avif"]')).toBeTruthy();
    expect(container.querySelector('[data-pv="number"]')?.textContent).toBe('10');
    expect(screen.getByRole('heading', { name: 'Kylian Mbappé' })).toBeTruthy();
    expect(container.querySelectorAll('[data-pv="fact"]')).toHaveLength(4);
  });

  it('a player without a photo gets the kit disc, and no giant number', () => {
    const { container } = setup({ team: 'arg', n: 7 });
    expect(container.querySelector('[data-pv="bust"] [data-kit-disc]')).toBeTruthy();
    expect(container.querySelector('[data-pv="number"]')).toBeNull();
  });

  it('a photo that fails to load falls back to the kit disc', () => {
    const { container } = setup();
    fireEvent.error(container.querySelector('[data-pv="bust"] img')!);
    expect(container.querySelector('[data-pv="bust"] [data-kit-disc]')).toBeTruthy();
  });

  it('calls back, follows and steps', () => {
    const { onBack, onFollow, onStep } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(onFollow).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next player' }));
    expect(onStep).toHaveBeenCalledWith(expect.objectContaining({ team: 'fra' }), 1);
    fireEvent.click(screen.getByRole('button', { name: 'Previous player' }));
    expect(onStep).toHaveBeenLastCalledWith(expect.objectContaining({ team: 'fra' }), -1);
  });

  it('a pane has no back button; a sheet closes', () => {
    setup({ chrome: 'none' });
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    cleanup();
    setup({ chrome: 'close' });
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('this match: minutes, rating, tags and bars for a player who played; a note for one who did not', () => {
    const { container } = setup();
    expect(container.querySelector('[data-pv="match"]')?.getAttribute('data-played')).toBe('yes');
    expect(container.querySelector('[data-pv="rating"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-pv="stat"]').length).toBeGreaterThanOrEqual(2);
    cleanup();
    const bench = scorelineStore.getState().domain.matches[1]!.lineups!.home!.bench[0]!;
    const view = setup({ n: bench });
    // an unused substitute (or one who came on) either way the block is there
    expect(view.container.querySelector('[data-pv="match"]')).toBeTruthy();
  });

  describe('a goalkeeper', () => {
    const statLabels = (c: HTMLElement) => [...c.querySelectorAll('[data-pv="stat"]')].map((r) => r.querySelector('.barLabel')?.textContent);
    const line = () => scorelineStore.getState().domain.matches[1]!.players!.home['16']!;

    it('has saves where the others have shots, and they agree with the data', () => {
      const saves = line().saves;
      expect(saves).toBeTypeOf('number');
      const { container } = setup({ n: 16 });
      expect(statLabels(container)).toEqual(['Touches', 'Pass accuracy', 'Saves']);
      // the chip says the same number as the data, when he has made any
      const chip = container.querySelector('[data-kind="saves"]');
      if ((saves ?? 0) > 0) expect(chip?.textContent).toBe(saves === 1 ? '1 save' : `${saves} saves`);
      else expect(chip).toBeNull();
    });

    it('is not told he has no goals or assists', () => {
      setup({ n: 16 });
      expect(screen.queryByText('No goals or assists yet')).toBeNull();
    });

    it('with no count from the provider shows none, not a 0', () => {
      const m = scorelineStore.getState().domain.matches[1]!;
      const home = { ...m.players!.home, '16': Object.fromEntries(Object.entries(m.players!.home['16']!).filter(([k]) => k !== 'saves')) };
      scorelineStore.getState().actions.applyFeed({ ...demoFeed(), matches: [{ ...demoFeed().matches[0]!, seq: m.seq + 1, players: { home, away: m.players!.away } }] }, Date.now());
      expect(scorelineStore.getState().domain.matches[1]!.players!.home['16']).not.toHaveProperty('saves');
      const { container } = setup({ n: 16 });
      expect(statLabels(container)).toEqual(['Touches', 'Pass accuracy']);
      expect(container.querySelector('[data-kind="saves"]')).toBeNull();
      expect(screen.queryByText('No goals or assists yet')).toBeNull();
      expect(screen.queryByText('No saves yet')).toBeNull();
    });

    it('a keeper who has made no save says so', () => {
      const m = scorelineStore.getState().domain.matches[1]!;
      const home = { ...m.players!.home, '16': { ...m.players!.home['16']!, saves: 0 } };
      scorelineStore.getState().actions.applyFeed({ ...demoFeed(), matches: [{ ...demoFeed().matches[0]!, seq: m.seq + 1, players: { home, away: m.players!.away } }] }, Date.now());
      const { container } = setup({ n: 16 });
      expect(screen.getByText('No saves yet')).toBeTruthy();
      expect(statLabels(container)).toEqual(['Touches', 'Pass accuracy', 'Saves']);
    });

    it('keeps the goal he scored', () => {
      const m = scorelineStore.getState().domain.matches[1]!;
      const goal = { id: 'keeper-goal', seq: m.seq + 1, kind: 'goal' as const, side: 'home' as const, minute: 50, player: 16, score: [3, 1] as [number, number] };
      scorelineStore.getState().actions.applyFeed({ ...demoFeed(), matches: [{ ...demoFeed().matches[0]!, seq: m.seq + 1, events: [...m.events, goal] }] }, Date.now());
      const { container } = setup({ n: 16 });
      expect(container.querySelector('[data-kind="goal"]')?.textContent).toBe('1 goal');
    });

    it('an outfield player keeps his shots and his own empty line', () => {
      const m = scorelineStore.getState().domain.matches[1]!;
      const busy = new Set(m.events.flatMap((e) => (e.side === 'home' ? [e.player, e.other] : [])));
      const quiet = m.lineups!.home!.xi.find((n) => n !== 16 && !busy.has(n))!;
      const { container } = setup({ n: quiet });
      expect(statLabels(container)).toEqual(['Touches', 'Pass accuracy', 'Shots']);
      expect(screen.getByText('No goals or assists yet')).toBeTruthy();
      expect(container.querySelector('[data-kind="saves"]')).toBeNull();
    });
  });

  it('a clock tick does not rebuild the hero', () => {
    vi.useFakeTimers();
    const { container } = setup();
    const img = container.querySelector('[data-pv="bust"] img');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.querySelector('[data-pv="bust"] img')).toBe(img);
    vi.useRealTimers();
  });

  it('shows the missing screen for an unknown team', () => {
    setup({ team: 'zzz' });
    expect(screen.getByText('missing')).toBeTruthy();
  });
});
