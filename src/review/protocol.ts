/*
 * What the review page (review.html, Review.tsx) and the app it shows in its phone frame say to each
 * other (SL-18). Both sit on the same origin: the page keeps `scorelineReviewHost` on its window, and
 * the app in the frame (frameApi.ts) hands it a `ReviewFrame` — a few calls onto the demo that is
 * already running in that frame. The page runs no demo of its own, and the app outside a review page
 * never looks for any of this.
 */

/** The two moments the review page can ask for. Both happen in the featured match. */
export type ReviewScene = 'goal' | 'red';

export interface ReviewFrameState {
  /** a demo is running in the frame (it is not with `?api` or `?demo=off`) */
  readonly ready: boolean;
  readonly paused: boolean;
  /** where the app in the frame is: path, query and hash */
  readonly route: string;
}

export interface ReviewFrame {
  state(): ReviewFrameState;
  /** Brings a goal or a red card to the screen; resolves with a sentence for the viewer. Calls queue, in order. */
  scene(kind: ReviewScene): Promise<string>;
  pause(): void;
  resume(): void;
  restart(): void;
  /** Calls `listener` when `state()` may have changed. Returns the call that removes it. */
  subscribe(listener: () => void): () => void;
}

export interface ReviewHost {
  attach(frame: ReviewFrame): void;
  detach(frame: ReviewFrame): void;
}

export type ReviewWindow = Window & { scorelineReviewHost?: ReviewHost };

/** The app's own route: a path from the root, never another site, never the review page itself. */
export function appRoute(raw: string | null | undefined, origin: string): string {
  if (!raw) return '/';
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin || /^\/review(\.html)?\/?$/.test(url.pathname)) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
