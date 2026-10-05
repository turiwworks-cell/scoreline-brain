import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LiveIcon } from '../../src/rive/LiveIcon';
import { riveSlots } from '../../src/rive/loader';
import styles from '../../src/features/matchList/Header.module.css';
import '../../src/styles/tokens.css';
import '../../src/styles/materials.css';
import '../../src/styles/global.css';

const probe = { get slots() { return riveSlots.count; } };
declare global { interface Window { liveHostProbe: typeof probe; } }
window.liveHostProbe = probe;
function App() {
  const [live, setLive] = useState(false);
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(true);
  return <main style={{ padding: 24 }}>
    <div id="live-target" style={{ width: 180, height: 70 }}>
      {mounted && <LiveIcon live={live} count={count} onChange={setLive} className={styles.live + ' m-glass'}
        fallback={<span data-testid="fallback-live">Live</span>}>
        <span data-testid="fallback-count">{count}</span>
      </LiveIcon>}
    </div>
    <button id="mount" onClick={() => setMounted((value) => !value)}>Mount/unmount</button>
    {[0, 3, 12, 99].map((value) => <button key={value} id={'count-' + value} onClick={() => setCount(value)}>Count {value}</button>)}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
