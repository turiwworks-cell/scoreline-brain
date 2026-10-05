import { createContext, useContext } from 'react';
import type { NavActions } from './actions';

export const NavContext = createContext<NavActions | null>(null);

/** The navigation actions (open a match, a player, back…). Features navigate only through these. */
export function useNav(): NavActions {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav() needs the app router (NavContext) above it');
  return nav;
}
