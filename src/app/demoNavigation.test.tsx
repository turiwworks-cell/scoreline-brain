import { act, cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { parseFeed } from '../domain';
import { demoFeedJson } from '../domain/testing/demo';
import { scorelineStore } from '../store';
import { App } from './App';
import { appRoutes } from './router';
import { loadMatchScreen, loadPlayerScreen } from './screens/screenChunks';

beforeAll(async () => { await Promise.all([loadMatchScreen(), loadPlayerScreen()]); });
beforeEach(() => { scorelineStore.setState(scorelineStore.getInitialState(), true); });
afterEach(cleanup);

function evening(offset = 0) {
  const feed = demoFeedJson();
  return parseFeed({ ...feed, matches: feed.matches.map(m => ({ ...m, id: m.id + offset })) });
}

test('a profile survives feed replacement; Back and Forward repair expired entries', async () => {
  scorelineStore.getState().actions.applyFeed(evening(), Date.now());
  const router = createMemoryRouter(appRoutes(), { initialEntries: ['/match/1/lineup?demo=fast&seed=x'] });
  render(<App router={router} />);
  await act(() => router.navigate('/player/fra/10?demo=fast&seed=x', { state: { under: { id: 1, tab: 'lineup' } } }));
  act(() => scorelineStore.getState().actions.resetFeed(evening(200), Date.now()));
  await vi.waitFor(() => expect(router.state.location.state?.under).toBeUndefined());
  expect(router.state.location.pathname).toBe('/player/fra/10');
  await act(() => router.navigate(-1));
  await vi.waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/?demo=fast&seed=x'));
  expect(screen.queryByText('Match not found')).toBeNull();
  await act(() => router.navigate(1));
  expect(router.state.location.pathname).toBe('/player/fra/10');
  expect(router.state.location.state?.under).toBeUndefined();
});

test('a cold demo link waits for data, then defines its fallback; ordinary missing links remain intact', async () => {
  const router = createMemoryRouter(appRoutes(), { initialEntries: ['/match/1/stats?demo'] });
  render(<App router={router} />);
  expect(router.state.location.pathname).toBe('/match/1/stats');
  act(() => scorelineStore.getState().actions.applyFeed(evening(200), Date.now()));
  await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'));
  await act(() => router.navigate('/match/201/stats?demo'));
  expect(router.state.location.pathname).toBe('/match/201/stats');
  await act(() => router.navigate('/match/1/stats?api'));
  expect(router.state.location.pathname).toBe('/match/1/stats');
  await act(() => router.navigate('/match/1/stats?demo=off'));
  expect(router.state.location.pathname).toBe('/match/1/stats');
  await act(() => router.navigate('/match/1/stats'));
  await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'));
});
