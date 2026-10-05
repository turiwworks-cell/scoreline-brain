import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/materials.css';
import './styles/global.css';
import { App } from './app/App';
import { apiMode, connectSource, demoMode } from './data';
import { scorelineStore } from './store';

// The demo (`/`, `?demo`, `?demo=fast`): a simulated matchday, no backend needed. `?api`: the
// real HTTP source, polling `/feed` and following `/events` (npm run api serves them). Each loads
// only when asked for.
const demo = demoMode(window.location.search);
const api = apiMode(window.location.search);
if (api) {
  void Promise.all([import('./data/apiSource'), import('./data/transport')]).then(([{ createApiSource }, { httpTransport }]) => {
    const source = createApiSource({ transport: httpTransport({ feedUrl: `${api}/feed`, eventsUrl: `${api}/events` }) });
    connectSource(source, scorelineStore.getState().actions);
  });
} else if (demo) {
  void import('./data/demo').then(({ createDemoSource }) => {
    // The evening is built in this task and its first feed (written out, parsed, applied) is
    // delivered in the next: together they were one long frame on a phone (Part 21, #5).
    const source = createDemoSource(demo);
    setTimeout(() => connectSource(source, scorelineStore.getState().actions), 0);
  });
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
