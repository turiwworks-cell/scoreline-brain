/*
 * Where the app is served from (vite.config.ts `base`, SCORELINE_BASE): `/` at a site's root, or a
 * folder such as `/scoreline/app/`. The router keeps the folder in its own location, so a pathname
 * read from the router's state goes through appPathname() before the app's routes read it.
 */

export const BASE_URL: string = import.meta.env.BASE_URL;

/** The router's basename: the base without its trailing slash; none at the site's root. */
export const BASENAME: string | undefined = BASE_URL.replace(/\/+$/, '') || undefined;

/** A pathname from the router's state (which keeps the basename) as the app's routes read it. */
export function appPathname(pathname: string, basename: string | undefined = BASENAME): string {
  if (!basename) return pathname;
  if (pathname === basename) return '/';
  return pathname.startsWith(`${basename}/`) ? pathname.slice(basename.length) : pathname;
}
