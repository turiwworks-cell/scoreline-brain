import { afterPaint } from './afterPaint';
import { liveIconSource, momentsSource } from './assets';
import { riveLoader } from './loader';
import { preloadWord } from './wordChunk';
import { freeWord, warmWord } from './wordStage';

/**
 * A live match warms the word before a goal: the runtime, the file and the word's own chunk, then
 * the word's one instance (wordStage.ts, made at idle and parked off-screen), which every scene
 * borrows. When no match is live any more the instance is freed. The icon's instance is still its
 * own component's.
 */
export function preloadRive(hasLiveMatch: boolean): () => void {
  if (liveIconSource === null && momentsSource === null) return () => {};
  const sources = [liveIconSource, hasLiveMatch ? momentsSource : null].filter((s): s is string => s !== null);
  if (sources.length === 0) return () => {};
  const moments = hasLiveMatch ? momentsSource : null;
  const cancel = afterPaint(() => {
    const word = moments !== null ? [preloadWord()] : [];
    void Promise.all([riveLoader.runtime(), ...sources.map((source) => riveLoader.file(source)), ...word]).catch(() => {
      // The mounted component retains its fallback and can retry on a later mount.
    });
    if (moments !== null) warmWord(moments);
  });
  return () => {
    cancel();
    if (moments !== null) freeWord();
  };
}
