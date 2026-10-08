import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { appRoutes } from '../router';
import { createNavActions } from './actions';
import { triggerFor } from './focusMemory';
import { scrollMemory } from './scrollMemory';

function setup(path = '/?demo') {
  // routes without the shell: these tests only read the router's state
  const routes = appRoutes().map((r) => ({ ...r, Component: undefined, lazy: undefined }));
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, nav: createNavActions(router), loc: () => router.state.location };
}
const href = (l: { pathname: string; search: string }) => l.pathname + l.search;
const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  window.history.replaceState(null, '');
  document.body.replaceChildren();
});

describe('nav actions', () => {
  it('saves the departing scroll before a pending scroll event can use the new location key', async () => {
    const { nav, loc } = setup();
    const screen = document.createElement('section');
    screen.dataset.screen = 'list';
    screen.dataset.present = 'true';
    const card = document.createElement('button');
    screen.append(card);
    document.body.append(screen);
    screen.scrollTop = 572;
    const key = loc().key;
    nav.openMatch(2, { from: card });
    await tick();
    expect(scrollMemory.get(key, 'list')).toBe(572);
  });
  it('opening a screen pushes, and opening it again does nothing', async () => {
    const { router, nav, loc } = setup();
    nav.openMatch(2);
    await tick();
    expect(href(loc())).toBe('/match/2/facts?demo');
    expect(router.state.historyAction).toBe('PUSH');
    const key = loc().key;
    nav.openMatch(2);
    await tick();
    expect(loc().key).toBe(key);
  });

  it('taps that land before the first push finishes add no entries', async () => {
    const { router, nav, loc } = setup();
    nav.openMatch(2);
    nav.openMatch(2);
    nav.openMatch(2);
    await tick();
    expect(href(loc())).toBe('/match/2/facts?demo');
    await router.navigate(-1);
    expect(href(loc())).toBe('/?demo');
  });

  it('tabs, day and Live replace and keep the other params', async () => {
    const { router, nav, loc } = setup('/match/2/facts?demo&day=1');
    nav.setTab(2, 'lineup');
    await tick();
    expect(href(loc())).toBe('/match/2/lineup?demo&day=1');
    expect(router.state.historyAction).toBe('REPLACE');
    nav.setDay(-1);
    await tick();
    expect(href(loc())).toBe('/match/2/lineup?demo&day=-1');
    nav.setLive(true);
    await tick();
    expect(href(loc())).toBe('/match/2/lineup?demo');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('a player keeps the match it came from in history state, and its tab there', async () => {
    const { nav, loc } = setup('/match/1/lineup');
    nav.openPlayer({ team: 'fra', n: 10 }, { under: { id: 1, tab: 'lineup' } });
    await tick();
    expect(href(loc())).toBe('/player/fra/10');
    expect(loc().state).toEqual({ under: { id: 1, tab: 'lineup' } });
    // the match pane beside the player switches tab without leaving the player
    nav.setTab(1, 'stats');
    await tick();
    expect(href(loc())).toBe('/player/fra/10');
    expect(loc().state).toEqual({ under: { id: 1, tab: 'stats' } });
    // a day change keeps that state
    nav.setDay(1);
    await tick();
    expect(loc().state).toEqual({ under: { id: 1, tab: 'stats' } });
  });

  it('back opened cold goes up a level; with history it goes back', async () => {
    const cold = setup('/player/fra/10?demo');
    cold.router.navigate('/player/fra/10?demo', { replace: true, state: { under: { id: 1, tab: 'lineup' } } });
    await tick();
    cold.nav.back();
    await tick();
    expect(href(cold.loc())).toBe('/match/1/lineup?demo');
    cold.nav.back();
    await tick();
    expect(href(cold.loc())).toBe('/?demo');

    const warm = setup();
    warm.nav.openMatch(3);
    await tick();
    window.history.replaceState({ idx: 1 }, '');
    warm.nav.back();
    await tick();
    expect(href(warm.loc())).toBe('/?demo');
    expect(warm.router.state.historyAction).toBe('POP');
  });

  it('remembers what was pressed, per location, for focus return', async () => {
    const { nav, loc } = setup();
    const card = document.createElement('button');
    card.dataset.focusKey = 'match-2';
    document.body.append(card);
    const from = loc().key;
    nav.openMatch(2, { from: card });
    await tick();
    expect(triggerFor(from)).toBe(card);
    // the card re-rendered: its focus key finds the new one
    card.remove();
    const again = document.createElement('button');
    again.dataset.focusKey = 'match-2';
    document.body.append(again);
    expect(triggerFor(from)).toBe(again);
  });
});
