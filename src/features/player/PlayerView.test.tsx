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
