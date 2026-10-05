import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CURVES, holds, MOTION_DEF, motionTokens, resetMotion, timing, TIMING_DEF, TIMING_KEYS, tuneMotion } from './tokens';

const root = join(__dirname, '..', '..');
const lua = readFileSync(join(root, 'legacy', 'scoreline_11.luau'), 'utf8');
const css = readFileSync(join(root, 'src', 'styles', 'tokens.css'), 'utf8');

afterEach(resetMotion);

describe('motion tokens', () => {
  it('copy the Lua TIMING_DEF verbatim, in its order', () => {
    const keys = /local TIMING_KEYS = \{([^}]*)\}/.exec(lua)?.[1]?.match(/"(\w+)"/g)?.map((k) => k.slice(1, -1));
    expect(keys).toEqual([...TIMING_KEYS]);
    const table = /local TIMING_DEF[^=]*= \{([\s\S]*?)\n\}/.exec(lua)?.[1] ?? '';
    const rows = [...table.matchAll(/(\w+) = \{ ([^}]*) \}/g)];
    expect(rows.map((r) => r[1])).toEqual([...TIMING_KEYS]);
    for (const [, key, nums] of rows) {
      const d = TIMING_DEF[key as keyof typeof TIMING_DEF];
      expect([d.dur, d.delay, d.stagger, ...d.ease], key).toEqual(nums?.split(',').map(Number));
    }
  });

  it('match tokens.css --t-<section>-* for every section', () => {
    const ms = (v: string | undefined) => Number(v?.replace('ms', '')) / 1000;
    for (const key of TIMING_KEYS) {
      const d = TIMING_DEF[key];
      const get = (p: string) => new RegExp(`--t-${key}-${p}: ([^;]+);`).exec(css)?.[1];
      expect(ms(get('dur')), `${key} dur`).toBeCloseTo(d.dur, 6);
      expect(ms(get('delay')), `${key} delay`).toBeCloseTo(d.delay, 6);
      expect(ms(get('stagger')), `${key} stagger`).toBeCloseTo(d.stagger, 6);
      expect(get('ease'), `${key} ease`).toBe(`cubic-bezier(${d.ease.join(', ')})`);
    }
  });

  it('name the Lua curves', () => {
    for (const [name, c] of Object.entries({ EASE: CURVES.ease, GLIDE: CURVES.glide, INOUT: CURVES.inout, IN: CURVES.in, LINEAR: CURVES.linear })) {
      expect(lua, name).toContain(`local ${name} = C(${c.join(', ')})`);
    }
    // no curve overshoots: every y stays in 0..1
    for (const c of [...Object.values(CURVES), ...TIMING_KEYS.map((k) => TIMING_DEF[k].ease)]) {
      expect(Math.min(c[1], c[3])).toBeGreaterThanOrEqual(0);
      expect(Math.max(c[1], c[3])).toBeLessThanOrEqual(1);
    }
  });

  it('timing() is the section in seconds, divided by speed', () => {
    expect(timing('screen')).toEqual({ duration: 0.55, delay: 0, stagger: 0.05, ease: [0.16, 1, 0.3, 1] });
    tuneMotion({ speed: 2 });
    expect(timing('player')).toMatchObject({ duration: 0.36, delay: 0.06, stagger: 0.025 });
  });

  it('clamps like the Lua: speed floor 0.05, duration floor 0.01, curve x in 0..1', () => {
    tuneMotion({ speed: 0, timing: { tabs: { dur: 0, delay: -1, ease: [-1, 0.8, 2, 1] } } });
    expect(timing('tabs')).toEqual({ duration: 0.01 / 0.05, delay: 0, stagger: 0.06 / 0.05, ease: [0, 0.8, 1, 1] });
  });

  it('tuneMotion patches one section and resetMotion restores the approved values', () => {
    tuneMotion({ timing: { lineup: { stagger: 0.2 } }, goalHold: 3 });
    expect(motionTokens().timing.lineup).toEqual({ ...TIMING_DEF.lineup, stagger: 0.2 });
    expect(motionTokens().timing.cards).toBe(TIMING_DEF.cards);
    expect(motionTokens().goalHold).toBe(3);
    resetMotion();
    expect(motionTokens()).toEqual({ ...MOTION_DEF, timing: TIMING_DEF });
  });

  it('holds keep their floors and ignore speed', () => {
    expect(holds()).toEqual({ toastHold: 4.5, goalHold: 7.5, goalFocus: 4, goalMark: 8 });
    tuneMotion({ speed: 4, toastHold: 0, goalHold: 0, goalFocus: 0, goalMark: 0 });
    expect(holds()).toEqual({ toastHold: 0.5, goalHold: 1, goalFocus: 0.5, goalMark: 0.5 });
  });
});
