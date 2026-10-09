import { activeDemoSource, subscribeActiveDemoSource } from '../data/demo';
import { followPref } from '../features/matchList/follow/pref';
import { demoFollowed } from '../app/followed';
import { createNavActions } from '../app/nav/actions';
import { parseNav } from '../app/nav/url';
import { appRouter } from '../app/router';
import { scorelineStore, selectFeaturedMatchId, selectMatch, selectMatchIdOfTeam, selectTeam } from '../store';
import type { ReviewFrame, ReviewHost, ReviewScene, ReviewWindow } from './protocol';

/*
 * The app's side of the review page (SL-18): loaded only when this app is shown in that page's frame
 * (app/followBridge.ts), and it does nothing else. It adds no simulation and no timers: pause, resume
 * and the moments are the calls the dev panel makes, on the DemoSource the app is already connected to
 * (data/demo/active.ts). A goal or a red card is a scene only when its match is open in front or is the
 * followed player's (motion/moments/director.ts); anywhere else it would be a small toast. So the page
 * puts the featured match in front first, unless that is already so.
 */

const nap = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
/** A beat for the screen to take the match in front before the moment is sent (the shell renders a navigation at once). */
const SETTLE_MS = 120;

function route(): string {
  const { pathname, search, hash } = appRouter().state.location;
  return pathname + search + hash;
}

/** The featured match, which the triggers act on, in front of the viewer unless the followed player's match is that one. */
async function bring(): Promise<void> {
  const state = scorelineStore.getState();
  const id = selectFeaturedMatchId(state);
  if (id === undefined) return;
  const followed = followPref(demoFollowed()).get();
  if (followed && selectMatchIdOfTeam(followed.team)(state) === id) return;
  const router = appRouter();
  const here = parseNav(router.state.location.pathname, router.state.location.search, router.state.location.state);
  if (here.match?.id === id && !here.player) return;
  createNavActions(router).openMatch(id);
  await nap(SETTLE_MS);
}

function describe(kind: ReviewScene): string {
  const state = scorelineStore.getState();
  const id = selectFeaturedMatchId(state);
  const match = id === undefined ? undefined : selectMatch(id)(state);
  const name = (team: string) => selectTeam(team)(state)?.name ?? team;
  const where = match ? `${name(match.home)} – ${name(match.away)}` : 'the featured match';
  const what = kind === 'goal' ? `Goal for ${match ? name(match.home) : 'the home side'}` : `Red card for ${match ? name(match.home) : 'the home side'}`;
  return `${what} in ${where}.`;
}

let queue: Promise<unknown> = Promise.resolve();

export const frameApi: ReviewFrame = {
  state() {
    const source = activeDemoSource();
    return { ready: !!source, paused: !!source?.paused, route: route() };
  },
  scene(kind) {
    const run = async (): Promise<string> => {
      const source = activeDemoSource();
      if (!source) return 'No demo is running in this view, so there is nothing to trigger.';
      const trigger = kind === 'goal' ? 'goalHome' : 'redHome';
      await bring();
      let restarted = false;
      let done = source.trigger(trigger);
      if (!done) {
        // the featured match has finished: the evening starts again, as it does by itself after a rest
        source.restart();
        restarted = true;
        await nap(SETTLE_MS);
        await bring();
        done = source.trigger(trigger);
      }
      if (!done) return 'Nothing to act on right now.';
      const notes = [
        restarted ? 'The evening had finished, so it was started again.' : '',
        source.paused ? 'The evening is paused: it is added, and the match carries on after Resume.' : '',
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Reduced motion is on, so it appears as a notice rather than a full scene.' : '',
      ];
      return [describe(kind), ...notes].filter(Boolean).join(' ');
    };
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  },
  pause: () => activeDemoSource()?.pause(),
  resume: () => activeDemoSource()?.resume(),
  restart: () => activeDemoSource()?.restart(),
  subscribe(listener) {
    let offSource = () => {};
    const wire = () => {
      offSource();
      offSource = activeDemoSource()?.subscribe(listener) ?? (() => {});
      listener();
    };
    const offActive = subscribeActiveDemoSource(wire);
    const offRoute = appRouter().subscribe(listener);
    offSource = activeDemoSource()?.subscribe(listener) ?? (() => {});
    return () => {
      offActive();
      offSource();
      offRoute();
    };
  },
};

let host: ReviewHost | undefined;

/** Offers the frame to the review page that holds it. Does nothing in any other page, or in a second call. */
export function connectReviewFrame(): void {
  if (host || window.parent === window) return;
  try {
    host = (window.parent as ReviewWindow).scorelineReviewHost;
  } catch {
    return; // another origin's page: it gets nothing
  }
  if (!host) return;
  const page = host;
  document.documentElement.dataset.reviewFrame = '';
  page.attach(frameApi);
  addEventListener(
    'pagehide',
    () => {
      try {
        page.detach(frameApi);
      } catch {
        /* the page is gone too */
      }
      host = undefined;
    },
    { once: true },
  );
}
