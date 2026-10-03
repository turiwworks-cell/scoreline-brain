import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/materials.css';
import './styles/global.css';
import { App } from './app/App';
import { connectSource, demoMode } from './data';
import { scorelineStore } from './store';

// `?demo` / `?demo=fast`: a simulated matchday, no backend needed. The demo loads only then.
const demo = demoMode(window.location.search);
if (demo) {
  void import('./data/demo').then(({ createDemoSource }) => connectSource(createDemoSource(demo), scorelineStore.getState().actions));
}

// Development only: the dev panel (Part 16). The condition is replaced at build time, so a
// production bundle holds neither this import nor anything under src/dev.
if (import.meta.env.DEV) void import('./dev/bootstrap').then((m) => m.mountDevPanel());

// each pane restores its own scroll (app/nav/scrollMemory.ts); the page itself never scrolls
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
