/** Reveal an already-routed player's desktop tab without adding a history entry. */
let version = 0;
const listeners = new Set<() => void>();
export const playerRevealVersion = () => version;
export function subscribePlayerReveal(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function revealCurrentPlayer(): void {
  version += 1;
  for (const listener of listeners) listener();
}
