import { afterPaint } from './afterPaint';
import { liveIconSource, momentsSource } from './assets';
import { riveLoader } from './loader';

/** A live match warms the word before a goal. This never creates a renderer or a Rive instance. */
export function preloadRive(hasLiveMatch: boolean): () => void {
  if (liveIconSource === null && momentsSource === null) return () => {};
  const sources = [liveIconSource, hasLiveMatch ? momentsSource : null].filter((s): s is string => s !== null);
  if (sources.length === 0) return () => {};
  return afterPaint(() => {
    void Promise.all([riveLoader.runtime(), ...sources.map((source) => riveLoader.file(source))]).catch(() => {
      // The mounted component retains its fallback and can retry on a later mount.
    });
  });
}
