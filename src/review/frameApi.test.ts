import { createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoSource } from '../data/demo';
import { clearActiveDemoSource, setActiveDemoSource } from '../data/demo/active';
import { liveMinute, parseFeed } from '../domain';
import { createDemoSource } from '../data/demo/demoSource';
import { connectSource } from '../data/sync';
import { FakeScheduler } from '../data/testing/fakes';
import { demoFeedJson } from '../domain/testing/demo';
import { scorelineStore } from '../store';
import type { ReviewFrame, ReviewHost } from './protocol';

// the app's router is a browser's; here a memory one with the same paths (no screens drawn)
const h = vi.hoisted(() => ({ router: undefined as unknown as ReturnType<typeof createMemoryRouter> }));
vi.mock('../app/router', () => ({ appRouter: () => h.router }));

const { appRoutes } = await vi.importActual<typeof import('../app/router')>('../app/router');
const { frameApi } = await import('./frameApi');
const frame: ReviewFrame = frameApi;

function source(over: Partial<Record<keyof DemoSource, unknown>> = {}) {
  const s = {
    paused: false,
    trigger: vi.fn(() => true),
    restart: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    ...over,
  };
  return s as unknown as DemoSource & typeof s;
}
const route = () => h.router.state.location.pathname + h.router.state.location.search;
const follow = (v: string) => localStorage.setItem('scoreline:follow', v);

beforeEach(() => {
  h.router = createMemoryRouter(
    appRoutes().map((r) => ({ ...r, Component: undefined, lazy: undefined })),
    { initialEntries: ['/?live=0'] },
  );
  scorelineStore.setState(scorelineStore.getInitialState(), true);
  scorelineStore.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now());
  window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
  follow('none');
});
afterEach(() => localStorage.clear());

describe('the app’s side of the review page', () => {
  let active: DemoSource | null = null;
  const use = (s: ReturnType<typeof source>) => {
    active = s;
    setActiveDemoSource(s);
    return s;
  };
  afterEach(() => {
    if (active) clearActiveDemoSource(active);
    active = null;
  });

  it('says what is going on: no demo, then a demo that is paused or not, and where the app is', () => {
    expect(frame.state()).toEqual({ ready: false, paused: false, route: '/?live=0' });
    use(source({ paused: true }));
    expect(frame.state()).toEqual({ ready: true, paused: true, route: '/?live=0' });
  });

  it('has nothing to trigger without a demo', async () => {
    expect(await frame.scene('goal')).toMatch(/No demo is running/);
  });

  it('fires the featured match’s goal or red card, after putting that match in front', async () => {
    const s = use(source());
    expect(await frame.scene('goal')).toBe('Goal for France in France – Argentina.');
    expect(s.trigger).toHaveBeenLastCalledWith('goalHome');
    expect(route()).toBe('/match/1/facts?live=0');
    expect(await frame.scene('red')).toBe('Red card for France in France – Argentina.');
    expect(s.trigger).toHaveBeenLastCalledWith('redHome');
  });

  it('does not move a viewer who is already on that match, nor one who follows a player in it', async () => {
    use(source());
    h.router = createMemoryRouter(appRoutes().map((r) => ({ ...r, Component: undefined, lazy: undefined })), { initialEntries: ['/match/1/lineup'] });
    await frame.scene('goal');
    expect(route()).toBe('/match/1/lineup');
    expect(h.router.state.historyAction).toBe('POP');

    h.router = createMemoryRouter(appRoutes().map((r) => ({ ...r, Component: undefined, lazy: undefined })), { initialEntries: ['/?live=0'] });
    follow(JSON.stringify({ team: 'arg', n: 10 }));
    await frame.scene('goal');
    expect(route()).toBe('/?live=0');
  });

  it('opens the match from a player’s page, which would cover it', async () => {
    use(source());
    h.router = createMemoryRouter(appRoutes().map((r) => ({ ...r, Component: undefined, lazy: undefined })), { initialEntries: ['/player/fra/10', '/player/fra/10?x=1'], initialIndex: 1 });
    await frame.scene('goal');
    expect(route()).toMatch(/^\/match\/1\//);
  });

  it('starts the evening again when it had finished, and says so', async () => {
    const trigger = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const s = use(source({ trigger }));
    const said = await frame.scene('goal');
    expect(s.restart).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledTimes(2);
    expect(said).toMatch(/Goal for France.* The evening had finished, so it was started again\./);
  });

  it('gives up with a sentence when even a fresh evening has nothing to act on', async () => {
    use(source({ trigger: vi.fn(() => false) }));
    expect(await frame.scene('red')).toBe('Nothing to act on right now.');
  });

  it('tells a paused evening and reduced motion, since they change what is seen', async () => {
    use(source({ paused: true }));
    window.matchMedia = vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const said = await frame.scene('goal');
    expect(said).toMatch(/paused/);
    expect(said).toMatch(/Reduced motion is on/);
  });

  it('answers in the order asked, one at a time', async () => {
    const order: string[] = [];
    use(source({ trigger: vi.fn((name: string) => (order.push(name), true)) }));
    const all = await Promise.all([frame.scene('goal'), frame.scene('red'), frame.scene('goal')]);
    expect(order).toEqual(['goalHome', 'redHome', 'goalHome']);
    expect(all.map((t) => t.split(' ')[0])).toEqual(['Goal', 'Red', 'Goal']);
  });

  it('pauses, resumes and restarts the demo that is running, and nothing when none is', () => {
    frame.pause();
    const s = use(source());
    frame.pause();
    frame.resume();
    frame.restart();
    expect([s.pause, s.resume, s.restart].map((f) => vi.mocked(f).mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('holds all displayed live clocks through paused triggers and restart, then releases them on resume', async () => {
    const scheduler = new FakeScheduler();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => scheduler.now());
    const demo = createDemoSource({ scheduler, autoGoals: false });
    const connection = connectSource(demo, scorelineStore.getState().actions, () => scheduler.now());
    const times = () => Object.values(scorelineStore.getState().domain.matches)
      .filter(match => match.status === 'live').map(match => liveMinute(match, scheduler.now()));
    try {
      scheduler.advance(2000);
      frame.pause();
      const held = times();
      scheduler.advance(120000);
      expect(times()).toEqual(held);
      await frame.scene('goal');
      const afterGoal = times();
      scheduler.advance(120000);
      expect(times()).toEqual(afterGoal);
      frame.restart();
      const restarted = times();
      scheduler.advance(120000);
      expect(times()).toEqual(restarted);
      frame.resume();
      scheduler.advance(2000);
      expect(times()).not.toEqual(restarted);
      expect(Object.values(scorelineStore.getState().domain.matches).some(match => match.clock.paused)).toBe(false);
    } finally {
      connection.disconnect();
      clock.mockRestore();
    }
  });

  it('tells its listener about the demo, the demo’s changes and the route, and stops when asked', async () => {
    const listener = vi.fn();
    const off = frame.subscribe(listener);
    const s = source();
    use(s);
    expect(listener).toHaveBeenCalled();
    expect(s.subscribe).toHaveBeenCalledWith(listener);
    listener.mockClear();
    await h.router.navigate('/?day=1');
    expect(listener).toHaveBeenCalled();
    off();
    listener.mockClear();
    await h.router.navigate('/?day=2');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('offering the frame to the page that holds it', () => {
  const real = Object.getOwnPropertyDescriptor(window, 'parent');
  const parentIs = (value: unknown) => Object.defineProperty(window, 'parent', { configurable: true, get: () => value });
  afterEach(() => {
    if (real) Object.defineProperty(window, 'parent', real);
    delete document.documentElement.dataset.reviewFrame;
    vi.resetModules();
  });
  const fresh = async () => (await import('./frameApi')).connectReviewFrame;

  it('does nothing in a page of its own', async () => {
    const connect = await fresh();
    connect();
    expect(document.documentElement.dataset.reviewFrame).toBeUndefined();
  });
  it('does nothing in a frame of any other page, and nothing if that page is of another origin', async () => {
    const connect = await fresh();
    parentIs({});
    connect();
    expect(document.documentElement.dataset.reviewFrame).toBeUndefined();
    parentIs(new Proxy({}, { get() { throw new DOMException('blocked', 'SecurityError'); } }));
    expect(() => connect()).not.toThrow();
    expect(document.documentElement.dataset.reviewFrame).toBeUndefined();
  });
  it('attaches once to the review page, and detaches when the frame goes', async () => {
    const connect = await fresh();
    const host: ReviewHost = { attach: vi.fn(), detach: vi.fn() };
    parentIs({ scorelineReviewHost: host });
    connect();
    connect();
    expect(host.attach).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.reviewFrame).toBe('');
    window.dispatchEvent(new Event('pagehide'));
    expect(host.detach).toHaveBeenCalledTimes(1);
    expect(host.detach).toHaveBeenCalledWith(vi.mocked(host.attach).mock.calls[0]?.[0]);
  });
});
