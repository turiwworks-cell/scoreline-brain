// Text widths, for the few places the Lua decides by measuring (which team name a narrow card
// has room for, how far the minute shrinks): the same face the page uses, measured on a canvas.

import { useSyncExternalStore } from 'react';

let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Width in px of `text` set at `size` in weight `weight` with `track` em of letter-spacing. */
export function textWidth(weight: number, size: number, track: number, text: string): number {
  const c = context();
  if (!c) return text.length * size * (0.56 + track);
  c.font = `${weight} ${size}px "Hanken Grotesk", system-ui, sans-serif`;
  (c as unknown as { letterSpacing: string }).letterSpacing = `${track * size}px`;
  return c.measureText(text).width;
}

// the face may load after the first measure: anything that measured re-renders once it has
let version = 0;
const listeners = new Set<() => void>();
let watching = false;

function watch() {
  if (watching || typeof document === 'undefined' || !document.fonts) return;
  watching = true;
  const bump = () => {
    version++;
    for (const l of [...listeners]) l();
  };
  document.fonts.addEventListener?.('loadingdone', bump);
  void document.fonts.ready.then(bump);
}

function subscribe(l: () => void) {
  watch();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Changes when the page's face has finished loading, so a measure taken before it can be redone. */
export function useFontVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}
