import { act, cleanup, render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { parseFeed } from '../domain';
import { scorelineStore } from '../store';
import { App } from './App';
import { appRoutes } from './router';

/*
 * Opening the Rive gate (rive/startGate.ts) happens just after the first data has painted. It must
 * not render the shell again: the whole list, header and tabs were drawn once a moment before.
 */

const spy = vi.hoisted(() => ({ lists: 0, preload: vi.fn(() => () => {}) }));
vi.mock('../rive/preload', () => ({ preloadRive: spy.preload }));
vi.mock('./layout/ListPane', async (importOriginal) => {
  const real = await importOriginal<typeof import('./layout/ListPane')>();
  return {
    ...real,
    ListPane: (props: Parameters<typeof real.ListPane>[0]) => {
      spy.lists++;
      return real.ListPane(props);
    },
  };
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  spy.lists = 0;
  spy.preload.mockClear();
  scorelineStore.setState(scorelineStore.getInitialState(), true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const feed = () =>
  parseFeed({
    version: 2,
    teams: [
      { id: 'ars', name: 'Arsenal', colors: ['#EF0107', '#FFFFFF'] },
      { id: 'che', name: 'Chelsea', colors: ['#034694', '#FFFFFF'] },
    ],
    leagues: [{ id: 'epl', name: 'Premier League' }],
    matches: [{ id: 501, seq: 1, day: 0, league: 'epl', home: 'ars', away: 'che', status: 'live', minute: 60, score: [1, 0] }],
  });

test('the gate opening does not render the list pane again', () => {
  render(<App router={createMemoryRouter(appRoutes(), { initialEntries: ['/'] })} />);
  expect(spy.preload).not.toHaveBeenCalled();

  act(() => scorelineStore.getState().actions.applyFeed(feed(), Date.now()));
  // the render the data caused, and anything the app does in the few frames after it
  act(() => void vi.advanceTimersByTime(8));
  const drawn = spy.lists;
  expect(drawn).toBeGreaterThan(0);
  expect(spy.preload).not.toHaveBeenCalled();

  act(() => void vi.advanceTimersByTime(200));
  expect(spy.preload).toHaveBeenCalledTimes(1);
  expect(spy.lists).toBe(drawn);
});
