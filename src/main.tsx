import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './app/App';
import { connectSource, demoMode } from './data';
import { scorelineStore } from './store';

// `?demo` / `?demo=fast`: a simulated matchday, no backend needed. The demo loads only then.
const demo = demoMode(window.location.search);
if (demo) {
  void import('./data/demo').then(({ createDemoSource }) => connectSource(createDemoSource(demo), scorelineStore.getState().actions));
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
