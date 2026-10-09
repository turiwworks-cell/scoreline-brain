import { useSyncExternalStore } from 'react';
import type { ReviewFrame, ReviewFrameState, ReviewHost, ReviewWindow } from './protocol';

/*
 * The review page's side of the link to the app in its frame (frameApi.ts): who is attached now, and
 * that app's state as the page's controls need it. The frame attaches itself once its demo is up; the
 * page lets go of it when the frame leaves (a reload, or a new route that loads the page again).
 */

let current: ReviewFrame | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const reviewHost: ReviewHost = {
  attach(frame) {
    current = frame;
    emit();
  },
  detach(frame) {
    if (current !== frame) return;
    current = null;
    emit();
  },
};

/** Makes this window the one a frame looks for. Returns the call that takes it back. */
export function offerHost(win: ReviewWindow = window): () => void {
  win.scorelineReviewHost = reviewHost;
  return () => {
    if (win.scorelineReviewHost === reviewHost) delete win.scorelineReviewHost;
    current = null;
  };
}

export function attachedFrame(): ReviewFrame | null {
  return current;
}

const NONE = '';
/** The frame's state, or none while it is not attached. A string, so the same state is the same snapshot. */
function snapshot(): string {
  return current ? JSON.stringify(current.state()) : NONE;
}

function subscribe(listener: () => void): () => void {
  let off = () => {};
  const rewire = () => {
    off();
    off = current?.subscribe(listener) ?? (() => {});
    listener();
  };
  listeners.add(rewire);
  off = current?.subscribe(listener) ?? (() => {});
  return () => {
    listeners.delete(rewire);
    off();
  };
}

/** `null` until the app in the frame has attached; then its state, kept up to date. */
export function useFrameState(): ReviewFrameState | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => NONE);
  return raw === NONE ? null : (JSON.parse(raw) as ReviewFrameState);
}
