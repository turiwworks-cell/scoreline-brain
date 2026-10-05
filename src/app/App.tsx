import { useMemo } from 'react';
import type { DataRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { MotionProvider } from '../motion';
import { IconSprite } from '../ui/IconSprite';
import { createNavActions } from './nav/actions';
import { NavContext } from './nav/useNav';
import { appRouter } from './router';

/**
 * The app: the icon sprite (Part 7), Motion (LazyMotion + MotionConfig), the navigation actions
 * and the router. Tests pass their own (memory) router.
 */
export function App({ router = appRouter() }: { router?: DataRouter }) {
  const nav = useMemo(() => createNavActions(router), [router]);
  return (
    <>
      {/* the one icon sprite every <Icon> and tag draws from (Part 7) */}
      <IconSprite />
      <MotionProvider>
        <NavContext value={nav}>
          <RouterProvider router={router} />
        </NavContext>
      </MotionProvider>
    </>
  );
}
