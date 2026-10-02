import { animate } from 'motion/react';
import { crossfade, fitInto, intersect, lerpBox, overlapRatio, type Box, type Size } from './geometry';
import type { SharedEnd } from './sharedIds';
import { timing, type TimingKey } from './tokens';

/*
 * Shared-element flights: card → hero and face → bust (ARCHITECTURE §5).
 *
 * Why not Motion's `layoutId`: it shows only the newest-mounted end and hides the other. Here both
 * ends stay mounted and, on tablet and desktop, both stay visible (the open match's card is still
 * in the list beside its hero), and a list re-render that remounts a card would take the shared
 * element away from the hero. So navigation decides when a flight happens (planFlights in app/layout/resolve.ts),
 * and this module runs it:
 *
 * 1. The destination is already mounted at its final place (a layout effect, before paint).
 * 2. Both ends are copied (cloneNode) into one fixed overlay above the panes, and both are hidden.
 * 3. Motion animates progress 0 → 1 with the section's timing. Each frame the copies sit on a box
 *    between the source box (taken once) and the destination's resting box, read again every frame
 *    without its ancestors' translation, so a layer still sliding in, a sheet rising or a cascade
 *    block lifting doesn't bend the path. Uniform scale and transform/opacity only.
 * 4. At the end the copies go and both ends show again.
 *
 * A new flight for an element already in flight starts from where the copy is now, so a reversed
 * or repeated navigation picks the motion up instead of jumping. Ends that are off screen or
 * scrolled out of their pane don't fly; they simply show in place.
 */

export interface FlightRequest {
  /** every shared element named `${group}:…` flies */
  readonly group: string;
  readonly from: SharedEnd;
  readonly to: SharedEnd;
  readonly timing: TimingKey;
  /** duration × this (the player view closes in 0.7 of its time, luau:5928) */
  readonly durationScale?: number;
  /** take the `from` end inside this element when there is one (the button that was pressed) */
  readonly fromWithin?: Element | null;
  /** take the `to` end inside this element when there is one (what opened the screen) */
  readonly toWithin?: Element | null;
}

interface Piece {
  box: Box;
  stop(): void;
}

const active = new Map<string, Piece>();
let overlayEl: HTMLDivElement | null = null;

/** The attribute that hides an end while its copy flies (global.css). */
const FLYING = 'data-shared-flying';

/** Starts the flights a navigation calls for. Returns how many elements fly. */
export function fly(req: FlightRequest): number {
  if (typeof document === 'undefined' || prefersReducedMotion()) return 0;
  const toAll = ends(req.group, req.to);
  let started = 0;
  for (const id of new Set(toAll.map((el) => el.dataset.shared ?? ''))) {
    const toEl = pick(toAll.filter((el) => el.dataset.shared === id), req.toWithin);
    const fromEl = pick(ends(req.group, req.from).filter((el) => el.dataset.shared === id), req.fromWithin);
    if (!toEl || !fromEl || toEl === fromEl) continue;
    const prev = active.get(id);
    const fromBox = prev ? prev.box : boxOf(fromEl);
    prev?.stop();
    if (!prev && !onScreen(fromEl, fromBox)) continue;
    if (!onScreen(toEl, restingBox(toEl))) continue;
    start(id, fromEl, toEl, fromBox, req);
    started += 1;
  }
  return started;
}

/** Ends every flight now: copies removed, both ends shown. */
export function landAll(): void {
  for (const p of [...active.values()]) p.stop();
}

/** How many elements are in flight (for tests and the dev panel). */
export function flightCount(): number {
  return active.size;
}

/** The element's box as if neither it nor any ancestor were translated: where it rests once its layer has arrived. */
export function restingBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  if (typeof DOMMatrixReadOnly === 'function') {
    for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
      const t = getComputedStyle(a).transform;
      if (t && t !== 'none') {
        const m = new DOMMatrixReadOnly(t);
        dx += m.m41;
        dy += m.m42;
      }
    }
  }
  return { x: r.left - dx, y: r.top - dy, w: r.width, h: r.height };
}

function start(id: string, fromEl: HTMLElement, toEl: HTMLElement, fromBox: Box, req: FlightRequest) {
  const layer = overlay();
  const fromSize = sizeOf(fromEl);
  const toSize = sizeOf(toEl);
  const a = copyOf(fromEl, fromSize);
  const b = copyOf(toEl, toSize);
  layer.append(a, b);
  fromEl.setAttribute(FLYING, '');
  toEl.setAttribute(FLYING, '');

  let target = restingBox(toEl);
  const piece: Piece = { box: fromBox, stop: () => {} };
  const place = (p: number) => {
    if (toEl.isConnected) target = restingBox(toEl);
    const box = lerpBox(fromBox, target, p);
    put(a, fromSize, box);
    put(b, toSize, box);
    const f = crossfade(p);
    a.style.opacity = String(f.from);
    b.style.opacity = String(f.to);
    piece.box = box;
  };
  place(0);

  let done = false;
  const anim: { controls?: { stop(): void } } = {};
  piece.stop = () => {
    if (done) return;
    done = true;
    anim.controls?.stop();
    a.remove();
    b.remove();
    fromEl.removeAttribute(FLYING);
    toEl.removeAttribute(FLYING);
    if (active.get(id) === piece) active.delete(id);
    if (active.size === 0) overlayEl?.replaceChildren();
  };
  active.set(id, piece);

  const t = timing(req.timing);
  anim.controls = animate(0, 1, {
    duration: t.duration * (req.durationScale ?? 1),
    ease: t.ease,
    onUpdate: place,
    onComplete: () => piece.stop(),
  });
  if (done) anim.controls.stop();
}

function ends(group: string, end: SharedEnd): HTMLElement[] {
  const prefix = `${group}:`;
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-shared-end="${end}"]`)).filter((el) => el.dataset.shared?.startsWith(prefix));
}

/** Inside `within` first, then ends on a screen that is staying (not exiting), then any. */
function pick(cands: HTMLElement[], within: Element | null | undefined): HTMLElement | undefined {
  const rank = (el: HTMLElement) => (within && within.contains(el) ? 0 : el.closest('[data-present="false"]') ? 2 : 1);
  return [...cands].sort((x, y) => rank(x) - rank(y))[0];
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** At least a quarter of it shows: inside the viewport and inside its scrolling pane. */
function onScreen(el: Element, box: Box): boolean {
  let clip: Box = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const scroller = el.closest('[data-scroller]');
  if (scroller) clip = intersect(clip, restingBox(scroller));
  return overlapRatio(box, clip) >= 0.25;
}

function sizeOf(el: HTMLElement): Size {
  if (el.offsetWidth || el.offsetHeight) return { w: el.offsetWidth, h: el.offsetHeight };
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

function put(el: HTMLElement, size: Size, box: Box) {
  const f = fitInto(size, box);
  el.style.transform = `translate(${f.x}px, ${f.y}px) scale(${f.s})`;
}

// text styles a copy would otherwise lose by leaving its parent
const INHERITED = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variant-numeric',
  'font-feature-settings',
  'font-variation-settings',
  'letter-spacing',
  'line-height',
  'text-transform',
  'text-align',
  'white-space',
];

function copyOf(el: HTMLElement, size: Size): HTMLElement {
  const c = el.cloneNode(true) as HTMLElement;
  for (const attr of ['data-shared', 'data-shared-end', FLYING]) c.removeAttribute(attr);
  const cs = getComputedStyle(el);
  for (const p of INHERITED) c.style.setProperty(p, cs.getPropertyValue(p));
  c.style.position = 'absolute';
  c.style.left = '0';
  c.style.top = '0';
  c.style.margin = '0';
  c.style.width = `${size.w}px`;
  c.style.height = `${size.h}px`;
  c.style.transformOrigin = '0 0';
  c.style.pointerEvents = 'none';
  c.style.visibility = 'visible';
  c.style.willChange = 'transform, opacity';
  c.setAttribute('aria-hidden', 'true');
  c.setAttribute('data-shared-copy', el.dataset.shared ?? '');
  for (const img of c.querySelectorAll('img')) {
    img.loading = 'eager';
    img.decoding = 'sync';
  }
  reId(c);
  return c;
}

let copies = 0;

/**
 * Gives the copy's ids new names and points its own `url(#…)` and `href="#…"` at them. Otherwise
 * a crest's clip path in the copy resolves to the original's, which is hidden while it flies, and
 * a hidden clip path clips everything away.
 */
function reId(c: Element) {
  const named = c.querySelectorAll('[id]');
  if (!named.length) return;
  copies += 1;
  const map = new Map<string, string>();
  for (const el of named) {
    const id = `${el.id}-copy${copies}`;
    map.set(el.id, id);
    el.id = id;
  }
  const swap = (v: string) => v.replace(/url\(#([^)]+)\)|^#(.+)$/g, (all, a: string | undefined, b: string | undefined) => {
    const to = map.get(a ?? b ?? '');
    return to ? (a ? `url(#${to})` : `#${to}`) : all;
  });
  for (const el of [c, ...c.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      if (attr.name === 'id' || !attr.value.includes('#')) continue;
      const v = swap(attr.value);
      if (v !== attr.value) el.setAttribute(attr.name, v);
    }
  }
}

function overlay(): HTMLDivElement {
  if (overlayEl?.isConnected) return overlayEl;
  const el = document.createElement('div');
  el.setAttribute('data-shared-overlay', '');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'fixed', inset: '0', zIndex: '1000', pointerEvents: 'none', overflow: 'hidden', contain: 'strict' });
  document.body.append(el);
  overlayEl = el;
  return el;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// a hidden tab doesn't run frames: land everything rather than leave both ends hidden
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') landAll();
  });
}
