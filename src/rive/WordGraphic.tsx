import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RiveCanvas } from './RiveCanvas';
import type { GoalWordProps } from './GoalWord';
import type { RiveInstance } from './types';
import { argb } from './color';

export default function WordGraphic(props: GoalWordProps & { source: string }) {
  // Reference advances include textPath's trailing tracking and the caller's second subtraction.
  const designSize = props.kind === 'red' ? Math.min(70, 346000 / 4493) : Math.min(104, 326000 / 3788);
  const scale = (props.size ?? designSize) / designSize;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(props);
  const step = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => { latest.current = props; step.current?.(); });
  useEffect(() => {
    const off = props.time.on('change', () => step.current?.());
    return () => { off(); latest.current.onFallback(); };
  }, [props.time]);
  const fail = () => { latest.current.onFallback(); setFailed(true); };
  const bind = (instance: RiveInstance, requestSync: () => void) => {
    const vm = instance.viewModelInstance;
    const kind = vm?.string('kind');
    const c1 = vm?.color('color1');
    const c2 = vm?.color('color2');
    const play = vm?.trigger('play');
    const phase = vm?.number('phase');
    if (!kind || !c1 || !c2 || !play || !phase) throw new Error('Moments requires String kind, Color color1/color2, Trigger play and Number phase');
    const q = latest.current;
    if (q.time.get() >= q.full) throw new Error('Scene already landed before the Rive asset loaded');
    kind.value = q.kind;
    c1.value = argb(q.colors[0]);
    c2.value = argb(q.colors[1]);
    phase.value = 0;
    let started = false;
    let done = false;
    const changed = () => {
      const n = phase.value;
      if (n !== 1 && n !== 2) return;
      latest.current.onPhase(n);
      if (n === 2) { done = true; instance.pause(); instance.stopRendering(); }
    };
    phase.on(changed);
    q.onWaiting();
    const advance = () => {
      const current = latest.current;
      // Existing scenes keep their director timers while hidden. Never start/advance in the background.
      if (document.hidden) return;
      if (!done && phase.value < 1 && current.time.get() >= current.full) { done = true; fail(); return; }
      if (!done && !started && current.time.get() >= current.start) {
        started = true;
        play.trigger();
      }
    };
    // The canvas owner decides whether this request may advance or resume rendering.
    step.current = requestSync;
    return {
      shouldPlay: () => started && !done,
      resume: advance,
      cleanup() { phase.off(changed); step.current = undefined; latest.current.onFallback(); },
    };
  };
  return (
    <span aria-hidden="true" style={{ display: 'inline-grid', position: 'relative', height: '100%', alignItems: 'center' }}>
      <span style={{ gridArea: '1 / 1', visibility: ready && !failed ? 'hidden' : undefined }}>{props.fallback}</span>
      {!failed && <RiveCanvas source={props.source} bind={bind} onReady={() => setReady(true)} onError={fail} style={{ position: 'absolute', left: '50%', top: '50%', width: 390 * scale, height: 340 * scale, transform: 'translate(-50%, -50%)', opacity: ready ? 1 : 0 }} />}
    </span>
  );
}
