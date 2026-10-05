import { lazy, Suspense, useLayoutEffect, useRef, type ComponentProps } from 'react';
import type { MatchScreen } from './MatchScreen';
import type { PlayerScreen } from './PlayerScreen';
import { Missing } from './Missing';
import { loadMatchScreen, loadPlayerScreen } from './screenChunks';
import { canFocus } from '../nav/focusMemory';

const Match = lazy(loadMatchScreen);
const Player = lazy(loadPlayerScreen);

/** A stacked cold open focuses this heading. Keep that focus when Suspense replaces it. */
function LoadingScreen({ back, what }: { back: boolean; what: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      if (!el?.contains(document.activeElement)) return;
      const screen = el.closest('[data-screen]');
      // Layout cleanup precedes removal; the new heading exists after this commit finishes.
      queueMicrotask(() => {
        if (document.activeElement !== document.body) return;
        const heading = screen?.querySelector<HTMLElement>('[data-screen-heading]');
        if (canFocus(heading)) heading.focus({ preventScroll: true });
      });
    };
  }, []);
  return <Missing ref={ref} back={back} loaded={false} what={what} />;
}

export function LazyMatchScreen(props: ComponentProps<typeof MatchScreen>) {
  return <Suspense fallback={<LoadingScreen back={props.chrome === 'back'} what="This match" />}><Match {...props} /></Suspense>;
}

export function LazyPlayerScreen(props: ComponentProps<typeof PlayerScreen>) {
  return <Suspense fallback={<LoadingScreen back={props.chrome !== 'none'} what="This player" />}><Player {...props} /></Suspense>;
}
