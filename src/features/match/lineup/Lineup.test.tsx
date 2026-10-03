import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoSource } from '../../../data/demo';
import { FakeScheduler } from '../../../data/testing/fakes';
import type { Feed, Side } from '../../../domain';
import { scorelineStore } from '../../../store';
import { IconSprite, parsePhotoManifest, setPhotoManifest } from '../../../ui';
import { Lineup, type LineupProps } from './Lineup';

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
/** The demo source's first feed: every formation, the events and ratings the Lua simulates, the coaches. */
function demoFeed(): Feed {
  const feeds: Feed[] = [];
  createDemoSource({ scheduler: new FakeScheduler() }).start(
    (f) => feeds.push(f),
    () => {},
    () => {},
  );
  return feeds[0]!;
}

beforeEach(() => {
  scorelineStore.getState().actions.applyFeed(demoFeed(), Date.now());
  setPhotoManifest(
    parsePhotoManifest({
      players: { 'fra:10': { path: 'fra/10' }, 'fra:16': { path: 'fra/16' }, 'arg:10': { path: 'arg/10' } },
      coaches: { fra: { path: 'fra/0' } },
    }),
  );
});
afterEach(() => {
  cleanup();
  setPhotoManifest(null);
});

function setup(id: number, props: Partial<LineupProps> = {}) {
  const d = scorelineStore.getState().domain;
  const match = d.matches[id]!;
  const onOpenPlayer = vi.fn();
  const onSide = vi.fn();
  const ui = (side: Side) => (
    <>
      <IconSprite />
      <Lineup match={match} home={d.teams[match.home]!} away={d.teams[match.away]!} width={390} side={side} onSide={onSide} onOpenPlayer={onOpenPlayer} {...props} />
    </>
  );
  const view = render(ui(props.side ?? 'home'));
  return { ...view, onOpenPlayer, onSide, rerenderSide: (side: Side) => view.rerender(ui(side)), match, d };
}

describe('a match that has started', () => {
  it('shows the formation, the eleven as buttons in place and the substitutes', () => {
    const { container } = setup(1);
    expect(screen.getByText('4-2-3-1')).toBeTruthy();
    const pitch = container.querySelector('[data-pitch]') as HTMLElement;
    expect(pitch.dataset.formation).toBe('4-2-3-1');
    expect(within(pitch).getAllByRole('button')).toHaveLength(11);
    expect(within(screen.getByRole('list', { name: 'Substitutes' })).getAllByRole('button').length).toBeGreaterThan(5);
    expect(screen.getByText('0 of 5 used')).toBeTruthy();
  });

  it('puts the keeper at the bottom and the forwards at the top, each row in the Lua’s place', () => {
    const { container } = setup(1);
    const at = (key: string) => {
      const slot = container.querySelector(`[data-pitch] [data-player="${key}"]`)!.parentElement as HTMLElement;
      return [parseFloat(slot.style.left) + 38, parseFloat(slot.style.top) + 65];
    };
    expect(at('fra:16')).toEqual([177, 506]); // the keeper
    expect(at('fra:10')).toEqual([177, 98]); // the lone forward
    expect(at('fra:7')[1]).toBe(200);
  });

  it('shows goals, a rating with the best player starred, and the off capsule', () => {
    setup(1);
    const mbappe = screen.getByRole('button', { name: /^10 Mbappé$/ });
    expect(within(mbappe).getByRole('img', { name: '2 goals' })).toBeTruthy();
    expect(within(mbappe).getByRole('img', { name: /best in the match/ })).toBeTruthy();
    cleanup();
    setup(8);
    expect(screen.getAllByRole('img', { name: /^Off \d+'$/ }).length).toBeGreaterThan(0);
  });

  it('lists a substitute who came on with the minute, the rating and whom he replaced, the rest as Unused', () => {
    setup(8);
    const list = within(screen.getByRole('list', { name: 'Substitutes' }));
    expect(list.getByText("64'")).toBeTruthy();
    expect(list.getByText('for Lindelöf')).toBeTruthy();
    expect(list.getAllByText('Unused').length).toBeGreaterThan(3);
    expect(screen.getByText('2 of 5 used')).toBeTruthy();
  });

  it('stars the followed player and nobody else', () => {
    const { container } = setup(1, { side: 'away', followed: { team: 'arg', n: 10 } });
    const messi = container.querySelector('[data-pitch] [data-player="arg:10"]')!;
    expect(messi.querySelector('svg[viewBox="-1 -1 2 2"] path[fill^="url"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-pitch] svg[viewBox="-1 -1 2 2"] path[fill^="url"]')).toHaveLength(1);
  });

  it('opens a player from the pitch and from the bench through the callback, with the pressed button', () => {
    const { onOpenPlayer, container } = setup(1);
    const chip = container.querySelector('[data-pitch] [data-player="fra:10"]') as HTMLElement;
    fireEvent.click(chip);
    expect(onOpenPlayer).toHaveBeenCalledWith({ team: 'fra', n: 10 }, chip);
    const sub = within(screen.getByRole('list', { name: 'Substitutes' })).getAllByRole('button')[0]!;
    fireEvent.click(sub);
    expect(onOpenPlayer).toHaveBeenLastCalledWith({ team: 'fra', n: Number(sub.dataset.player!.split(':')[1]) }, sub);
  });

  it('keeps the chips’ focus keys and the shared face end the navigation reads', () => {
    const { container } = setup(1);
    const chip = container.querySelector('[data-focus-key="chip-fra-10"]')!;
    expect(chip.querySelector('[data-shared="player:fra:10:photo"][data-shared-end="face"]')).toBeTruthy();
  });

  it('asks the app for the other side with the switch', () => {
    const { onSide } = setup(1);
    expect(screen.getByRole('radio', { name: 'France', checked: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Argentina' }));
    expect(onSide).toHaveBeenCalledWith('away');
  });

  it('shows the other team, its formation and its coach when the side changes', () => {
    const { rerenderSide } = setup(1);
    expect(screen.getByText('Didier Deschamps')).toBeTruthy();
    rerenderSide('away');
    expect(screen.getByText('4-3-3')).toBeTruthy();
    expect(screen.getByText('Lionel Scaloni')).toBeTruthy();
    expect(screen.queryByText('Didier Deschamps')).toBeNull();
  });

  it('lays out every formation the demo’s squads use', () => {
    // 4-2-3-1, 4-3-3 and 4-4-2 are in the feed's matches; each puts eleven buttons on the pitch
    const d = scorelineStore.getState().domain;
    const forms = new Set<string>();
    for (const id of d.matchOrder) {
      const m = d.matches[id]!;
      if (m.status === 'scheduled') continue;
      for (const side of ['home', 'away'] as const) {
        const { container, unmount } = render(<Lineup match={m} home={d.teams[m.home]!} away={d.teams[m.away]!} width={390} side={side} onSide={() => {}} onOpenPlayer={() => {}} />);
        const pitch = container.querySelector('[data-pitch]') as HTMLElement;
        forms.add(pitch.dataset.formation!);
        expect(pitch.querySelectorAll('button'), `${m.id} ${side}`).toHaveLength(11);
        unmount();
      }
    }
    expect([...forms].sort()).toEqual(expect.arrayContaining(['4-2-3-1', '4-3-3', '4-4-2']));
  });

  it.each(['3-4-2-1', '4-2-3-1', '4-3-3', '4-4-2'])('lays out %s with the same eleven, each in a row of its own count', (form) => {
    const d = scorelineStore.getState().domain;
    const m = d.matches[1]!;
    const home = m.lineups!.home!;
    const forced = { ...m, lineups: { ...m.lineups, home: { ...home, formation: form } } };
    const { container } = render(<Lineup match={forced} home={d.teams[m.home]!} away={d.teams[m.away]!} width={390} side="home" onSide={() => {}} onOpenPlayer={() => {}} />);
    const slots = [...container.querySelectorAll<HTMLElement>('[data-pitch] [data-row]')];
    expect(slots).toHaveLength(11);
    const counts = new Map<string, number>();
    for (const el of slots) counts.set(el.dataset.row!, (counts.get(el.dataset.row!) ?? 0) + 1);
    expect([...counts.values()]).toEqual(form.split('-').map(Number).reduce<number[]>((a, n) => [...a, n], [1]));
    // no two markers share a place
    expect(new Set(slots.map((el) => `${el.style.left}|${el.style.top}`)).size).toBe(11);
  });

  it('does not rebuild the pitch when the clock’s time or an unrelated change comes in', () => {
    const { container, rerender, match, d } = setup(1);
    const before = container.querySelector('[data-pitch] [data-player="fra:10"]');
    act(() => {
      scorelineStore.getState().actions.applyFeed(demoFeed(), Date.now() + 5000);
    });
    const m2 = scorelineStore.getState().domain.matches[1]!;
    rerender(
      <>
        <IconSprite />
        <Lineup match={m2} home={d.teams[match.home]!} away={d.teams[match.away]!} width={390} side="home" onSide={() => {}} onOpenPlayer={() => {}} />
      </>,
    );
    expect(container.querySelector('[data-pitch] [data-player="fra:10"]')).toBe(before);
  });
});

describe('photos', () => {
  it('uses the photo files for a player the manifest has: AVIF ahead of WebP, both widths', () => {
    const { container } = setup(1);
    const img = container.querySelector('[data-pitch] [data-player="fra:10"] img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/img/players/fra/10-bust@1x.webp');
    expect(img.getAttribute('srcset')).toBe('/img/players/fra/10-bust@1x.webp 288w, /img/players/fra/10-bust@2x.webp 576w');
    expect(img.closest('picture')!.querySelector('source')!.getAttribute('srcset')).toContain('10-bust@2x.avif 576w');
    // the pitch's photo is ready for its entrance; the plate carries the number
    expect(img.getAttribute('loading')).toBe('eager');
    expect(container.querySelector('[data-pitch] [data-player="fra:10"]')!.textContent).toContain('10');
  });

  it('keeps the kit disc for a player without one, and the plate leaves the number to the disc', () => {
    const { container } = setup(1);
    const chip = container.querySelector('[data-pitch] [data-player="fra:7"]')!;
    expect(chip.querySelector('img')).toBeNull();
    expect(chip.querySelector('[data-kit-disc="fra"]')).toBeTruthy();
    // the disc says 7; the plate says only the name
    expect(chip.querySelector('[class*="pnum"]')).toBeNull();
  });

  it('keeps the kit disc for a team the manifest does not know', () => {
    const { container } = setup(8);
    expect(container.querySelector('[data-kit-disc="swe"]')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('lazy-loads the substitutes’ photos and shows the coach’s without a shirt number', () => {
    setPhotoManifest(parsePhotoManifest({ players: { 'fra:1': { path: 'fra/1' } }, coaches: { fra: { path: 'fra/0' } } }));
    const { container } = setup(1);
    const row = within(screen.getByRole('list', { name: 'Substitutes' })).getAllByRole('button').find((b) => b.dataset.player === 'fra:1')!;
    expect(row.querySelector('img')!.getAttribute('loading')).toBe('lazy');
    const coach = container.querySelector('section[aria-label="Coach"] [data-photo="bust"] img') as HTMLImageElement;
    expect(coach.getAttribute('src')).toBe('/img/players/fra/0-bust@1x.webp');
    expect(coach.getAttribute('loading')).toBe('lazy');
  });

  it('falls back to the coach’s initials when his photo fails, and to initials for a coach without one', () => {
    const { container } = setup(1);
    const img = container.querySelector('section[aria-label="Coach"] img') as HTMLImageElement;
    fireEvent.error(img);
    expect(container.querySelector('section[aria-label="Coach"] [class*="coachDisc"]')!.textContent).toBe('DD');
    cleanup();
    const again = setup(1, { side: 'away' });
    expect(again.container.querySelector('section[aria-label="Coach"] [class*="coachDisc"]')!.textContent).toBe('LS');
  });
});

describe('before kick-off', () => {
  it('shows the note, the squad by line and the coach, with no pitch', () => {
    const { container } = setup(11);
    expect(container.querySelector('[data-pitch]')).toBeNull();
    expect(screen.getByText('Line-ups are not out yet')).toBeTruthy();
    for (const name of ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards']) expect(screen.getByRole('region', { name })).toBeTruthy();
    expect(screen.queryByText('Unused')).toBeNull();
  });

  it('opens a squad player from his row', () => {
    const { onOpenPlayer, container } = setup(11);
    const row = container.querySelector('section button[data-player]') as HTMLElement;
    fireEvent.click(row);
    expect(onOpenPlayer).toHaveBeenCalledWith({ team: 'ita', n: Number(row.dataset.player!.split(':')[1]) }, row);
  });
});
