import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFeed } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { scorelineStore } from '../../store';
import { IconSprite } from '../../ui';
import { MatchList, type MatchListProps } from './MatchList';
import { createFollowPref, type FollowPref } from './follow/pref';

beforeAll(() => {
  // jsdom has no canvas to measure text on (the code falls back to an estimate) and no ResizeObserver
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  scorelineStore.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now());
});
afterEach(cleanup);

const memoryPref = (initial: { team: string; n: number } | null = { team: 'arg', n: 10 }): FollowPref => {
  const store = new Map<string, string>();
  return createFollowPref(initial, { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
};

function setup(props: Partial<MatchListProps> = {}) {
  const calls = {
    onDay: vi.fn(),
    onLive: vi.fn(),
    onOpenMatch: vi.fn(),
    onOpenPlayer: vi.fn(),
  };
  const pref = memoryPref();
  const view = render(
    <>
      <IconSprite />
      <MatchList list={{ day: 0, live: false }} pref={pref} {...calls} {...props} />
    </>,
  );
  return { ...calls, pref, ...view };
}

describe('the day', () => {
  it('groups the day’s matches: Favourites, then each league, with a count', () => {
    setup();
    const groups = screen.getAllByRole('button', { expanded: true }).filter((b) => b.className.includes('toggle') && b.closest('[data-group]'));
    expect(groups.map((g) => g.textContent)).toEqual(['Favourites1', 'WorldNations Series1', 'EuropeNations League A2', 'EuropeNations League B1', 'AfricaAFCON Qualifiers2']);
    expect(screen.getByRole('button', { name: 'France 2–1 Argentina' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nigeria v Senegal' })).toBeTruthy();
  });

  it('opening a row passes the match and the pressed element', () => {
    const { onOpenMatch } = setup();
    const row = screen.getByRole('button', { name: 'Germany 1–1 Netherlands' });
    fireEvent.click(row);
    expect(onOpenMatch).toHaveBeenCalledWith(3, row);
  });

  it('a row is its match’s focus key, and the open one is current', () => {
    setup({ openId: 2 });
    expect(screen.getByRole('button', { name: 'England 0–1 Brazil' }).getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('[data-focus-key="match-3"]')).toBeTruthy();
  });

  it('a group folds away and comes back', () => {
    setup();
    const head = screen.getByRole('button', { name: /Nations League A/ });
    const rows = document.getElementById(head.getAttribute('aria-controls')!)!;
    expect(rows.hasAttribute('inert')).toBe(false);
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(rows.hasAttribute('inert')).toBe(true);
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
  });

  it('says so when nothing is on that day, or in play', () => {
    setup({ list: { day: 2, live: false } });
    expect(screen.getByText('Nothing scheduled.')).toBeTruthy();
    expect(screen.getByText('Pick another date')).toBeTruthy();
  });
});

describe('the header and the day tabs', () => {
  it('lists the five days with the chosen one selected, and reports a press', () => {
    const { onDay } = setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Sat 19', 'Yesterday', 'TodayOngoing', 'Tomorrow', 'Wed 23']);
    expect(screen.getByRole('tab', { name: 'Today', selected: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Yesterday' }));
    expect(onDay).toHaveBeenCalledWith(-1);
  });

  it('Live is a toggle that shows how many are in play', () => {
    const { onLive } = setup();
    const toggle = screen.getByRole('button', { name: 'Live, 5 in play' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(onLive).toHaveBeenCalledWith(true);
  });

  it('in Ongoing the Today tab says Ongoing and only live matches are listed', () => {
    setup({ list: { day: 0, live: true } });
    expect(screen.getByRole('tab', { name: 'Ongoing', selected: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nigeria v Senegal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ireland 2–1 Poland' })).toBeTruthy();
    // the live cards are the same matches, named as live
    expect(screen.getByRole('button', { name: 'Ireland 2–1 Poland, live' }).getAttribute('data-focus-key')).toBe('live-5');
    expect(screen.getByRole('button', { name: 'Live, 5 in play' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'Live now' })).toBeTruthy();
  });

  it('the menu button waits for its sheet', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-disabled')).toBe('true');
    const onMenu = vi.fn();
    cleanup();
    setup({ onMenu });
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onMenu).toHaveBeenCalled();
  });
});

describe('the player you follow', () => {
  it('shows on Today and Ongoing, and stays out of the way on other days', () => {
    const { rerender, pref } = setup();
    expect(screen.getByRole('region', { name: 'Following' })).toBeTruthy();
    rerender(<MatchList list={{ day: -1, live: false }} pref={pref} onDay={vi.fn()} onLive={vi.fn()} onOpenMatch={vi.fn()} onOpenPlayer={vi.fn()} />);
    expect(screen.queryByRole('region', { name: 'Following' })).toBeNull();
    rerender(<MatchList list={{ day: 0, live: true }} pref={pref} onDay={vi.fn()} onLive={vi.fn()} onOpenMatch={vi.fn()} onOpenPlayer={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Following' })).toBeTruthy();
  });

  it('the card names him, shows his evening and opens his page from the pressed card', () => {
    const { onOpenPlayer } = setup();
    const region = screen.getByRole('region', { name: 'Following' });
    const card = within(region).getByRole('button', { name: 'Lionel Messi, the player you follow' });
    expect(card.getAttribute('data-focus-key')).toBe('follow-arg-10');
    expect(within(card).getAllByText('Messi').length).toBeGreaterThan(0);
    expect(within(card).getByText('vs France')).toBeTruthy();
    for (const label of ['Rating', 'Touches', 'Passes', 'Shots']) expect(within(card).getByText(label)).toBeTruthy();
    fireEvent.click(card);
    expect(onOpenPlayer).toHaveBeenCalledWith({ team: 'arg', n: 10 }, card);
  });

  it('opens and closes, keeping one shared face for the flight', () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Show less' });
    const face = () => Array.from(document.querySelectorAll('[data-shared="player:arg:10:photo"]'));
    expect(face()).toHaveLength(1);
    expect(face()[0]!.className).toMatch(/chest|kit/);
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show more' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[data-open="false"]')).toBeTruthy();
    expect(face()).toHaveLength(1);
    expect(face()[0]!.className).toMatch(/faceBox/);
  });

  it('Change opens the picker, a chip follows someone else, Unfollow leaves the picker open', () => {
    const { pref } = setup();
    fireEvent.click(within(screen.getByRole('region', { name: 'Following' })).getByRole('button', { name: 'Change' }));
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Messi', pressed: true })).toBeTruthy();
    const mbappe = screen.getByRole('button', { name: 'Mbappé', pressed: false });
    fireEvent.click(mbappe);
    expect(pref.get()).toEqual({ team: 'fra', n: 10 });
    expect(screen.getByRole('button', { name: 'Kylian Mbappé, the player you follow' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }));
    expect(pref.get()).toBeNull();
    expect(screen.getByRole('region', { name: 'Your player' })).toBeTruthy();
    expect(screen.getByText('Follow a player')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Messi' }));
    expect(pref.get()).toEqual({ team: 'arg', n: 10 });
  });

  it('Done puts the card back as it was', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
  });
});

describe('before there is any data', () => {
  beforeEach(() => {
    scorelineStore.setState((s) => ({ domain: { ...s.domain, loaded: false } }));
  });
  afterEach(() => {
    scorelineStore.setState((s) => ({ domain: { ...s.domain, loaded: true } }));
  });

  it('offers the demo instead of an empty list', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Play the demo matchday' }).getAttribute('href')).toBe('/?demo');
    expect(screen.queryByRole('region', { name: 'Following' })).toBeNull();
  });
});

describe('a goal', () => {
  it('lets a row flash without re-rendering the list', async () => {
    setup();
    const row = screen.getByRole('button', { name: 'France 2–1 Argentina' });
    await act(async () => {
      scorelineStore.getState().actions.applyFeed(
        parseFeed({ ...demoFeedJson(), matches: demoFeedJson().matches.map((m) => (m.id === 1 ? { ...m, seq: 2, score: [3, 1] } : m)) }),
        Date.now() + 1000,
      );
    });
    expect(screen.getByRole('button', { name: 'France 3–1 Argentina' })).toBe(row);
  });
});
