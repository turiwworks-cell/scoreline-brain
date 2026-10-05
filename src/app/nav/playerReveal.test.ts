import { createMemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { createNavActions } from './actions';
import { playerRevealVersion, revealCurrentPlayer, subscribePlayerReveal } from './playerReveal';

describe('revealing the current desktop player', () => {
  it('notifies only subscribed panes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlayerReveal(listener);
    const before = playerRevealVersion();
    revealCurrentPlayer();
    expect(playerRevealVersion()).toBe(before + 1);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    revealCurrentPlayer();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('reveals a hidden current player without changing their route or history key', () => {
    const router = createMemoryRouter([{ path: '/player/:team/:n' }], { initialEntries: ['/player/fra/10?demo'] });
    const nav = createNavActions(router);
    const key = router.state.location.key;
    const before = playerRevealVersion();
    nav.openPlayer({ team: 'fra', n: 10 });
    expect(router.state.location.key).toBe(key);
    expect(router.state.location.pathname).toBe('/player/fra/10');
    expect(playerRevealVersion()).toBe(before + 1);
    router.dispose();
  });
});
