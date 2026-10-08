import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFeed } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { scorelineStore } from '../../store';
import { IconSprite, parsePhotoManifest, setPhotoManifest } from '../../ui';
import { MatchDetail, type MatchDetailProps } from './MatchDetail';

beforeAll(() => {
  // jsdom has no canvas to measure text on (the code falls back to an estimate) and no ResizeObserver
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
beforeEach(() => {
  scorelineStore.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now());
});
afterEach(() => {
  cleanup();
  setPhotoManifest(null);
});

function setup(props: Partial<MatchDetailProps> = {}) {
  const calls = { onBack: vi.fn(), onTab: vi.fn(), onOpenPlayer: vi.fn() };
  const view = render(
    <>
      <IconSprite />
      <MatchDetail id={1} tab="facts" chrome="back" missing={<p>Not found</p>} {...calls} {...props} />
    </>,
  );
  return { ...calls, ...view };
}

describe('the screen', () => {
  it('names the match, the league and the four tabs', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'France – Argentina' })).toBeTruthy();
    expect(screen.getByText('World · Nations Series')).toBeTruthy();
    const list = within(screen.getByRole('tablist', { name: 'Match' }));
    expect(list.getAllByRole('tab')).toHaveLength(4);
    for (const name of ['Facts', 'Stats', 'Lineup', 'Table']) expect(list.getByRole('tab', { name })).toBeTruthy();
  });

  it('hands tab changes, back and a scorer to the app', () => {
    const { onTab, onBack, onOpenPlayer } = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));
    expect(onTab).toHaveBeenCalledWith('stats');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    const scorer = screen.getByRole('button', { name: /Mbappé/ });
    fireEvent.click(scorer);
    expect(onOpenPlayer).toHaveBeenCalledWith({ team: 'fra', n: 10 }, scorer);
  });

  it('shows what the app gives it for a match that isn’t there', () => {
    setup({ id: 99 });
    expect(screen.getByText('Not found')).toBeTruthy();
  });

  it('calls the third tab Squad before kick-off', () => {
    setup({ id: 6 });
    expect(screen.getByRole('tab', { name: 'Squad' })).toBeTruthy();
  });
});

describe('Facts', () => {
  it('shows the real momentum chart, the commentary newest first and the match info', () => {
    const { container } = setup();
    expect(container.querySelector('[data-momentum="1"]')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Match momentum/ })).toBeTruthy();
    expect(container.querySelector('[data-wave="home"]')).toBeTruthy();
    expect(container.querySelector('[data-part="12"]')).toBeNull();
    const rows = Array.from(container.querySelectorAll('[data-row]')).map((r) => r.getAttribute('data-row'));
    expect(rows[rows.length - 1]).toBe('ko');
    expect(rows).toContain('ht');
    expect(screen.getByRole('region', { name: 'Match info' }).textContent).toContain('20:45');
  });

  it('shows the first ten events and a button for the rest', () => {
    const json = demoFeedJson() as unknown as { matches: { events?: unknown[] }[] };
    const extra = Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, seq: 20 + i, kind: 'corner', side: 'home', minute: 50 + i }));
    json.matches[0]!.events = [...(json.matches[0]!.events ?? []), ...extra];
    scorelineStore.getState().actions.applyFeed(parseFeed(json), Date.now());
    const { container } = setup();
    expect(container.querySelectorAll('[data-row="e"]')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 13 events' }));
    expect(container.querySelectorAll('[data-row="e"]')).toHaveLength(13);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
  });

  it('opens a live event at the top of the commentary', () => {
    const { container } = setup();
    const before = container.querySelectorAll('[data-row="e"]').length;
    act(() => {
      scorelineStore.getState().actions.applyEvent({ id: 'live-1', seq: 2, match: 1, kind: 'corner', side: 'away', minute: 59, text: 'Corner won by De Paul.' });
    });
    const events = container.querySelectorAll('[data-row="e"]');
    expect(events.length).toBe(before + 1);
    expect(events[0]!.textContent).toContain('Corner won by De Paul.');
  });

  it('shows the kick-off time and both sides’ form before kick-off', () => {
    setup({ id: 6 });
    // the big time under the heading, and again in the match info
    expect(screen.getAllByText('21:00')).toHaveLength(2);
    const form = screen.getByRole('region', { name: 'Form' });
    expect(within(form).getByText('Nigeria')).toBeTruthy();
    expect(within(form).getByText('Senegal')).toBeTruthy();
  });
});

describe('a goal in the commentary', () => {
  // a fresh feed: the goals are Mbappé 12', Messi 33' and Olise 52', all within the first ten rows
  beforeEach(() => scorelineStore.getState().actions.resetFeed(parseFeed(demoFeedJson()), Date.now()));
  const goals = () => [...document.querySelectorAll<HTMLElement>('[data-row="e"]')].filter((r) => r.querySelector('.goalPhoto'));
  const tileOf = (scorer: string) => goals().find((r) => r.querySelector('.goalName')?.textContent === scorer)?.querySelector('[data-photo]');

  it("shows the scorer's photo when there is one, and the kit disc when there is none", () => {
    setPhotoManifest(parsePhotoManifest({ players: { 'fra:10': { path: 'fra/10' } }, coaches: {} }));
    setup();
    expect(goals()).toHaveLength(3);
    // Mbappé has files: his bust, not his number
    expect(tileOf('Mbappé')?.getAttribute('data-photo')).toBe('bust');
    expect(tileOf('Mbappé')?.querySelector('img')?.getAttribute('src')).toBe('/img/players/fra/10-bust@1x.webp');
    // a scorer the manifest has no files for keeps the valid fallback, with his number
    for (const name of ['Messi', 'Olise']) {
      expect(tileOf(name)?.getAttribute('data-photo')).toBe('kit');
      expect(tileOf(name)?.querySelector('img')).toBeNull();
    }
  });

  it('waits for the photo manifest rather than flashing a kit disc first', () => {
    setPhotoManifest(null);
    setup();
    expect(goals()).toHaveLength(3);
    for (const r of goals()) expect(r.querySelector('.goalPhoto')?.childElementCount).toBe(0);
  });

  it('has no chevron beside the score: the row does nothing when pressed', () => {
    setPhotoManifest(parsePhotoManifest({ players: {}, coaches: {} }));
    setup();
    expect(goals()).toHaveLength(3);
    for (const r of goals()) {
      expect(r.querySelector('use[href="#sl-i-chevR"]')).toBeNull();
      expect(r.querySelector('button')).toBeNull();
      // the score, in its capsule, is still there
      expect(r.querySelector('.chip')?.textContent).toMatch(/\d–\d/);
    }
  });
});

describe('Stats', () => {
  it('shows possession and the top stats', () => {
    setup({ tab: 'stats' });
    expect(screen.getByRole('region', { name: 'Possession' })).toBeTruthy();
    const top = screen.getByRole('region', { name: 'Top stats' });
    expect(within(top).getByText('xG')).toBeTruthy();
    expect(within(top).getByText('Corners')).toBeTruthy();
  });

  it('shows the form instead before kick-off', () => {
    setup({ id: 6, tab: 'stats' });
    expect(screen.getByRole('region', { name: 'Form' })).toBeTruthy();
  });
});

describe('Table', () => {
  it('says a league without a table has none', () => {
    setup({ tab: 'table' });
    expect(screen.getByText('Friendlies have no table.')).toBeTruthy();
  });

  it('marks the qualifying places and the match’s sides', () => {
    const json = demoFeedJson() as unknown as { leagues: Record<string, unknown>[] };
    json.leagues = json.leagues.map((l) =>
      l.id === 'wns'
        ? {
            ...l,
            qualify: 2,
            qualifyLabel: 'Qualify · top two',
            table: [
              { team: 'fra', p: 2, w: 2, d: 0, l: 0, gf: 4, ga: 1, pts: 6 },
              { team: 'eng', p: 2, w: 1, d: 0, l: 1, gf: 2, ga: 2, pts: 3 },
              { team: 'arg', p: 2, w: 0, d: 1, l: 1, gf: 1, ga: 2, pts: 1 },
              { team: 'bra', p: 2, w: 0, d: 1, l: 1, gf: 1, ga: 3, pts: 1 },
            ],
          }
        : l,
    );
    scorelineStore.getState().actions.applyFeed(parseFeed(json), Date.now());
    const { container } = setup({ tab: 'table' });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[1]!.textContent)).toEqual(['France', 'England', 'Argentina', 'Brazil']);
    expect(within(rows[0]!).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', 'France', '2', '2-0-0', '+3', '6']);
    // France and Argentina are playing now
    expect(within(rows[0]!).getByRole('img', { name: 'Playing now' })).toBeTruthy();
    expect(container.querySelectorAll('[data-strong]').length).toBeGreaterThan(0);
    expect(screen.getByText('Qualify · top two')).toBeTruthy();
  });
});
