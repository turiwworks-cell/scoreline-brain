import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFeed } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { scorelineStore } from '../../store';
import { IconSprite } from '../../ui';
import { FollowCard, type FollowCardProps } from './FollowCard';
import { goalFeed } from './goalFeed';
import { FRESH, type FollowLive } from './follow/live';

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let seq = 100;
/** Shows match 1 (France v Argentina) as `patch` says, and, if given, what the feed says comes next. */
function show(patch: Record<string, unknown>, next?: Record<string, unknown>) {
  const f = demoFeedJson();
  seq += 1;
  // the feed's fixtures are merged in, never removed: start each show from none
  scorelineStore.setState((s) => ({ domain: { ...s.domain, next: {} } }));
  scorelineStore.getState().actions.applyFeed(
    parseFeed({ ...f, next: next ?? {}, matches: f.matches.map((m) => (m.id === 1 ? { ...m, seq, ...patch } : m)) }),
    Date.now(),
  );
}
const events = () => demoFeedJson().matches[0]!.events as unknown as Record<string, unknown>[];
const NEXT = { arg: { opponent: 'esp', date: 'Sat 26 Sep', time: '20:45', in: (3 * 24 + 4) * 3600 + 5 * 60 + 30 } };

function card(props: Partial<FollowCardProps> = {}, live: FollowLive = FRESH) {
  const rest = { followed: { team: 'arg', n: 10 }, live, open: true, hidden: false, onToggle: vi.fn(), onOpenPlayer: vi.fn(), ...props };
  return render(
    <>
      <IconSprite />
      <FollowCard {...rest} />
    </>,
  );
}
const root = () => document.querySelector<HTMLElement>('[data-phase]')!;
const full = () => root().style.getPropertyValue('--full');

beforeEach(() => {
  show({});
});

describe('before kick-off', () => {
  beforeEach(() => show({ status: 'scheduled', minute: 0, score: [0, 0], kickoff: '20:45', events: [] }));

  it('says when, and against whom', () => {
    card();
    expect(root().dataset.phase).toBe('pre');
    expect(full()).toBe('200');
    expect(screen.getByText('Kick-off')).toBeTruthy();
    expect(screen.getByText('20:45')).toBeTruthy();
    expect(screen.getByText('Opponent')).toBeTruthy();
    expect(screen.getAllByText('France').length).toBeGreaterThan(0);
    expect(screen.getByText('Today · kick-off 20:45')).toBeTruthy();
  });
});

describe('while he plays', () => {
  it('open: 266 tall, with the ball and what he is doing', () => {
    card({}, { ...FRESH, ball: true, ballAt: 5, acts: [{ t: 5, txt: 'Dribbles past Upamecano', kind: 'dribble', clock: '58:14' }] });
    expect(root().dataset.phase).toBe('live');
    expect(full()).toBe('266');
    expect(screen.getByText('Dribbles past Upamecano')).toBeTruthy();
    expect(screen.getByText('58:14')).toBeTruthy();
    expect(document.querySelector('[data-ball]')).toBeTruthy();
  });

  it('before anything has happened, it is watching', () => {
    card();
    expect(screen.getByText('Watching every touch…')).toBeTruthy();
  });

  it('off the ball it says so, with the last act under it', () => {
    card({}, { ...FRESH, ball: false, ballAt: 9, acts: [{ t: 5, txt: 'Dribbles past Upamecano', kind: 'dribble', clock: '58:14' }] });
    expect(screen.getByText('Off the ball right now')).toBeTruthy();
    expect(screen.getByText('Dribbles past Upamecano')).toBeTruthy();
    expect(document.querySelector('[data-ball]')).toBeNull();
  });

  it('his goals are chips with the minute', () => {
    card();
    expect(screen.getByText("33'")).toBeTruthy();
  });

  it('on the bench: 200 tall and the card says so', () => {
    cleanup();
    card({ followed: { team: 'arg', n: 2 } });
    expect(full()).toBe('200');
    expect(screen.getByText('On the bench')).toBeTruthy();
    expect(screen.getByText("Didn't play")).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
  });

  it('closed: the card shrinks to its short form', () => {
    card({ open: false });
    expect(root().dataset.open).toBe('false');
    expect(root().hasAttribute('data-short')).toBe(true);
  });

  it('hidden under the picker', () => {
    card({ hidden: true });
    expect(root().hidden).toBe(true);
  });

  it('nothing on it is marked to fly to the player page: he opens the same from everywhere', () => {
    card({ open: false });
    expect(document.querySelectorAll('[data-shared], [data-shared-end]')).toHaveLength(0);
  });
});

describe('after his match', () => {
  beforeEach(() => show({ status: 'finished', minute: 90 }, NEXT));

  it('300 tall: minutes, how it ended, his next fixture and a countdown', () => {
    card();
    expect(root().dataset.phase).toBe('post');
    expect(full()).toBe('300');
    expect(screen.getByText('Minutes')).toBeTruthy();
    expect(screen.getByText('Full time · FRA 2–1 ARG')).toBeTruthy();
    expect(screen.getByText('Next match')).toBeTruthy();
    expect(screen.getByText('vs Spain')).toBeTruthy();
    expect(screen.getByText('Sat 26 Sep · 20:45')).toBeTruthy();
    expect(screen.getByText('Kick-off in')).toBeTruthy();
    const units = Array.from(document.querySelectorAll('[class*="unit"]:not([class*="unitName"])')).map((u) => u.textContent);
    expect(units).toEqual(['03D', '04H', '05M']);
  });

  it('how it ended is one line that shrinks to the room the tags leave it', () => {
    card();
    const note = screen.getByText('Full time · FRA 2–1 ARG');
    const size = parseFloat(note.style.fontSize);
    expect(size).toBeGreaterThan(8);
    expect(size).toBeLessThanOrEqual(12);
  });

  it('closed, it says who is next and when', () => {
    card({ open: false });
    expect(screen.getByText('Next · vs Spain')).toBeTruthy();
    expect(screen.getByText('Sat 26 Sep')).toBeTruthy();
    expect(screen.getByText('20:45')).toBeTruthy();
  });

  it('with no fixture in the feed nothing is made up', () => {
    show({ status: 'finished', minute: 90 });
    card();
    expect(screen.getByText('Friendly · TBC')).toBeTruthy();
    expect(screen.getAllByText('Date to be confirmed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Kick-off in')).toBeNull();
  });
});

describe('sent off', () => {
  beforeEach(() => show({ events: [...events(), { id: 'r1', seq: 8, kind: 'red', side: 'away', minute: 57, player: 10 }] }));

  it('floods red with the words, then settles into the after-match card', () => {
    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(10_000); // the list's clock starts at 0, and 0 means "no red card yet"
    });
    const now = goalFeed.clock.now();
    card({}, { ...FRESH, redAt: now });
    expect(root().dataset.phase).toBe('red');
    expect(screen.getByText('RED CARD')).toBeTruthy();
    expect(screen.getByText(/Messi · 57' · off/)).toBeTruthy();
    expect(full()).toBe('300');
    act(() => {
      vi.advanceTimersByTime(3300);
    });
    expect(root().dataset.phase).toBe('post');
    expect(screen.queryByText('RED CARD')).toBeNull();
    expect(screen.getByText("Sent off 57'")).toBeTruthy();
  });

  it('a red card he already had when the card appeared is simply after-match', () => {
    card();
    expect(root().dataset.phase).toBe('post');
    expect(screen.getByText("Sent off 57'")).toBeTruthy();
  });
});

describe('his name', () => {
  it('first name small, last name large; a goal swaps in GOAL with the count', () => {
    card();
    const c = within(root());
    expect(c.getByText('Lionel')).toBeTruthy();
    expect(c.getByText('GOAL')).toBeTruthy();
    expect(c.getByText('First goal of the match')).toBeTruthy();
  });
});
