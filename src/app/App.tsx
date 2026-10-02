import { lazy, Suspense } from 'react';
import styles from './App.module.css';

// /dev/kit shows the shared materials (Part 6). Its own chunk, so it costs the app nothing.
// Part 9 replaces this path check with the router.
const DevKit = lazy(() => import('./devkit/DevKit').then((m) => ({ default: m.DevKit })));

export function App() {
  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/dev/kit') {
    return (
      <Suspense fallback={null}>
        <DevKit />
      </Suspense>
    );
  }
  return <main className={styles.shell} data-testid="app-shell" aria-label="Scoreline" />;
}
