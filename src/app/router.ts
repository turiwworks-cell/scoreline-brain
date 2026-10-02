import { createBrowserRouter, redirect, type DataRouter, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { Shell } from './layout/Shell';
import { canonicalPath } from './nav/url';

/*
 * Routes (React Router, data mode, SPA). Every app path renders the same Shell, so moving between
 * them never unmounts anything: the shell reads the location (nav/url.ts) and lays out the panes.
 * The child routes only name the paths the app owns; a loader sends any other spelling of them to
 * the canonical one (`/match/7` → `/match/7/facts`, anything unknown → `/`), keeping the query.
 */

// child routes render nothing themselves: the shell draws every screen
const NoOutlet = () => null;

function canonical({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const want = canonicalPath(url.pathname);
  return want === null ? null : redirect(want + url.search);
}

export function appRoutes(): RouteObject[] {
  return [
    // Part 6/7 material sheet: its own chunk, so it costs the app nothing
    { path: '/dev/kit', lazy: () => import('./devkit/DevKit').then((m) => ({ Component: m.DevKit })) },
    {
      path: '/',
      Component: Shell,
      children: [
        { index: true, Component: NoOutlet },
        { path: 'match/:id/:tab', loader: canonical, Component: NoOutlet },
        { path: 'player/:team/:n', loader: canonical, Component: NoOutlet },
        { path: '*', loader: canonical, Component: NoOutlet },
      ],
    },
  ];
}

let router: DataRouter | undefined;

/** The app's one router, made on first use. */
export function appRouter(): DataRouter {
  router ??= createBrowserRouter(appRoutes());
  return router;
}
