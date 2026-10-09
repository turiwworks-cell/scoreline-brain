import { createBrowserRouter, type DataRouter, type RouteObject } from 'react-router';
import { Shell } from './layout/Shell';

/*
 * Routes (React Router, data mode, SPA). Every app path renders the same Shell, so moving between
 * them never unmounts anything: the shell reads the location (nav/url.ts) and lays out the panes.
 * The child routes only name the paths the app owns. No loaders, so every navigation lands at
 * once; the shell itself replaces any other spelling with the canonical one (`/match/7` →
 * `/match/7/facts`, anything unknown → `/`), keeping the query, before the first paint.
 */

// child routes render nothing themselves: the shell draws every screen
const NoOutlet = () => null;

export function appRoutes(): RouteObject[] {
  return [
    // Part 6/7 material sheet: its own chunk, so it costs the app nothing
    { path: '/dev/kit', lazy: () => import('./devkit/DevKit').then((m) => ({ Component: m.DevKit })) },
    {
      path: '/',
      Component: Shell,
      children: [
        { index: true, Component: NoOutlet },
        { path: 'match/:id/:tab?', Component: NoOutlet },
        { path: 'player/:team/:n', Component: NoOutlet },
        { path: '*', Component: NoOutlet },
      ],
    },
  ];
}

let router: DataRouter | undefined;

/** Where the app is served from, without the trailing slash; none at the site's root (vite.config.ts `base`). */
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || undefined;

/** The app's one router, made on first use. */
export function appRouter(): DataRouter {
  router ??= createBrowserRouter(appRoutes(), { basename });
  return router;
}
