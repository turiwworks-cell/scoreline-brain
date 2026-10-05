// The app's MomentDirector over the app store, and the hooks that read it. It runs while anything
// holds it (the list, the followed player's card, the shell), so tests that mount none of them
// never start its timers.

import { useEffect, useSyncExternalStore } from 'react';
import { scorelineStore } from '../../store';
import { createMomentDirector, type DirectorSnapshot, type GoalCue, type HeroCue, type MomentDirector, type MomentView, type Presentation } from './director';

let app: MomentDirector | undefined;
let holders = 0;

/** The app's director (created on first use, started by `holdMoments`). */
export function appMoments(): MomentDirector {
  app ??= createMomentDirector(scorelineStore);
  return app;
}

/** Keeps the app's director running until the returned release is called. */
export function holdMoments(): () => void {
  const d = appMoments();
  holders += 1;
  d.start();
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holders -= 1;
    if (holders === 0) d.stop();
  };
}

const useSnapshot = <T>(pick: (s: DirectorSnapshot) => T, d: MomentDirector): T =>
  useSyncExternalStore(
    d.subscribe,
    () => pick(d.getSnapshot()),
    () => pick(d.getSnapshot()),
  );

/** Holds the director for as long as the calling component is mounted, and tells it what is on screen. */
export function useMomentView(view: MomentView, d: MomentDirector = appMoments()): void {
  useEffect(() => (d === app ? holdMoments() : (d.start(), () => d.stop())), [d]);
  useEffect(() => d.setView(view), [d, view]);
}

/** What is on the stage: the scene, the toast or the summary (Part 18 renders it). */
export function useMomentStage(d: MomentDirector = appMoments()): Presentation | null {
  return useSnapshot((s) => s.stage, d);
}

/** One match's latest goal: goal-mark and card-flood. Re-renders only when that match scores. */
export function useGoalCue(matchId: number, d: MomentDirector = appMoments()): GoalCue | undefined {
  return useSnapshot((s) => s.goals.get(matchId), d);
}

/** The match whose goal landed last (goal-focus): the other cards go grey while it is fresh. */
export function useGoalFocus(d: MomentDirector = appMoments()): number | undefined {
  return useSnapshot((s) => s.focus, d);
}

/** The open match's latest goal or red card, for the hero (heroBumpT, luau:7375). */
export function useHeroCue(matchId: number | undefined, d: MomentDirector = appMoments()): HeroCue | null {
  return useSnapshot((s) => (s.hero && s.hero.matchId === matchId ? s.hero : null), d);
}

/** The latest aria-live announcement. */
export function useMomentAnnouncement(d: MomentDirector = appMoments()) {
  return useSnapshot((s) => s.announcement, d);
}
