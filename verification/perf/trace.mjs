// Part 21: a Chrome trace of a page load, taken apart by main-thread task. See README.md.
// Shared by startup.mjs and poll-replay.mjs.

/** The categories the anatomy needs. Tracing slows the page, so take timings from runs without it. */
export const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink.user_timing', 'loading'];

/**
 * Every main-thread task over `minMs`, with its self time split into script / style / layout /
 * observers / paint / gc / other. `start` is from the main frame's navigationStart.
 */
export function anatomy(trace, minMs = 50) {
  const all = trace.traceEvents ?? trace;
  const events = all.filter((e) => e.ph === 'X' || e.ph === 'R' || e.ph === 'I');
  // the main thread: where the main frame's navigationStart is, or, when tracing began after the load,
  // the renderer main thread that ran the most tasks
  let nav = events.find((e) => e.name === 'navigationStart' && e.args?.data?.isLoadingMainFrame);
  if (!nav) {
    const mains = all.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
    const count = (m) => events.filter((e) => e.pid === m.pid && e.tid === m.tid && e.name === 'RunTask').length;
    const main = [...mains].sort((a, b) => count(b) - count(a))[0];
    if (!main) return [];
    nav = { pid: main.pid, tid: main.tid, ts: Math.min(...events.filter((e) => e.ts > 0).map((e) => e.ts)) };
  }
  const main = events.filter((e) => e.pid === nav.pid && e.tid === nav.tid && e.ph === 'X');
  const tasks = main.filter((e) => e.name === 'RunTask' && e.dur > minMs * 1000).sort((a, b) => a.ts - b.ts);
  const kind = (name) => {
    if (/^(FunctionCall|EvaluateScript|v8\.run|v8\.compile|V8\.|TimerFire|FireAnimationFrame|FireIdleCallback|EventDispatch|RunMicrotasks|v8\.callFunction|MinorGC|MajorGC|V8\.GC)/.test(name)) return /GC/.test(name) ? 'gc' : 'script';
    if (/UpdateLayoutTree|RecalculateStyles|ScheduleStyleRecalculation/.test(name)) return 'style';
    if (/^Layout$|^IntersectionObserverController|^ResizeObserver/.test(name)) return /^Layout$/.test(name) ? 'layout' : 'observers';
    if (/Paint|Layerize|Commit|PrePaint|UpdateLayer|Decode|Raster/.test(name)) return 'paint';
    return 'other';
  };
  return tasks.map((task) => {
    const inside = main.filter((e) => e !== task && e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    // self time: each event's duration minus the time its direct children cover
    const stack = [];
    const self = { script: 0, style: 0, layout: 0, observers: 0, paint: 0, gc: 0, other: 0 };
    const finish = (e) => {
      self[kind(e.name)] += Math.max(0, e.dur - (e.__child ?? 0));
      const parent = stack[stack.length - 1];
      if (parent) parent.__child = (parent.__child ?? 0) + e.dur;
    };
    for (const e of inside) {
      while (stack.length && stack[stack.length - 1].ts + stack[stack.length - 1].dur <= e.ts) finish(stack.pop());
      stack.push(e);
    }
    while (stack.length) finish(stack.pop());
    const covered = Object.values(self).reduce((a, b) => a + b, 0);
    self.other += Math.max(0, task.dur - covered);
    const top = inside.filter((e) => ['FunctionCall', 'EvaluateScript', 'TimerFire', 'FireAnimationFrame', 'v8.callFunction'].includes(e.name)).sort((a, b) => b.dur - a.dur)[0];
    return {
      start: (task.ts - nav.ts) / 1000, dur: task.dur / 1000,
      self: Object.fromEntries(Object.entries(self).map(([k, v]) => [k, v / 1000])),
      top: top ? `${top.name} ${top.args?.data?.functionName ?? ''} ${(top.args?.data?.url ?? '').split('/').pop()}`.trim() : '',
    };
  });
}
