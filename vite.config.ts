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
        // the demo: its chunk and what it imports (the parser) are asked for when the app is
        // started, not once it has run; nothing changes for other pages
        const demo: string[] = [];
        const bundle = ctx.bundle ?? {};
        const walk = (file: string) => {
          const chunk = bundle[file];
          if (chunk?.type !== 'chunk' || demo.includes(`/${file}`) || html.includes(`"/${file}"`)) return;
          demo.push(`/${file}`);
          chunk.imports.forEach(walk);
        };
        const demoChunk = Object.values(bundle).find((c) => c.type === 'chunk' && c.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/data/demo/index.ts'));
        if (!demoChunk) throw new Error('bootAfterFirstPaint: no chunk for src/data/demo');
        walk(demoChunk.fileName);

        const boot = `<script>
      (function () {
        var started = false;
        function start() {
          if (started) return;
          started = true;
          document.removeEventListener('visibilitychange', start);
          // the demo plays unless ?api or ?demo=off (src/data/demo/mode.ts)
          var q = new URLSearchParams(location.search);
          var demo = q.get('demo');
          if (demo === null ? !q.has('api') : demo !== '0' && demo !== 'false' && demo !== 'off') {
            ${JSON.stringify(demo)}.forEach(function (href) {
              var l = document.createElement('link');
              l.rel = 'modulepreload';
              l.crossOrigin = '';
              l.href = href;
              document.head.appendChild(l);
            });
          }
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

// `?api` talks to /api; locally that is the mock backend (npm run api, scripts/mock-api.mjs)
const apiProxy = { '/api': { target: `http://127.0.0.1:${process.env.MOCK_API_PORT ?? 8787}`, changeOrigin: true } };

export default defineConfig({
  plugins: [react(), bootAfterFirstPaint()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
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
