import { useState } from 'react';
import { Glass, Tabs } from '../../ui';
import styles from './placeholder.module.css';

// DESK_TABS, luau:6771
const ITEMS = [
  { id: 'player', label: 'Player' },
  { id: 'tables', label: 'Tables' },
  { id: 'leaders', label: 'Leaders' },
] as const;

/** Placeholder for the desktop's third pane (Part 15 builds Player / Tables / Leaders). */
export function InsightsPlaceholder() {
  const [tab, setTab] = useState<string>('tables');
  return (
    <div className={styles.page}>
      <h1 className={`${styles.label} ${styles.heading}`} tabIndex={-1} data-screen-heading="">
        Insights
      </h1>
      <div className={styles.segment}>
        <Tabs variant="segment" items={ITEMS} value={tab} onChange={setTab} aria-label="Insights" idBase="insights" />
      </div>
      <div role="tabpanel" id={`insights-panel-${tab}`} aria-labelledby={`insights-tab-${tab}`}>
        {Array.from({ length: 8 }, (_, i) => (
          <Glass key={i} className={styles.block}>
            {ITEMS.find((t) => t.id === tab)?.label} · placeholder {i + 1}
          </Glass>
        ))}
      </div>
    </div>
  );
}
