/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';

/*
 * The app's entry runs once index.html's static first frame has been painted (Part 21, #4).
 *
 * The built page asks for the entry with a module script, which runs as soon as it has arrived:
 * evaluating the app and rendering it then came before the first paint, and held the static frame
 * back by that long (on a phone with the scripts cached, the whole of the first paint's delay).
 * Here the entry's script tag becomes a modulepreload in the same place, so it and everything it
 * imports still download as early as before, and a small inline script adds the module script
 * once the first contentful paint is on screen (its paint-timing entry; two frames where there is
 * none; at most 2 s). A hidden page has no frame to wait for and starts at once. The module graph, the chunks and their sizes are
 * unchanged; scripts/size-budget.mjs counts the entry through its modulepreload.
 */
function bootAfterFirstPaint(): Plugin {
  return {
    name: 'scoreline:boot-after-first-paint',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // the app's page only; the perf harness's page (verification/perf) mounts the app its own way
        if (ctx.path !== '/index.html') return;
        const entry = /<script type="module" crossorigin src="([^"]+)"><\/script>/.exec(html);
        if (!entry) throw new Error('bootAfterFirstPaint: no entry script in index.html');

        const boot = `<script>
      (function () {
        var started = false;
        function start() {
          if (started) return;
          started = true;
          document.removeEventListener('visibilitychange', start);
          var s = document.createElement('script');
          s.type = 'module';
          s.crossOrigin = '';
          s.src = ${JSON.stringify(entry[1])};
          document.head.appendChild(s);
        }
        function later() { setTimeout(start, 0); }
        if (document.visibilityState === 'hidden') return start();
        document.addEventListener('visibilitychange', start);
        // once the first contentful paint is on screen; two frames where paint timing is missing
        try {
          new PerformanceObserver(function (list, observer) {
            if (list.getEntriesByName('first-contentful-paint').length === 0) return;
            observer.disconnect();
            later();
          }).observe({ type: 'paint', buffered: true });
        } catch (e) {
          requestAnimationFrame(function () { requestAnimationFrame(later); });
        }
        // and never later than this, whatever the page has painted
        setTimeout(start, 2000);
      })();
    </script>`;
        return html
          .replace(entry[0], `<link rel="modulepreload" crossorigin href="${entry[1]}">`)
          // nothing the first frame shows needs a script: the style sheet and the face come first
          .replaceAll('<link rel="modulepreload" crossorigin href=', '<link rel="modulepreload" fetchpriority="low" crossorigin href=')
          .replace('</body>', `  ${boot}\n  </body>`);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), bootAfterFirstPaint()],
  define: {
    __RIVE_ASSETS__: JSON.stringify({
      liveIcon: existsSync(new URL('./public/rive/live-icon.riv', import.meta.url)),
      moments: existsSync(new URL('./public/rive/moments.riv', import.meta.url)),
    }),
  },
  css: { modules: { localsConvention: 'camelCaseOnly' } },
  build: {
    target: 'es2022',
    rolldownOptions: {
      treeshake: {
        // Boundary schemas only construct validators: no listeners, timers or registrations.
        // Re-exporting them from domain/index must not eagerly ship Zod to the app shell.
        // Sources retain all used validators in their own chunks. Other modules keep defaults.
        moduleSideEffects: (id) => /[\\/]src[\\/]domain[\\/]schemas\.ts$/.test(id) ? false : undefined,
      },
      output: {
        // React, routing and Motion are already needed by the shell. Compress their used
        // exports together; feature screens, validation and Rive keep their lazy boundaries.
        codeSplitting: {
          groups: [
            { name: 'app-vendor', test: /[\\/]node_modules[\\/](?:react|react-dom|react-router|scheduler|motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
