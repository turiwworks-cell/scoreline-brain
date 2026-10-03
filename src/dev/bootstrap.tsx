// Mounts the dev panel in its own React root, beside the app, so no shared component knows it
// exists. main.tsx loads this file only under `import.meta.env.DEV`; a production build drops the
// import and with it everything under src/dev.

import { createRoot, type Root } from 'react-dom/client';
import { DevPanel } from './DevPanel';

let mounted: { root: Root; host: HTMLElement } | null = null;

/** Adds the panel to the page. Calling it twice mounts it once. Returns the call that removes it. */
export function mountDevPanel(): () => void {
  if (!mounted) {
    const host = document.createElement('div');
    host.id = 'dev-panel-root';
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<DevPanel />);
    mounted = { root, host };
  }
  return unmountDevPanel;
}

export function unmountDevPanel(): void {
  if (!mounted) return;
  const { root, host } = mounted;
  mounted = null;
  root.unmount();
  host.remove();
}

// A hot update of this module replaces it: remove the old panel first so there is never a second.
import.meta.hot?.dispose(unmountDevPanel);
