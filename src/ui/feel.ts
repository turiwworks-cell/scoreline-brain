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

// a control only reacts to presses that land on it, not on a control nested inside it
function owns(el: HTMLElement, target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.m-feel') === el;
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

// a click rolls the label (hovering never does), unless the control is already the chosen one.
// A roll in progress is not restarted.
// On a control, only the labels that belong to it roll, never those of controls nested inside.
export function roll(el: Element) {
  // the chosen tab or side already says what it is: pressing it again does not replay its letters
  if (el.matches('[aria-selected="true"], [aria-checked="true"]')) return;
  const scope = el.matches('.m-feel') ? el : null;
  const labels = el.matches('[data-roll]') ? [el] : Array.from(el.querySelectorAll('[data-roll]'));
  for (const label of labels) {
    if (scope && label.closest('.m-feel') !== scope) continue;
    if (label.hasAttribute('data-rolling')) continue;
    label.setAttribute('data-rolling', '');
  }
}

/*
 * The press dip. data-pressed drives --dip to 1 over --dur-press. A quick tap still
 * shows the whole dip (luau:3373): release waits for the dip to reach the bottom.
 *
 * That wait ends on the dip's transitionend. If the transition never ends (the element
 * was hidden or detached, or its transitions are off), a timer ends it instead, so a
 * control can never stay pressed. The timer only starts once the press is released: a
 * press that is still held stays down.
 */
type Press = { down: boolean; settled: boolean; timer: ReturnType<typeof setTimeout> | undefined };
const pressed = new WeakMap<HTMLElement, Press>();

// slack on top of --dur-press before the fallback gives up waiting for transitionend
const SETTLE_SLACK_MS = 100;

// a duration token in ms; 0 when the token isn't defined
function tokenMs(el: Element, name: string): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return 0;
  return raw.endsWith('ms') ? n : raw.endsWith('s') ? n * 1000 : n;
}

function finish(el: HTMLElement) {
  const st = pressed.get(el);
  if (st?.timer !== undefined) clearTimeout(st.timer);
  pressed.delete(el);
  el.removeAttribute('data-pressed');
}

function press(el: HTMLElement) {
  const prev = pressed.get(el);
  if (prev?.timer !== undefined) clearTimeout(prev.timer);
  pressed.set(el, { down: true, settled: false, timer: undefined });
  el.setAttribute('data-pressed', '');
  roll(el);
}

function release(el: HTMLElement) {
  const st = pressed.get(el);
  if (!st) return;
  st.down = false;
  if (st.settled) {
    finish(el);
  } else if (st.timer === undefined) {
    st.timer = setTimeout(() => finish(el), tokenMs(el, '--dur-press') + SETTLE_SLACK_MS);
  }
}

function onDipEnd(e: Event) {
  if ((e as TransitionEvent).propertyName !== '--dip') return;
  const el = e.currentTarget as HTMLElement;
  const st = pressed.get(el);
  if (!st || e.target !== el) return;
  st.settled = true;
  if (!st.down) finish(el);
}

function watch(el: HTMLElement) {
  if (el.dataset.feel) return;
  el.dataset.feel = '';
  el.addEventListener('transitionend', onDipEnd);
  el.addEventListener('transitioncancel', onDipEnd);
}

/*
 * Spread onto any element that has the .m-feel class. Use withFeel() when the caller may
 * pass handlers of its own, so neither side drops the other:
 *   <button className="m-feel m-glass" {...withFeel(rest)}>
 * `feel` is one shared object, so it never changes identity between renders.
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
    const el = e.currentTarget;
    if (e.button !== 0 || !owns(el, e.target)) return;
    watch(el);
    sizeLight(el);
    // a touch has no hover: the light starts where the finger lands (luau:3368)
    placeLight(el, e.clientX, e.clientY);
    press(el);
    const up = () => {
      release(el);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
  },
  onKeyDown(e: KeyboardEvent<HTMLElement>) {
    const el = e.currentTarget;
    if (e.repeat || (e.key !== 'Enter' && e.key !== ' ') || !owns(el, e.target)) return;
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

type Handler = ((e: never) => void) | undefined;

/* props with the feel handlers added; a handler the caller passed still runs first. */
export function withFeel<P extends object>(props: P): P {
  const out = { ...props } as Record<string, unknown>;
  for (const key of Object.keys(feel) as (keyof typeof feel)[]) {
    const mine = feel[key] as (e: never) => void;
    const theirs = (props as Record<string, Handler>)[key];
    out[key] = theirs
      ? (e: never) => {
          theirs(e);
          mine(e);
        }
      : mine;
  }
  return out as P;
}

// rolls end on their own: the last letter's animation clears data-rolling
export function onRollEnd(e: AnimationEvent | { target: EventTarget | null; currentTarget: EventTarget | null }) {
  const label = e.currentTarget as HTMLElement | null;
  const t = e.target as HTMLElement | null;
  if (!label || !t || t.parentElement !== label || t !== label.lastElementChild) return;
  label.removeAttribute('data-rolling');
}
