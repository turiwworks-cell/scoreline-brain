import { useEffect, useId, useRef, useState } from 'react';
import { DemoControls } from './DemoControls';
import { MotionTuner } from './MotionTuner';
import styles from './DevPanel.module.css';

/** The development panel: collapsed to one small button until opened. Escape closes it. */
export function DevPanel() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={styles.root} data-testid="dev-panel">
      <button ref={toggle} type="button" className={styles.toggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        Dev
      </button>
      <div id={id} className={styles.panel} role="region" aria-label="Dev panel" hidden={!open}>
        <DemoControls />
        <MotionTuner />
      </div>
    </div>
  );
}
