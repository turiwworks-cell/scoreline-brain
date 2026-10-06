import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cancelFrame, frame } from 'motion/react';
import { RiveCanvas } from './RiveCanvas';
import type { GoalWordProps } from './GoalWord';
import type { RiveInstance } from './types';
import { argb } from './color';

export default function WordGraphic(props: GoalWordProps & { source: string }) {
  // Reference advances include textPath's trailing tracking and the caller's second subtraction.
  const designSize = props.kind === 'red' ? Math.min(70, 346000 / 4493) : Math.min(104, 326000 / 3788);
  const scale = (props.size ?? designSize) / designSize;
  // The artboard's box where the headline starts. The canvas reaches up over the whole rise and
  // never moves; Rive draws the word where it is (place). Whole CSS pixels, so the surface lies on
  // the screen's pixels one for one.
  const w = 390 * scale;
  const h = 340 * scale;
  const reach = Math.max(0, -(props.rise?.top ?? 0));
  const box = { w, h, reach, width: Math.ceil(w), height: Math.ceil(h + reach) };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(props);
  const geometry = useRef(box);
  const step = useRef<(() => void) | undefined>(undefined);
  const place = useRef<(() => void) | undefined>(undefined);
  const bound = useRef(false);
  const landed = useRef(false);
  const fail = () => { latest.current.onFallback(); setFailed(true); };
  const failRef = useRef(fail);
  useLayoutEffect(() => { latest.current = props; geometry.current = box; failRef.current = fail; step.current?.(); });
  // Not bound by the deadline: the DOM word starts the headline and keeps it. A first tap before
  // the word has landed shows the DOM word, landed.
  useEffect(() => {
    if (failed) return;
    const check = () => {
      const q = latest.current;
      if ((!bound.current && q.late(q.elapsed.get())) || (q.skipped && !landed.current)) failRef.current();
      else step.current?.();
    };
    check();
    const offs = [props.time.on('change', check), props.elapsed.on('change', check)];
    return () => { for (const off of offs) off(); };
  }, [props.time, props.elapsed, props.skipped, failed]);
  // The rise: once a frame, where the scene's styles are written, so the word moves with the stage.
  const { y: riseY, scale: riseScale } = props.rise ?? {};
  useEffect(() => {
    if (!riseY || !riseScale || failed) return;
    const run = () => place.current?.();
    const schedule = () => { frame.render(run); };
    const offs = [riseY.on('change', schedule), riseScale.on('change', schedule)];
    return () => { for (const off of offs) off(); cancelFrame(run); };
  }, [riseY, riseScale, failed]);
  const bind = (instance: RiveInstance, requestSync: () => void) => {
    const vm = instance.viewModelInstance;
    const kind = vm?.string('kind');
    const c1 = vm?.color('color1');
    const c2 = vm?.color('color2');
    const play = vm?.trigger('play');
    const phase = vm?.number('phase');
    if (!kind || !c1 || !c2 || !play || !phase) throw new Error('Moments requires String kind, Color color1/color2, Trigger play and Number phase');
    const q = latest.current;
    if (q.skipped || q.late(q.elapsed.get())) throw new Error('The headline started before the Rive word was ready');
    kind.value = q.kind;
    c1.value = argb(q.colors[0]);
    c2.value = argb(q.colors[1]);
    phase.value = 0;
    let started = false;
    let done = false;
    const changed = () => {
      const n = phase.value;
      if (n !== 1 && n !== 2) return;
      landed.current = true;
      latest.current.onPhase(n);
      if (n === 2) { done = true; instance.pause(); instance.stopRendering(); }
    };
    phase.on(changed);
    bound.current = true;
    q.onBound();
    const advance = () => {
      const current = latest.current;
      // Existing scenes keep their director timers while hidden. Never start/advance in the background.
      if (document.hidden) return;
      if (!done && phase.value < 1 && current.elapsed.get() >= current.full) { done = true; fail(); return; }
      if (!done && !started && current.time.get() >= current.start) {
        started = true;
        play.trigger();
      }
    };
    /*
     * The artboard's bounds on the drawing surface: the start box, raised and scaled about its
     * centre as the host's CSS did. Each frame Rive draws the word anew, sharp at any sub-pixel
     * offset; once the word has stopped, setting a layout draws it at once. A resize resets the layout
     * to the whole surface, so it is set again.
     */
    let surface: { width: number; height: number } | undefined;
    let last = '';
    const placeWord = () => {
      const rise = latest.current.rise;
      if (!rise || !surface || document.hidden) return;
      const { w, h, reach, width, height } = geometry.current;
      const s = rise.scale.get();
      const kx = surface.width / width;
      const ky = surface.height / height;
      const cx = width / 2;
      const cy = reach + h / 2 + rise.y.get();
      const bounds = { minX: (cx - (w * s) / 2) * kx, minY: (cy - (h * s) / 2) * ky, maxX: (cx + (w * s) / 2) * kx, maxY: (cy + (h * s) / 2) * ky };
      const key = `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`;
      if (key === last) return;
      last = key;
      instance.layout = instance.layout.copyWith(bounds);
    };
    place.current = placeWord;
    // The canvas owner decides whether this request may advance or resume rendering.
    step.current = requestSync;
    return {
      shouldPlay: () => started && !done,
      resume: advance,
      resized(width: number, height: number) { surface = { width, height }; last = ''; placeWord(); },
      cleanup() { phase.off(changed); step.current = undefined; place.current = undefined; latest.current.onFallback(); },
    };
  };
  return (
    <span aria-hidden="true" style={{ display: 'inline-grid', position: 'relative', height: '100%', alignItems: 'center' }}>
      <span style={{ gridArea: '1 / 1', visibility: ready && !failed ? 'hidden' : undefined }}>{props.fallback}</span>
      {/* Placed by margins, not a transform: a canvas left untransformed sits on whole device pixels. */}
      {!failed && <RiveCanvas source={props.source} eager alwaysDraw bind={bind} onReady={() => setReady(true)} onError={fail} style={{ position: 'absolute', left: '50%', top: '50%', width: box.width, height: box.height, marginLeft: -box.width / 2, marginTop: -(h / 2 + reach), opacity: ready ? 1 : 0 }} />}
    </span>
  );
}
