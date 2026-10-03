import { demoMode } from '../data';

// the player followed until prefs exist: the demo follows Argentina's 10 (DemoSource, luau:8915)
export const DEMO_FOLLOWED = { team: 'arg', n: 10 };

/** The player followed before anyone has been chosen: the demo's, or nobody. */
export const demoFollowed = () => (demoMode(window.location.search) ? DEMO_FOLLOWED : null);
