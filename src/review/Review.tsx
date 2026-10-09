import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { attachedFrame, offerHost, useFrameState } from './hostBridge';
import { type ReviewScene } from './protocol';
import { BEZEL, FEATURED_HELP, fitScale, PHONE, startRoute } from './view';
import styles from './Review.module.css';

/*
 * The review page (SL-18): the running Scoreline demo in a 390 × 844 phone frame, with the few
 * controls a client review needs — a goal, a red card, pause and resume — and a way back to the
 * ordinary app. The frame is the app itself (same origin, its real phone layout) and the only demo on
 * the page; the controls act on that one through hostBridge.ts, never on a copy of their own.
 * Opened from the account sheet's "Phone preview"; the app's route comes with it (?to=), and goes
 * back with "Normal view", so the viewer is where they were.
 */

function useScale(): number {
  const [scale, setScale] = useState(() => fitScale(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const fit = () => setScale(fitScale(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

export function Review() {
  const framed = window.parent !== window;
  const [start] = useState(() => startRoute(window.location.search, document.referrer, window.location.origin));
  const state = useFrameState();
  const scale = useScale();
  const [note, setNote] = useState(FEATURED_HELP);
  const [late, setLate] = useState(false);
  const alive = useRef(true);

  // the page is what a frame looks for; offered before the frame loads, taken back when the page goes
  useLayoutEffect(() => {
    if (framed) return;
    const withdraw = offerHost();
    alive.current = true;
    return () => {
      alive.current = false;
      withdraw();
    };
  }, [framed]);

  // a page whose app starts no demo (?api, ?demo=off) never attaches: say so rather than wait for ever
  useEffect(() => {
    if (framed || state) return;
    const t = setTimeout(() => setLate(true), 6000);
    return () => clearTimeout(t);
  }, [framed, state, start]);

  // the page's own address follows the app, so a reload comes back to the same place
  const route = state?.route ?? start;
  useEffect(() => {
    if (framed || route === start) return;
    window.history.replaceState(null, '', `${window.location.pathname}?to=${encodeURIComponent(route)}`);
  }, [framed, route, start]);

  if (framed) {
    // never a page inside a page: opened in a frame, it sends the viewer to the top
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Scoreline review</h1>
        <p className={styles.help}>
          This page is a window of its own. <a href={window.location.href} target="_top">Open it here</a>.
        </p>
      </main>
    );
  }

  const ready = !!state?.ready;
  const paused = !!state?.paused;
  const scene = (kind: ReviewScene) => {
    const frame = attachedFrame();
    if (!frame) return;
    setNote('Working…');
    void frame.scene(kind).then(
      (said) => alive.current && setNote(said),
      () => alive.current && setNote('That did not work. Try again.'),
    );
  };
  const hint = ready ? note : state ? 'This view is not running the simulated evening, so the goal, card and pause controls are off.' : late ? 'The app in the frame is not running the simulated evening (it was opened with ?api or ?demo=off), so the controls are off.' : 'Starting the evening…';
  const w = PHONE.w + 2 * BEZEL;
  const h = PHONE.h + 2 * BEZEL;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <h1 className={styles.title}>Scoreline review</h1>
        <div className={styles.group} role="group" aria-label="View">
          <button type="button" className={styles.btn} aria-pressed="true">
            Phone preview
          </button>
          <a className={styles.btn} href={route}>
            Normal view
          </a>
        </div>
        <div className={styles.group} role="group" aria-label="Simulation">
          <button type="button" className={styles.btn} disabled={!ready} onClick={() => scene('goal')}>
            Trigger goal
          </button>
          <button type="button" className={styles.btn} disabled={!ready} onClick={() => scene('red')}>
            Trigger red card
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={!ready}
            aria-pressed={paused}
            onClick={() => {
              const frame = attachedFrame();
              if (paused) frame?.resume();
              else frame?.pause();
            }}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className={styles.btn} disabled={!ready} onClick={() => attachedFrame()?.restart()}>
            Restart evening
          </button>
        </div>
        <p className={styles.help} role="status" aria-live="polite">
          {hint}
        </p>
      </header>
      <div className={styles.stage} style={{ width: w * scale, height: h * scale }}>
        <div className={styles.phone} style={{ width: w, height: h, padding: BEZEL, transform: `scale(${scale})` }}>
          <iframe className={styles.screen} title="Scoreline on a phone" src={start} width={PHONE.w} height={PHONE.h} />
        </div>
      </div>
    </main>
  );
}
