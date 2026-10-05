import { useState, useSyncExternalStore } from 'react';
import { activeDemoSource, DEMO_TRIGGERS, subscribeActiveDemoSource, type DemoSource, type DemoTrigger } from '../data/demo';
import styles from './DevPanel.module.css';

/** What each trigger does, from the Lua's header (`luau:38–45`). */
const TRIGGER_NOTE: Record<DemoTrigger, string> = {
  goalHome: 'The home side scores in the featured match',
  goalAway: 'The away side scores in the featured match',
  goalFavorite: 'The player you follow scores (if on the pitch)',
  redHome: 'A home player is sent off (featured match)',
  redAway: 'An away player is sent off (featured match)',
  redFavorite: 'The player you follow is sent off (if on the pitch)',
  fullTime: 'The final whistle in the followed player’s match',
};

const subscribe = (cb: () => void) => {
  let off = () => {};
  const rewire = () => {
    off();
    off = activeDemoSource()?.subscribe(cb) ?? (() => {});
    cb();
  };
  const offActive = subscribeActiveDemoSource(rewire);
  off = activeDemoSource()?.subscribe(cb) ?? (() => {});
  return () => {
    offActive();
    off();
  };
};

type Snapshot = 'none' | 'running' | 'paused';
const snapshot = (): Snapshot => {
  const s = activeDemoSource();
  return !s ? 'none' : s.paused ? 'paused' : 'running';
};

/** The seven triggers, pause / resume and restart, all on the DemoSource the app is connected to. */
export function DemoControls() {
  const state = useSyncExternalStore(subscribe, snapshot);
  const [note, setNote] = useState('');
  const source: DemoSource | null = state === 'none' ? null : activeDemoSource();

  const fire = (name: DemoTrigger) => {
    const s = activeDemoSource();
    if (!s) return;
    setNote(s.trigger(name) ? `${name} fired` : `${name}: nothing to act on right now`);
  };

  return (
    <section className={styles.block} aria-label="Simulation">
      <h3 className={styles.h}>Simulation</h3>
      {!source && <p className={styles.hint}>No demo is running. Open the app with ?demo or ?demo=fast.</p>}
      <div className={styles.row}>
        <button type="button" className={styles.btn} disabled={!source} aria-pressed={state === 'paused'} onClick={() => (state === 'paused' ? source?.resume() : source?.pause())}>
          {state === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className={styles.btn} disabled={!source} onClick={() => source?.restart()}>
          Restart evening
        </button>
      </div>
      <div className={styles.triggers}>
        {DEMO_TRIGGERS.map((name) => (
          <button key={name} type="button" className={styles.btn} disabled={!source} title={TRIGGER_NOTE[name]} onClick={() => fire(name)}>
            {name}
          </button>
        ))}
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {note}
      </p>
    </section>
  );
}
