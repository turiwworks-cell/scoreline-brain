import { act, cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { parseEvent, parseFeed } from '../domain';
import { appMoments } from '../motion';
import { scorelineStore } from '../store';
import { App } from './App';
import { appRoutes } from './router';
import { loadMatchScreen, loadPlayerScreen } from './screens/screenChunks';

afterEach(cleanup);

beforeAll(async () => {
  // These test routing/state; the browser suite covers cold screen imports and first-open motion.
  await Promise.all([loadMatchScreen(), loadPlayerScreen()]);
  scorelineStore.getState().actions.applyFeed(
    parseFeed({
      version: 2,
      teams: [
        { id: 'ars', name: 'Arsenal', colors: ['#EF0107', '#FFFFFF'] },
        { id: 'che', name: 'Chelsea', colors: ['#034694', '#FFFFFF'] },
      ],
      leagues: [{ id: 'epl', name: 'Premier League' }],
      matches: [{ id: 501, seq: 1, day: 0, league: 'epl', home: 'ars', away: 'che', status: 'live', minute: 60, score: [1, 0] }],
    }),
    Date.now(),
  );
});

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes(), { initialEntries: [path] });
  const view = render(<App router={router} />);
  return { router, ...view };
}

const at = (router: ReturnType<typeof renderAt>['router']) => router.state.location.pathname + router.state.location.search;

test('renders the app shell', () => {
  renderAt('/');
  expect(screen.getByTestId('app-shell')).toBeTruthy();
});

test('mounts the one icon sprite at the root', () => {
  renderAt('/');
  expect(screen.getAllByTestId('icon-sprite')).toHaveLength(1);
});

describe('routes', () => {
  test('a short or unknown path goes to its canonical spelling, keeping the query', async () => {
    const { router } = renderAt('/match/501?demo');
    await vi.waitFor(() => expect(at(router)).toBe('/match/501/facts?demo'));
    await act(() => router.navigate('/nowhere?demo=fast'));
    await vi.waitFor(() => expect(at(router)).toBe('/?demo=fast'));
  });

  test('a direct match URL opens the match screen and names the document', async () => {
    renderAt('/match/501/stats');
    expect(await screen.findByRole('heading', { level: 1, name: 'Arsenal – Chelsea' })).toBeTruthy();
    expect(document.title).toBe('Arsenal – Chelsea · Scoreline');
    expect(screen.getByRole('tab', { name: 'Stats', selected: true })).toBeTruthy();
  });

  test('the list stays mounted through every navigation', async () => {
    const { router, container } = renderAt('/');
    const list = container.querySelector('[data-screen="list"]');
    expect(list).toBeTruthy();
    for (const to of ['/match/501/facts', '/match/501/lineup', '/player/ars/9', '/?day=1']) {
      await act(() => router.navigate(to));
      expect(container.querySelector('[data-screen="list"]'), to).toBe(list);
    }
    await act(() => router.navigate(-2));
    expect(container.querySelector('[data-screen="list"]')).toBe(list);
  });

  test('covered screens are inert, the top one is not', async () => {
    const { router, container } = renderAt('/match/501/facts');
    await act(() => router.navigate('/player/ars/9', { state: { under: { id: 501, tab: 'facts' } } }));
    const screenEl = (name: string) => container.querySelector(`[data-screen="${name}"][data-present="true"]`);
    expect(screenEl('list')?.hasAttribute('inert')).toBe(true);
    expect(screenEl('match')?.hasAttribute('inert')).toBe(true);
    expect(screenEl('player')?.hasAttribute('inert')).toBe(false);
  });
});

describe('moments (Part 17)', () => {
  test('the open match’s goal plays as a scene and is announced through aria-live', async () => {
    renderAt('/match/501/facts');
    await screen.findByRole('heading', { level: 1, name: 'Arsenal – Chelsea' });
    const ev = parseEvent({ match: 501, id: 'app-goal', seq: 2, kind: 'goal', side: 'home', minute: 61, name: 'Saka', score: [2, 0] });
    act(() => scorelineStore.getState().actions.applyEvent(ev!, Date.now()));
    const region = screen.getByTestId('moment-announcer');
    // role=status is a polite live region (kept apart from the shell's title announcer)
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent).toBe("Goal for Arsenal, Saka, 61'. Arsenal 2–0 Chelsea.");
    expect(appMoments().getSnapshot().stage).toMatchObject({ kind: 'scene', variant: 'goal' });
    act(() => appMoments().dismiss());
    // the shell holds the director only while it is mounted
    cleanup();
    expect(appMoments().running).toBe(false);
    expect(appMoments().getSnapshot().stage).toBeNull();
  });
});
