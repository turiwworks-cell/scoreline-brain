import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEvent, parseFeed } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { createMomentDirector, sceneBeats, toastCloseAfter, TOAST_OUT, type MomentView } from '../../motion';
import { scorelineStore } from '../../store';
import { IconSprite, parsePhotoManifest, setPhotoManifest } from '../../ui';
import { MomentStage, type StageSlot } from './MomentStage';

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

beforeEach(() => {
  scorelineStore.getState().actions.resetFeed(parseFeed(demoFeedJson()), Date.now());
  setPhotoManifest(parsePhotoManifest({ players: { 'fra:20': { path: 'fra/20' } }, coaches: {} }));
});
const running: { stop(): void }[] = [];
afterEach(() => {
  cleanup();
  running.splice(0).forEach((d) => d.stop());
  setPhotoManifest(null);
});

/** The app store, a director over it with a hand-driven clock and timers, and the stage rendered. */
function setup(view: MomentView, slot: StageSlot = 'all', reduced = false, onRender: ProfilerOnRenderCallback = () => {}) {
  let t = 50;
  type Timer = { at: number; fn: () => void };
  let timers: Timer[] = [];
  const d = createMomentDirector(scorelineStore, {
    clock: { now: () => t },
    timers: {
      set(fn, ms) {
        const h = { at: t + ms / 1000, fn };
        timers.push(h);
        return h;
      },
      clear(h) {
        timers = timers.filter((x) => x !== h);
      },
    },
    visibility: { hidden: () => false, subscribe: () => () => {} },
    reducedMotion: () => reduced,
  });
  d.setView(view);
  d.start();
  running.push(d);
  const onOpenMatch = vi.fn();
  const isFollowed = vi.fn((team: string, n: number) => team === 'fra' && n === 20);
  const tree = (s: StageSlot) => (
    <>
      <IconSprite />
      <Profiler id="stage" onRender={onRender}>
        <MomentStage slot={s} director={d} onOpenMatch={onOpenMatch} isFollowed={isFollowed} reducedMotion={reduced} />
      </Profiler>
    </>
  );
  const rendered = render(tree(slot));
  let seq = 500;
  const api = {
    d,
    /** mounts the stage as another slot (a layout change moves it) */
    reslot: (s: StageSlot) => rendered.rerender(tree(s)),
    onOpenMatch,
    stage: () => d.getSnapshot().stage,
    advance(s: number) {
      act(() => {
        const end = t + s;
        for (;;) {
          timers.sort((a, b) => a.at - b.at);
          const next = timers[0];
          if (!next || next.at > end) break;
          timers.shift();
          t = next.at;
          next.fn();
        }
        t = end;
      });
    },
    goal(match: number, raw: Record<string, unknown> = {}) {
      const m = scorelineStore.getState().domain.matches[match]!;
      const side = (raw.side as string) ?? 'home';
      const score = side === 'home' ? [m.score[0] + 1, m.score[1]] : [m.score[0], m.score[1] + 1];
      const e = parseEvent({ seq: ++seq, match, id: `e${seq}`, kind: 'goal', side, minute: 61, player: 20, other: 10, score, ...raw });
      act(() => scorelineStore.getState().actions.applyEvent(e!, Date.now()));
    },
  };
  return api;
}

describe('MomentStage', () => {
  it('shows nothing while the stage is empty', () => {
    setup({ front: false });
    expect(screen.queryByTestId('moment-scene')).toBeNull();
    expect(screen.queryByTestId('moment-toast')).toBeNull();
  });

  it('does not render an empty stage when one match changes on a poll', () => {
    const commits = vi.fn();
    setup({ front: false }, 'all', false, commits);
    commits.mockClear();
    const raw = demoFeedJson();
    raw.matches[1]!.minute += 1;
    act(() => scorelineStore.getState().actions.applyFeed(parseFeed(raw), Date.now()));
    expect(commits).not.toHaveBeenCalled();
  });
});

describe('the scene', () => {
  it('is the open match’s goal, with the scorer, the assist and the commentary', async () => {
    const a = setup({ openId: 1, front: true });
    a.goal(1);
    const scene = await screen.findByTestId('moment-scene');
    expect(scene.dataset.variant).toBe('goal');
    expect(scene.getAttribute('aria-label')).toBe("Goal: Doué, France, 61'");
    // the word stand-in: six letters, each a soft copy and a sharp one
    expect(scene.textContent).toContain('GGOOAAAAAALL');
    expect(scene.textContent).toContain('Désiré');
    expect(scene.textContent).toContain('Assist Mbappé');
    expect(scene.textContent).toContain('Your player');
    expect(scene.textContent).toContain('Doué scores for France, set up by Mbappé.');
    // the bust comes from the photo manifest
    expect(scene.querySelector('img')?.getAttribute('src')).toBe('/img/players/fra/20-bust@1x.webp');
  });

  it('a first tap shows everything, the next closes it (tapScene, luau:7322)', async () => {
    const errors = vi.spyOn(console, 'error');
    const a = setup({ openId: 1, front: true });
    a.goal(1);
    await screen.findByTestId('moment-scene');
    const started = a.stage()!.startedAt;
    fireEvent.click(screen.getByTestId('moment-scene'));
    expect(a.stage()!.startedAt).toBeCloseTo(started - sceneBeats('goal').full);
    expect(a.stage()!.phase).toBe('in');
    fireEvent.click(screen.getByTestId('moment-scene'));
    expect(a.stage()!.phase).toBe('out');
    expect(screen.getByTestId('moment-scene').dataset.phase).toBe('out');
    expect(errors.mock.calls.filter(([message]) => String(message).includes('Cannot update a component'))).toHaveLength(0);
    errors.mockRestore();
  });

  it('the close button and Escape send it away without a tap', async () => {
    const a = setup({ openId: 1, front: true });
    a.goal(1);
    await screen.findByTestId('moment-scene');
    const started = a.stage()!.startedAt;
    fireEvent.click(screen.getByRole('button', { name: 'Close goal' }));
    expect(a.stage()!.phase).toBe('out');
    expect(a.stage()!.startedAt).toBe(started);

    a.advance(1);
    expect(screen.queryByTestId('moment-scene')).toBeNull();
    a.goal(1);
    await screen.findByTestId('moment-scene');
    // an Escape something else already handled (a sheet, a menu) leaves the scene alone
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    handled.preventDefault();
    window.dispatchEvent(handled);
    expect(a.stage()!.phase).toBe('in');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(a.stage()!.phase).toBe('out');
  });

  it('a red card plays the red scene', async () => {
    const a = setup({ openId: 1, front: true });
    const e = parseEvent({ seq: 900, match: 1, id: 'r1', kind: 'red', side: 'home', minute: 70, player: 4 });
    act(() => scorelineStore.getState().actions.applyEvent(e!, Date.now()));
    const scene = await screen.findByTestId('moment-scene');
    expect(scene.dataset.variant).toBe('red');
    expect(scene.textContent).toContain('RED CARD');
    expect(scene.textContent).toContain('Down to ten');
    expect(scene.textContent).toContain('Sent off');
    expect(a.stage()!.kind).toBe('scene');
  });

  it('is not shown where only toasts play (the desktop’s third pane)', () => {
    const a = setup({ openId: 1, front: true }, 'toast');
    a.goal(1);
    expect(a.stage()!.kind).toBe('scene');
    expect(screen.queryByTestId('moment-scene')).toBeNull();
  });
});

describe('the toast', () => {
  it('another match’s goal: the scorer, the minute and the score; a tap opens the match', () => {
    const a = setup({ openId: 1, front: true });
    a.goal(2, { player: 0, other: undefined });
    const toast = screen.getByTestId('moment-toast');
    expect(toast.dataset.kind).toBe('toast');
    const button = screen.getByRole('button', { name: /^Goal, 61'/ });
    expect(button.getAttribute('aria-label')).toMatch(/Open match$/);
    fireEvent.click(button);
    expect(a.onOpenMatch).toHaveBeenCalledWith(2);
    expect(a.stage()!.phase).toBe('out');
  });

  it('is not shown where only scenes play (the desktop’s match pane)', () => {
    const a = setup({ front: false }, 'scene');
    a.goal(2);
    expect(a.stage()!.kind).toBe('toast');
    expect(screen.queryByTestId('moment-toast')).toBeNull();
  });

  it('a finger on it holds it; a swipe up past 26 px sends it away', () => {
    const a = setup({ front: false });
    a.goal(2);
    const hit = screen.getByRole('button', { name: /Open match/ });
    fireEvent.pointerDown(hit, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    expect(a.stage()!.held).toBe(true);
    // held past its time, it stays
    a.advance(toastCloseAfter() + 1);
    expect(a.stage()!.phase).toBe('in');
    fireEvent.pointerMove(hit, { pointerId: 1, clientX: 100, clientY: 60 });
    fireEvent.pointerUp(hit, { pointerId: 1, clientX: 100, clientY: 60 });
    fireEvent.click(hit);
    expect(a.stage()!.phase).toBe('out');
    expect(a.onOpenMatch).not.toHaveBeenCalled();
  });

  it('a short drag springs back and keeps it', () => {
    const a = setup({ front: false });
    a.goal(2);
    const hit = screen.getByRole('button', { name: /Open match/ });
    fireEvent.pointerDown(hit, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(hit, { pointerId: 1, clientX: 100, clientY: 130, timeStamp: 1000 });
    fireEvent.pointerUp(hit, { pointerId: 1, clientX: 100, clientY: 130 });
    fireEvent.click(hit);
    expect(a.stage()!.phase).toBe('in');
    expect(a.stage()!.held).toBe(false);
    expect(a.onOpenMatch).not.toHaveBeenCalled();
  });

  it('a toast that goes while pressed lets go of the director', () => {
    const a = setup({ front: false });
    a.goal(2);
    fireEvent.pointerDown(screen.getByRole('button', { name: /Open match/ }), { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    expect(a.stage()!.held).toBe(true);
    a.reslot('scene');
    expect(screen.queryByTestId('moment-toast')).toBeNull();
    expect(a.stage()!.held).toBe(false);
    a.advance(toastCloseAfter() + TOAST_OUT + 0.01);
    expect(a.stage()).toBeNull();
  });

  it('a moment with nobody named says the team once', () => {
    setup({ front: false });
    const e = parseEvent({ seq: 950, match: 2, id: 'r9', kind: 'red', side: 'home', minute: 70 });
    act(() => scorelineStore.getState().actions.applyEvent(e!, Date.now()));
    expect(screen.getByRole('button', { name: /Open match/ }).getAttribute('aria-label')).toBe("Red card, 70', England. England 0–1 Brazil. Open match");
  });

  it('Escape sends it away', () => {
    const a = setup({ front: false });
    a.goal(2);
    fireEvent.keyDown(screen.getByRole('button', { name: /Open match/ }), { key: 'Escape' });
    expect(a.stage()!.phase).toBe('out');
  });

  it('several at once fold into a summary that plays after the first', () => {
    const a = setup({ front: false });
    act(() => {
      let seq = 700;
      for (const match of [2, 3, 4, 5]) {
        const m = scorelineStore.getState().domain.matches[match]!;
        const e = parseEvent({ seq: ++seq, match, id: `s${seq}`, kind: 'goal', side: 'home', minute: 50, score: [m.score[0] + 1, m.score[1]] });
        scorelineStore.getState().actions.applyEvent(e!, Date.now());
      }
    });
    expect(a.stage()!.kind).toBe('toast');
    a.advance(toastCloseAfter() + TOAST_OUT + 0.01);
    const toast = screen.getByTestId('moment-toast');
    expect(toast.dataset.kind).toBe('summary');
    const button = screen.getByRole('button', { name: /^Meanwhile: 3 goals/ });
    fireEvent.click(button);
    expect(a.onOpenMatch).not.toHaveBeenCalled();
    expect(a.stage()!.phase).toBe('out');
  });

  it('with reduced motion a would-be scene is a static toast, already landed', () => {
    const a = setup({ openId: 1, front: true }, 'all', true);
    a.goal(1);
    expect(a.stage()!.kind).toBe('toast');
    const toast = screen.getByTestId('moment-toast');
    expect(toast.textContent).toContain('Doué');
    // no slide: it sits in its place, and the player and his name are already in
    expect(toast.style.transform === '' || toast.style.transform === 'none').toBe(true);
    const photo = toast.querySelector<HTMLElement>('[data-photo="bust"]')!.parentElement!;
    expect(photo.style.opacity).toBe('1');
  });
});
