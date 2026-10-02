import type { KeyboardEvent, PointerEvent } from 'react';

/*
 * The feel of a control: the hover light and the press dip (luau:3349-3379).
 *
 * Everything here writes straight to the element: CSS custom properties for the
 * light's position (--mx, --my, --spot-r) and a data-pressed attribute for the dip.
 * Nothing goes through React state, so moving the pointer never re-renders.
 * The animation itself is CSS (materials.css: .m-feel, .m-glass, .m-dip).
 */

// how far the hover light reaches on a control of this size (spotR, luau:3253)
export function spotRadius(w: number, h: number): number {
  return Math.min(Math.max(Math.max(w, h) * 0.42, 26), 78);
}

// the light follows the cursor, and stays where it left when it fades (luau:3357)
function placeLight(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  // the element may be mid-dip (scaled); measure in its unscaled space
  const sx = el.offsetWidth ? r.width / el.offsetWidth : 1;
  const sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
  el.style.setProperty('--mx', `${(clientX - r.left) / sx}px`);
  el.style.setProperty('--my', `${(clientY - r.top) / sy}px`);
}

function sizeLight(el: HTMLElement) {
  el.style.setProperty('--spot-r', `${spotRadius(el.offsetWidth, el.offsetHeight)}px`);
}

// a click rolls the label (hovering never does). A roll in progress is not restarted.
export function roll(el: Element) {
  const labels = el.matches('[data-roll]') ? [el] : Array.from(el.querySelectorAll('[data-roll]'));
  for (const label of labels) {
    if (label.hasAttribute('data-rolling')) continue;
    label.setAttribute('data-rolling', '');
  }
}

/*
 * The press dip. data-pressed drives --dip to 1 over --dur-press. A quick tap still
 * shows the whole dip (luau:3373): release waits for the dip to reach the bottom.
 */
const pressed = new WeakMap<HTMLElement, { down: boolean; settled: boolean }>();

function press(el: HTMLElement) {
  const st = { down: true, settled: false };
  pressed.set(el, st);
  el.setAttribute('data-pressed', '');
  roll(el);
}

function release(el: HTMLElement) {
  const st = pressed.get(el);
  if (!st) return;
  st.down = false;
  if (st.settled) {
    pressed.delete(el);
    el.removeAttribute('data-pressed');
  }
}

function onDipEnd(e: TransitionEvent) {
  if (e.propertyName !== '--dip') return;
  const el = e.currentTarget as HTMLElement;
  const st = pressed.get(el);
  if (!st || e.target !== el) return;
  st.settled = true;
  if (!st.down) release(el);
}

function watch(el: HTMLElement) {
  if (el.dataset.feel) return;
  el.dataset.feel = '';
  el.addEventListener('transitionend', onDipEnd);
  el.addEventListener('transitioncancel', onDipEnd as EventListener);
}

/*
 * Spread onto any element that has the .m-feel class:
 *   <button className="m-feel m-glass" {...feel}>
 * One shared object, so it never changes identity between renders.
 */
export const feel = {
  onPointerEnter(e: PointerEvent<HTMLElement>) {
    const el = e.currentTarget;
    watch(el);
    sizeLight(el);
    placeLight(el, e.clientX, e.clientY);
  },
  onPointerMove(e: PointerEvent<HTMLElement>) {
    placeLight(e.currentTarget, e.clientX, e.clientY);
  },
  onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    watch(el);
    sizeLight(el);
    // a touch has no hover: the light starts where the finger lands (luau:3368)
    placeLight(el, e.clientX, e.clientY);
    press(el);
    const up = () => {
      release(el);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  },
  onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
    const el = e.currentTarget;
    watch(el);
    press(el);
    if (e.key === 'Enter') release(el);
  },
  onKeyUp(e: KeyboardEvent<HTMLElement>) {
    if (e.key === ' ') release(e.currentTarget);
  },
  onBlur(e: { currentTarget: HTMLElement }) {
    release(e.currentTarget);
  },
};

// rolls end on their own: the last letter's animation clears data-rolling
export function onRollEnd(e: AnimationEvent | { target: EventTarget | null; currentTarget: EventTarget | null }) {
  const label = e.currentTarget as HTMLElement | null;
  const t = e.target as HTMLElement | null;
  if (!label || !t || t.parentElement !== label || t !== label.lastElementChild) return;
  label.removeAttribute('data-rolling');
}
