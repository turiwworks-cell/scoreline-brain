// The pure part of the motion tuner: which numbers can be edited, what each may be, and the JSON
// the panel copies. The numbers themselves live in motion/tokens; this only reads and patches.

import { motionTokens, TIMING_KEYS, type MotionPatch, type MotionTokens, type TimingKey } from '../motion';

export type GlobalKey = 'speed' | 'toastHold' | 'goalHold' | 'goalFocus' | 'goalMark';
export type TimingField = 'dur' | 'delay' | 'stagger' | 'x1' | 'y1' | 'x2' | 'y2';

export interface FieldSpec {
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
  readonly step: number;
  /** Why a value outside [min, max] is refused; the hint shown under the field. */
  readonly hint: string;
}

export const GLOBALS: readonly (FieldSpec & { readonly key: GlobalKey })[] = [
  { key: 'speed', label: 'speed ×', min: 0.05, step: 0.05, hint: '≥ 0.05 (the Lua floors it there)' },
  { key: 'toastHold', label: 'toast hold s', min: 0.5, step: 0.5, hint: '≥ 0.5 s' },
  { key: 'goalHold', label: 'goal hold s', min: 1, step: 0.5, hint: '≥ 1 s' },
  { key: 'goalFocus', label: 'goal focus s', min: 0.5, step: 0.5, hint: '≥ 0.5 s' },
  { key: 'goalMark', label: 'goal mark s', min: 0.5, step: 0.5, hint: '≥ 0.5 s' },
];

export const TIMING_FIELDS: readonly (FieldSpec & { readonly key: TimingField })[] = [
  { key: 'dur', label: 'dur s', min: 0.01, step: 0.05, hint: '≥ 0.01 s' },
  { key: 'delay', label: 'delay s', min: 0, step: 0.05, hint: '≥ 0 s' },
  { key: 'stagger', label: 'stagger s', min: 0, step: 0.01, hint: '≥ 0 s' },
  { key: 'x1', label: 'x1', min: 0, max: 1, step: 0.01, hint: 'between 0 and 1' },
  { key: 'y1', label: 'y1', step: 0.01, hint: 'any number (may overshoot)' },
  { key: 'x2', label: 'x2', min: 0, max: 1, step: 0.01, hint: 'between 0 and 1' },
  { key: 'y2', label: 'y2', step: 0.01, hint: 'any number (may overshoot)' },
];

/** The number in `text` if it is a finite number inside the spec's range, else null. */
export function parseField(text: string, spec: FieldSpec): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  if (spec.min !== undefined && n < spec.min) return null;
  if (spec.max !== undefined && n > spec.max) return null;
  return n;
}

export function timingValue(tokens: MotionTokens, key: TimingKey, field: TimingField): number {
  const d = tokens.timing[key];
  switch (field) {
    case 'dur':
    case 'delay':
    case 'stagger':
      return d[field];
    case 'x1':
      return d.ease[0];
    case 'y1':
      return d.ease[1];
    case 'x2':
      return d.ease[2];
    case 'y2':
      return d.ease[3];
  }
}

/** The patch that sets one timing field, leaving the rest of the section as it is. */
export function timingPatch(tokens: MotionTokens, key: TimingKey, field: TimingField, value: number): MotionPatch {
  const d = tokens.timing[key];
  if (field === 'dur' || field === 'delay' || field === 'stagger') return { timing: { [key]: { [field]: value } } };
  const ease: [number, number, number, number] = [...d.ease];
  ease[{ x1: 0, y1: 1, x2: 2, y2: 3 }[field]] = value;
  return { timing: { [key]: { ease } } };
}

/** What gets copied: every global and every section, in the tokens' own shape. */
export function tokensJson(tokens: MotionTokens = motionTokens()): string {
  const { timing, ...globals } = tokens;
  const sections: Record<string, unknown> = {};
  for (const k of TIMING_KEYS) sections[k] = { dur: timing[k].dur, delay: timing[k].delay, stagger: timing[k].stagger, ease: [...timing[k].ease] };
  return JSON.stringify({ ...globals, timing: sections }, null, 2);
}

/** Copies to the clipboard; falls back to a hidden textarea where the async API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea route
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
