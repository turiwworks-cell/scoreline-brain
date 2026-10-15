import { HERO_W } from '../../features/player/heroWidth';
import { warmPlayerPhoto } from '../../ui/photoManifest';

/*
 * A player's bust from the gesture that opens him, not from the page that opens after it: a press,
 * Enter or Space, or a mouse resting 100 ms on anything that opens a player (passing over a line-up
 * on the way elsewhere starts nothing). Not focus: the app moves focus itself as screens change. The bust is the page's largest picture, and the
 * press is its head start. It is the same request the page then shows (photos.ts, warmPhoto).
 *
 * This module rides in the player screen's chunk (PlayerScreen.tsx imports it), which the shell
 * fetches once the first frame is painted (screenChunks.ts, preloadScreens), so the first download
 * carries none of it; until then the shell's own warm on navigation (Shell.tsx) is the start.
 */

/** What opens a player: `chip-<team>-<n>` (line-up), `follow-<team>-<n>` (follow card), `leader-<match>-<team>-<n>` (insights). */
const PLAYER_KEY = /^(?:chip|follow)-(.+)-(\d+)$|^leader-\d+-(.+)-(\d+)$/;
const REST_MS = 100;

const opener = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('[data-focus-key]') : null);

function warm(el: HTMLElement | null): void {
  const m = el && PLAYER_KEY.exec(el.dataset.focusKey ?? '');
  const team = m?.[1] ?? m?.[3];
  const n = m?.[2] ?? m?.[4];
  if (team && n) warmPlayerPhoto(team, Number(n), `${HERO_W}px`);
}

let resting: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => warm(opener(e.target)), { capture: true, passive: true });
  document.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && warm(opener(e.target)), { capture: true, passive: true });
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = opener(e.target);
      if (el === resting) return;
      clearTimeout(timer);
      resting = el;
      if (el) timer = setTimeout(() => warm(el), REST_MS);
    },
    { capture: true, passive: true },
  );
}
