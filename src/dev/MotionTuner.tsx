import { useEffect, useId, useRef, useState } from 'react';
import { motionTokens, resetMotion, TIMING_KEYS, tuneMotion, type TimingKey } from '../motion';
import { copyText, GLOBALS, parseField, TIMING_FIELDS, timingPatch, timingValue, tokensJson, type FieldSpec, type GlobalKey, type TimingField } from './motionEdit';
import styles from './DevPanel.module.css';

type Drafts = Record<string, string>;

const fieldId = (scope: string, key: string) => `${scope}.${key}`;

function readDrafts(section: TimingKey): Drafts {
  const t = motionTokens();
  const d: Drafts = {};
  for (const g of GLOBALS) d[fieldId('g', g.key)] = String(t[g.key]);
  for (const f of TIMING_FIELDS) d[fieldId(section, f.key)] = String(timingValue(t, section, f.key));
  return d;
}

/** Live editing of the motion tokens: edits apply at once, bad numbers are refused and flagged. */
export function MotionTuner() {
  const uid = useId();
  const [section, setSection] = useState<TimingKey>('cards');
  const [drafts, setDrafts] = useState<Drafts>(() => readDrafts('cards'));
  const [bad, setBad] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(noteTimer.current), []);
  const flash = (msg: string) => {
    setNote(msg);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 2500);
  };

  const setBadFlag = (id: string, isBad: boolean) =>
    setBad((prev) => {
      if (prev.has(id) === isBad) return prev;
      const next = new Set(prev);
      if (isBad) next.add(id);
      else next.delete(id);
      return next;
    });

  const edit = (id: string, text: string, spec: FieldSpec, apply: (n: number) => void) => {
    setDrafts((d) => ({ ...d, [id]: text }));
    const n = parseField(text, spec);
    setBadFlag(id, n === null);
    if (n !== null) apply(n);
  };

  const pickSection = (key: TimingKey) => {
    setSection(key);
    setDrafts(readDrafts(key));
    setBad(new Set());
  };

  const onReset = () => {
    resetMotion();
    setDrafts(readDrafts(section));
    setBad(new Set());
    flash('Reset to the approved values');
  };

  const onCopy = async () => flash((await copyText(tokensJson())) ? 'Copied JSON' : 'Copy failed: select the JSON below');

  const input = (id: string, spec: FieldSpec, apply: (n: number) => void) => (
    <div key={id} className={styles.cell}>
      <label className={styles.field}>
        <span>{spec.label}</span>
        <input
          type="number"
          inputMode="decimal"
          step={spec.step}
          min={spec.min}
          max={spec.max}
          value={drafts[id] ?? ''}
          aria-invalid={bad.has(id) || undefined}
          aria-describedby={bad.has(id) ? `${uid}-${id}` : undefined}
          onChange={(e) => edit(id, e.target.value, spec, apply)}
        />
      </label>
      {bad.has(id) && (
        <small id={`${uid}-${id}`} className={styles.err}>
          {spec.hint}
        </small>
      )}
    </div>
  );

  return (
    <section className={styles.block} aria-label="Motion tokens">
      <h3 className={styles.h}>Motion tokens</h3>
      <div className={styles.grid}>
        {GLOBALS.map((g) => input(fieldId('g', g.key), g, (n) => tuneMotion({ [g.key satisfies GlobalKey]: n })))}
      </div>
      <label className={styles.field}>
        <span>section</span>
        <select value={section} onChange={(e) => pickSection(e.target.value as TimingKey)}>
          {TIMING_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.grid}>
        {TIMING_FIELDS.map((f) => input(fieldId(section, f.key), f, (n) => tuneMotion(timingPatch(motionTokens(), section, f.key satisfies TimingField, n))))}
      </div>
      {bad.size > 0 && <p className={styles.hint}>Out-of-range values are not applied; the last good value stays in force.</p>}
      <div className={styles.row}>
        <button type="button" className={styles.btn} onClick={onReset}>
          Reset tokens
        </button>
        <button type="button" className={styles.btn} onClick={() => void onCopy()}>
          Copy as JSON
        </button>
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {note}
      </p>
    </section>
  );
}
