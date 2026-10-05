import { sourceExpected } from '../data';

// the player followed until prefs exist: the demo follows Argentina's 10 (DemoSource, luau:8915),
// and so does the mock API, which runs the same evening
export const DEMO_FOLLOWED = { team: 'arg', n: 10 };

/** The player followed before anyone has been chosen: the demo's, or nobody. */
export const demoFollowed = () => (sourceExpected(window.location.search) ? DEMO_FOLLOWED : null);
