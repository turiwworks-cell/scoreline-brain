import type { ComponentType, ComponentProps } from 'react';
import type { MatchScreen } from './MatchScreen';
import type { PlayerScreen } from './PlayerScreen';

type ScreenModule<P> = { default: ComponentType<P> };

/** The ready-thenable pattern used by insightsChunk/wordChunk: a warm first open must not suspend. */
function screenChunk<P>(importScreen: () => Promise<ScreenModule<P>>) {
  let ready: ScreenModule<P> | undefined;
  let pending: Promise<ScreenModule<P>> | undefined;
  const preload = (): Promise<ScreenModule<P>> => {
    if (!pending) pending = importScreen().then((m) => {
      ready = m;
      return m;
    }, (error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
  return {
    preload,
    load(): Promise<ScreenModule<P>> {
      const m = ready;
      return m ? { then: (done: (v: ScreenModule<P>) => unknown) => done(m) } as unknown as Promise<ScreenModule<P>> : preload();
    },
  };
}

const match = screenChunk<ComponentProps<typeof MatchScreen>>(() => import('./MatchScreen').then((m) => ({ default: m.MatchScreen })));
const player = screenChunk<ComponentProps<typeof PlayerScreen>>(() => import('./PlayerScreen').then((m) => ({ default: m.PlayerScreen })));

export const loadMatchScreen = match.load;
export const loadPlayerScreen = player.load;

/** Background fetches swallow network failures; a later render retries and owns the error. */
export function preloadMatchScreen(): void { void match.preload().catch(() => {}); }
export function preloadPlayerScreen(): void { void player.preload().catch(() => {}); }
export function preloadScreens(): void { preloadMatchScreen(); preloadPlayerScreen(); }

/** Pointer/focus preparation belongs in the app layer, keeping features independent of routing. */
export function prepareScreen(target: EventTarget | null): void {
  const key = target instanceof Element ? target.closest<HTMLElement>('[data-focus-key]')?.dataset.focusKey : undefined;
  if (key && /^(match|live|insight-goal)-/.test(key)) preloadMatchScreen();
  else if (key && /^(chip|follow|leader)-/.test(key)) preloadPlayerScreen();
}
