import { afterPaint } from './afterPaint';
import { liveIconSource, momentsSource } from './assets';
import { riveLoader } from './loader';
import { preloadWord } from './wordChunk';

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
  let disposed = false;
  let freeWord: (() => void) | undefined;
  const cancel = afterPaint(() => {
    // The stage is needed only after the gate opens, alongside the word's existing lazy chunk.
    const word = moments !== null ? [preloadWord(), import('./wordStage').then((stage) => {
      if (disposed) return;
      stage.warmWord(moments);
      freeWord = stage.freeWord;
    })] : [];
    void Promise.all([riveLoader.runtime(), ...sources.map((source) => riveLoader.file(source)), ...word]).catch(() => {
      // The mounted component retains its fallback and can retry on a later mount.
    });
  });
  return () => {
    disposed = true;
    cancel();
    freeWord?.();
  };
}
