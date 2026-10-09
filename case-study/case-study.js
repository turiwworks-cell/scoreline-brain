'use strict';
/* ==========================================================================
   Scoreline — case study (Turinoz)
   One file, no libraries. In order:
     helpers · reveal, counters & nav · label cursor · pause · THE PHONE (the real app,
     driven through its own review bridge) · roles · decisions · system · curves ·
     timing stage · touch · race · Rive · process · terminal
   The page moves on Scoreline's own curves. Everything that loops sleeps off screen,
   in a hidden tab, when "Pause" is on, and for visitors who prefer reduced motion.
   ========================================================================== */
(() => {
  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const html = document.documentElement;
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqWide = matchMedia('(min-width: 1101px)');
  const reduce = () => mqReduce.matches;
  const paused = () => html.classList.contains('paused');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  const status = $('#status');
  const say = msg => { if (status) status.textContent = msg; };
  const vis = new Set();                          // loops that only run while their element is on screen
  const onScreen = (el, cb, margin = '0px') => new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting, e)), { rootMargin: margin }).observe(el);
  const EASE = { glide: 'cubic-bezier(.16,1,.3,1)', ease: 'cubic-bezier(.2,.8,.2,1)', inout: 'cubic-bezier(.42,0,.58,1)', roll: 'cubic-bezier(.7,0,.2,1)', in: 'cubic-bezier(.5,0,.75,0)' };
  const cb = v => `cubic-bezier(${v.join(',')})`;
  const parseV = s => s.split(',').map(Number);
  const fmtV = v => v.map(n => String(n)).join(', ');

  // a cubic-bezier as a function of x (the same solver a browser uses: Newton, then bisection)
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
    const tOf = x => {
      let t = x;
      for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) return t; const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 40; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (x > v) lo = t; else hi = t; t = (lo + hi) / 2; }
      return t;
    };
    return x => (x <= 0 ? 0 : x >= 1 ? 1 : sy(tOf(x)));
  }
  const DEFAULT = [0.25, 0.1, 0.25, 1];

  /* ==========================================================================
     REVEAL · COUNTERS · NAV · PROGRESS
     ========================================================================== */
  const counted = new WeakSet();
  function countUp(el) {
    if (counted.has(el)) return; counted.add(el);
    const to = +el.dataset.to, fmt = n => n.toLocaleString('en-US');
    if (reduce() || to < 3) { el.textContent = fmt(to); return; }
    const f = bezier(.16, 1, .3, 1), t0 = performance.now(), dur = to > 1000 ? 1600 : 1100;
    const tick = now => { const p = clamp((now - t0) / dur, 0, 1); el.textContent = fmt(Math.round(to * f(p))); if (p < 1) requestAnimationFrame(tick); };
    el.textContent = '0'; requestAnimationFrame(tick);
  }
  const reveal = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); reveal.unobserve(e.target);
    $$('.count', e.target).forEach(countUp);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .06 });
  $$('.rv, .h1').forEach(el => reveal.observe(el));
  $$('.count').forEach(el => { if (!el.closest('.rv')) onScreen(el, v => v && countUp(el)); });

  const nav = $('#nav'), links = $$('#links a'), pill = $('#links .pill'), bar = $('.progress u');
  const secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  let onLink = null;
  const placePill = a => {
    if (!pill) return;
    if (!a) { pill.style.opacity = '0'; return; }
    pill.style.left = a.offsetLeft + 'px'; pill.style.width = a.offsetWidth + 'px'; pill.style.opacity = '1';
  };
  const scrollers = [];                           // things that follow the scroll position
  let queued = false;
  const onScroll = () => {
    queued = false;
    const y = scrollY, max = Math.max(1, html.scrollHeight - innerHeight);
    nav.classList.toggle('scrolled', y > 8);
    if (bar) bar.style.setProperty('--sp', (y / max).toFixed(4));
    let cur = null;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * .42) cur = links[i]; });
    if (cur !== onLink) { links.forEach(a => a.classList.toggle('on', a === cur)); onLink = cur; placePill(cur); }
    scrollers.forEach(fn => fn(y));
  };
  const kick = () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { placePill(onLink); kick(); });

  /* ==========================================================================
     LABEL CURSOR — says what you're pointing at (fine pointers only)
     ========================================================================== */
  const lcur = $('.lcur'), lcurT = lcur && $('span', lcur);
  const LC = { x: -100, y: -100, tx: -100, ty: -100, el: null, run: false };
  const lcurTick = () => {
    LC.x += (LC.tx - LC.x) * .32; LC.y += (LC.ty - LC.y) * .32;
    lcur.style.transform = `translate3d(${LC.x.toFixed(1)}px,${LC.y.toFixed(1)}px,0)`;
    const label = LC.el && LC.el.dataset.cursor;
    if (label && lcurT.textContent !== label) lcurT.textContent = label;
    lcur.classList.toggle('on', !!label);
    if (Math.abs(LC.tx - LC.x) > .2 || Math.abs(LC.ty - LC.y) > .2 || label) requestAnimationFrame(lcurTick); else LC.run = false;
  };
  if (lcur) {
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !mqFine.matches) return;
      LC.tx = e.clientX; LC.ty = e.clientY;
      if (LC.x < -50) { LC.x = LC.tx; LC.y = LC.ty; }
      LC.el = e.target.closest ? e.target.closest('[data-cursor]') : null;
      if (!LC.run) { LC.run = true; requestAnimationFrame(lcurTick); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { LC.el = null; });
    addEventListener('blur', () => { LC.el = null; });
  }

  /* ---------- pause the page's own motion ---------- */
  const pp = $('#pp');
  pp && pp.addEventListener('click', () => {
    const on = !paused();
    html.classList.toggle('paused', on); pp.setAttribute('aria-pressed', String(on));
    say(on ? 'The page’s motion is paused. The demo keeps its own time.' : 'The page’s motion is playing.');
  });

  /* ==========================================================================
     THE PHONE — the real app (app/), one copy, the whole way down
     ========================================================================== */
  const APP = 'app/';
  const dock = $('#dock'), screenEl = $('#screen'), frame = $('#app'), veil = $('#veil');
  const routeEl = $('#dockRoute'), noteEl = $('#dockNote'), backdrop = $('#dockBackdrop'), demoPill = $('#demoPill');
  const pauseBtn = $('#dockPause');
  const D = { app: null, started: false, allow: false, open: false, control: false, want: null, token: 0, lastRoute: '', base: '', moment: false };
  D.base = new URL(APP, location.href).pathname.replace(/\/$/, '');      // e.g. /scoreline/app

  // the app looks for this on its parent when its demo starts (src/review/protocol.ts)
  window.scorelineReviewHost = {
    attach(f) { D.app = f; onAttach(); },
    detach(f) { if (D.app === f) D.app = null; },
  };
  const appRoute = () => {
    try { const l = frame.contentWindow.location; return (l.pathname.startsWith(D.base) ? l.pathname.slice(D.base.length) : l.pathname) + l.search; } catch (_) { return '/'; }
  };
  const routeName = r => {
    const [path, q] = r.split('?'), seg = path.split('/').filter(Boolean);
    if (seg[0] === 'match') { const tab = seg[2] || 'facts'; return 'Match · ' + tab[0].toUpperCase() + tab.slice(1); }
    if (seg[0] === 'player') return seg[1] === 'arg' && seg[2] === '10' ? 'Player · Messi' : 'Player';
    if (q && /live=0|day=/.test(q)) return 'List · Today';
    return 'List · Live';
  };
  function showRoute() {
    const r = appRoute(), name = routeName(r);
    if (name === D.lastRoute) return;
    D.lastRoute = name; routeEl.textContent = name;
    routeEl.classList.remove('swap'); void routeEl.offsetWidth; routeEl.classList.add('swap');
    $('#dockFull').href = APP + r.replace(/^\//, '');
  }
  function onAttach() {
    screenEl.classList.add('ready');
    D.app.subscribe(() => { showRoute(); syncPause(); });
    showRoute(); syncPause();
    if (D.want) { const w = D.want; D.want = null; go(w.route, w); }
  }
  function syncPause() {
    const st = D.app && D.app.state(), p = !!(st && st.paused);
    $('span', pauseBtn).textContent = p ? 'Resume' : 'Pause';
    $('use', pauseBtn).setAttribute('href', p ? '#icPlay' : '#icPause');
  }
  function start() {
    if (D.started) return; D.started = true;
    frame.src = APP;
  }
  // a page that has to wait for the phone still shows something: the poster, then the app as it paints
  frame.addEventListener('load', () => { if (D.started) setTimeout(() => screenEl.classList.add('ready'), 1800); });

  // the phone's size: as tall as the window allows, never wider than its column
  function fit() {
    const wide = mqWide.matches, h = innerHeight;
    const s = wide ? clamp((h - 64 - 190) / 868, .5, .9) : clamp(Math.min((h - 190) / 868, (innerWidth - 40) / 414), .45, .9);
    dock.style.setProperty('--s', s.toFixed(4));
    html.style.setProperty('--dockw', Math.round(414 * s + 40) + 'px');
  }
  fit(); addEventListener('resize', fit);

  /* states: docked beside a phone section · away (the pill shows) · open (called from the pill) */
  function setState(st) {
    if (dock.dataset.state === st) return;
    dock.dataset.state = st;
    demoPill.classList.toggle('on', st === 'away');
    backdrop.classList.toggle('on', st === 'open');
    if (st === 'open' || (st === 'docked' && D.allow)) start();
    if (st === 'away' && D.control) giveBack();
  }
  function dockFor() {
    if (D.open) return 'open';
    if (!mqWide.matches) return 'away';
    const mid = innerHeight * .5;
    const here = $$('main > section').find(s => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
    return here && here.dataset.dock === 'phone' ? 'docked' : 'away';
  }
  scrollers.push(() => setState(dockFor()));
  mqWide.addEventListener('change', () => { fit(); setState(dockFor()); });

  function openDemo(e) {
    // beside a section the phone is already here: the button hands it over instead
    if (dock.dataset.state === 'docked') { if (e && e.currentTarget && !e.currentTarget.hasAttribute('data-scene')) takeControl(); return; }
    D.open = true; setState('open');
  }
  function closeDemo() { D.open = false; setState(dockFor()); }
  $$('[data-open-demo]').forEach(b => b.addEventListener('click', openDemo));
  $('#dockClose').addEventListener('click', closeDemo);
  backdrop.addEventListener('click', closeDemo);
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (D.control) giveBack(); else if (D.open) closeDemo();
  });

  /* take control: the phone takes the pointer (and the wheel) until it's given back */
  function takeControl() {
    if (dock.dataset.state === 'away') openDemo();
    D.control = true; dock.classList.add('control'); frame.tabIndex = 0;
    hideCursor();
    note('It’s yours. Scroll it, tap it, swipe back. Esc gives it back.');
    try { frame.focus(); } catch (_) {}
  }
  function giveBack() {
    D.control = false; dock.classList.remove('control'); frame.tabIndex = -1;
    note('Back on the tour. Take control again any time.');
  }
  veil.addEventListener('click', takeControl);
  $$('[data-take]').forEach(b => b.addEventListener('click', takeControl));
  $('#dockGive').addEventListener('click', giveBack);
  let leaveT = 0;
  dock.addEventListener('pointerleave', e => { if (D.control && e.pointerType === 'mouse') leaveT = setTimeout(giveBack, 2600); });
  dock.addEventListener('pointerenter', () => clearTimeout(leaveT));
  frame.style.pointerEvents = 'auto';
  // without control the frame takes nothing: the veil sits over it
  const note = t => { noteEl.textContent = t; };

  /* the controls: the app's own calls (the same ones its review page makes) */
  async function scene(kind) {
    if (dock.dataset.state === 'away') openDemo();
    start();
    if (!D.app) { note('The demo is still starting…'); D.want = { route: '/', scene: kind }; return; }
    hideCursor();
    note(kind === 'goal' ? 'Scoring…' : 'Showing a red card…');
    try { const said = await D.app.scene(kind); note(said); say(said); } catch (_) { note('That didn’t work. Try again.'); }
  }
  $$('[data-scene]').forEach(b => b.addEventListener('click', () => scene(b.dataset.scene)));
  pauseBtn.addEventListener('click', () => {
    if (!D.app) return;
    const st = D.app.state();
    if (st.paused) { D.app.resume(); note('The evening is running again.'); } else { D.app.pause(); note('The evening is paused. Goals you add wait for Resume.'); }
    syncPause();
  });
  $('#dockRestart').addEventListener('click', () => { if (!D.app) return; D.app.restart(); note('The evening starts again from the top.'); });

  /* moving the app between screens: its own router, no new history (the page's Back stays the page's) */
  function navigate(route) {
    let w;
    try { w = frame.contentWindow; if (!w || !w.history) return false; } catch (_) { return false; }
    if (appRoute() === route) return true;
    const st = w.history.state || {};
    const next = { usr: null, key: Math.random().toString(36).slice(2, 10), idx: typeof st.idx === 'number' ? st.idx : 0 };
    const had = document.activeElement;
    w.history.replaceState(next, '', D.base + route);
    w.dispatchEvent(new PopStateEvent('popstate', { state: next }));
    // the app moves focus to the new screen's title; on the tour that would pull the keyboard into the phone
    [60, 400, 900].forEach(ms => setTimeout(() => keepFocus(had), ms));
    return true;
  }
  function keepFocus(had) {
    if (D.control || document.activeElement !== frame) return;
    try { const a = frame.contentDocument.activeElement; if (a && a.blur) a.blur(); } catch (_) {}
    if (had && had !== frame && had !== document.body && had.focus) had.focus({ preventScroll: true }); else frame.blur();
  }
  const appDoc = () => { try { return frame.contentDocument; } catch (_) { return null; } };
  const presentScreen = () => { const d = appDoc(); return d && [...d.querySelectorAll('[data-screen][data-present="true"]')].pop(); };
  function find(spec) {
    const d = appDoc(); if (!d || !spec) return null;
    const scr = presentScreen() || d.body;
    const [kind, arg] = [spec.split(':')[0], spec.slice(spec.indexOf(':') + 1)];
    if (kind === 'label') return d.querySelector(`[aria-label^="${arg}"]`);
    if (kind === 'h') return [...scr.querySelectorAll('h2,h3')].find(e => e.textContent.trim().toLowerCase() === arg.toLowerCase()) || null;
    if (kind === 'live-card') return d.querySelector('button[aria-label$=", live"]');
    if (kind === 'score') return [...scr.querySelectorAll('span')].find(e => !e.children.length && /^\d$/.test(e.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) > 40) || null;
    if (kind === 'goal-row') { const a = [...scr.querySelectorAll('span')].find(e => !e.children.length && /^Assist/.test(e.textContent.trim())); return a ? (a.closest('[class*="_goal_"]') || a.parentElement) : null; }
    return null;
  }
  function scrollApp(spec, top = 150) {
    const scr = presentScreen(); if (!scr) return;
    const el = spec === 'goal-row' ? find('goal-row') : find('h:' + spec);
    if (!el) return;
    const y = el.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop - (spec === 'goal-row' ? scr.clientHeight * .38 : top);
    scr.scrollTo({ top: Math.max(0, y), behavior: reduce() ? 'auto' : 'smooth' });
  }
  function resetScroll() { const d = appDoc(); if (!d) return; $$('[data-screen]', d).forEach(s => { if (s.scrollTop) s.scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' }); }); }

  /* Turinoz's cursor over the phone: glides to the detail, taps, says one line */
  const TC = { cur: $('.tcur', screenEl), bub: $('.tcur .bub', screenEl), tx: $('.tcur .tx', screenEl) };
  function hideCursor() { TC.token = (TC.token || 0) + 1; TC.cur.classList.remove('on'); TC.bub.classList.remove('on', 'typing'); }
  function pointAt(x, y, line) {
    const tok = TC.token = (TC.token || 0) + 1, cur = TC.cur, fw = screenEl.clientWidth, fh = screenEl.clientHeight;
    x = clamp(x, 12, fw - 12); y = clamp(y, 40, fh - 30);
    TC.bub.classList.remove('on', 'typing'); TC.tx.textContent = line;
    const bw = TC.bub.offsetWidth + 4; TC.tx.textContent = '';
    const right = x + 20 + bw <= fw - 6, leftOk = x - 12 - bw >= 6, left = !right && leftOk;
    cur.classList.toggle('left', left); cur.classList.toggle('up', y > fh * .78);
    let nudge = 0; if (!right && !leftOk) nudge = (fw - 6 - bw) - (x + 20);
    TC.bub.style.marginLeft = nudge ? nudge.toFixed(0) + 'px' : '';
    if (!TC.placed) {                                // the first time, it comes in from the middle of the screen
      TC.placed = true; cur.style.transition = 'none';
      cur.style.transform = `translate3d(${(fw * .55).toFixed(1)}px,${(fh * .6).toFixed(1)}px,0)`;
      void cur.offsetWidth; cur.style.transition = '';
    }
    cur.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    cur.classList.add('on');
    (async () => {
      await wait(reduce() ? 60 : 1000); if (tok !== TC.token) return;
      cur.classList.add('press', 'clk'); await wait(160); cur.classList.remove('press');
      await wait(120); if (tok !== TC.token) return;
      TC.bub.classList.add('on', 'typing');
      if (reduce()) TC.tx.textContent = line;
      else for (let i = 1; i <= line.length; i++) { if (tok !== TC.token) return; TC.tx.textContent = line.slice(0, i); await wait(28 + (line[i - 1] === ' ' ? 30 : 0)); }
      await wait(900); if (tok !== TC.token) return;
      TC.bub.classList.remove('typing'); cur.classList.remove('clk');
    })();
  }
  function pointSpec(spec, dx, dy, line) {
    if (!line) { hideCursor(); return; }
    const s = parseFloat(getComputedStyle(dock).getPropertyValue('--s')) || .86;
    let x, y;
    if (spec && spec.startsWith('pct:')) { const [px, py] = spec.slice(4).split(',').map(Number); x = px / 100 * screenEl.clientWidth; y = py / 100 * screenEl.clientHeight; }
    else {
      const el = find(spec); if (!el) { hideCursor(); return; }
      const r = el.getBoundingClientRect();
      x = (r.left + Math.min(r.width * .5, 60) + (dx || 0)) * s; y = (r.top + r.height * .5 + (dy || 0)) * s;
    }
    pointAt(x, y, line);
  }

  /* go: the screen for a decision, then where to look */
  async function go(route, opt = {}) {
    start();
    if (!D.app) { D.want = { route, ...opt }; return; }
    if (D.control) return;                                     // never pull the screen away from someone using it
    const tok = ++D.token;
    hideCursor();
    const moved = navigate(route);
    if (!moved) return;
    await wait(route.startsWith('/match') || route.startsWith('/player') ? 650 : 380); if (tok !== D.token) return;
    if (opt.scroll) { scrollApp(opt.scroll, 182); await wait(700); } else resetScroll();
    if (tok !== D.token) return;
    if (opt.scene) { await wait(250); if (tok === D.token) scene(opt.scene); return; }
    await wait(120); if (tok !== D.token) return;
    pointSpec(opt.point, opt.dx, opt.dy, opt.say || '');
  }

  // start the phone once the page has settled (on a phone, when it's first asked for)
  const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 400));
  const boot = () => idle(() => { D.allow = true; if (dock.dataset.state === 'docked') start(); setState(dockFor()); });
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot, { once: true });
  setState(dockFor());

  /* ==========================================================================
     01 · ROLES — the statement lights word by word as it scrolls past
     ========================================================================== */
  const statement = $('#statement');
  if (statement) {
    const wrapWords = (node, hl) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span'); s.className = 'w' + (hl ? ' hl' : ''); s.textContent = part; frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) { const isHl = n.classList.contains('hl'); if (isHl) n.classList.remove('hl'); wrapWords(n, hl || isHl); }
      });
    };
    wrapWords(statement, false);
    const words = $$('.w', statement);
    let lit = -1;
    const light = () => {
      const r = statement.getBoundingClientRect(), vh = innerHeight;
      const p = reduce() ? 1 : clamp((vh * .82 - r.top) / (r.height + vh * .3), 0, 1);
      const n = Math.round(p * words.length);
      if (n === lit) return; lit = n;
      words.forEach((w, i) => w.classList.toggle('lit', i < n));
    };
    scrollers.push(light); light();
  }
  // the round: four steps lighting in turn while the loop is on screen
  const loopEl = $('#loop');
  if (loopEl) {
    const steps = $$('.step', loopEl); let k = 0, t = 0, on = false;
    const next = () => { if (!on) return; if (!paused() && !reduce()) { steps.forEach((s, i) => s.classList.toggle('on', i === k)); k = (k + 1) % steps.length; } t = setTimeout(next, 1500); };
    onScreen(loopEl, v => { on = v; clearTimeout(t); if (v) next(); });
    if (reduce()) steps.forEach(s => s.classList.add('on'));
  }

  /* ==========================================================================
     03 · DECISIONS — the one in the middle of the screen drives the phone
     ========================================================================== */
  const cards = $$('.dcard');
  let activeCard = null;
  const cardOpt = c => ({ route: c.dataset.route || '/', point: c.dataset.point, dx: +c.dataset.dx || 0, dy: +c.dataset.dy || 0, say: c.dataset.say || '', scroll: c.dataset.scroll, scene: null });
  function activate(c) {
    if (c === activeCard) return;
    activeCard = c;
    cards.forEach(x => x.classList.toggle('on', x === c));
    if (!c || !mqWide.matches || dock.dataset.state !== 'docked') return;
    const o = cardOpt(c);
    // the goal card plays a goal the first time it comes up; after that, the buttons do
    if (c.dataset.moment && !D.moment) { D.moment = true; o.scene = c.dataset.moment; }
    go(o.route, o);
  }
  scrollers.push(() => {
    const sec = $('#decisions'), r = sec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const mid = innerHeight * .5;
    let best = null, bd = Infinity;
    cards.forEach(c => { const b = c.getBoundingClientRect(), d = Math.abs((b.top + b.bottom) / 2 - mid); if (d < bd) { bd = d; best = c; } });
    activate(best);
  });
  // hero and roles: the phone rests on Live, then points at the switch once
  let heroPointed = false;
  scrollers.push(() => {
    if (dock.dataset.state !== 'docked') return;
    const d = $('#decisions').getBoundingClientRect();
    if (d.top > innerHeight * .5 && activeCard) { activeCard = null; cards.forEach(x => x.classList.remove('on')); go('/', {}); }
  });
  $$('[data-show]').forEach(b => b.addEventListener('click', () => {
    const c = b.closest('.dcard'); openDemo(); const o = cardOpt(c); setTimeout(() => go(o.route, o), dock.dataset.state === 'open' ? 350 : 0);
  }));
  const tryEl = $('#try');
  onScreen(tryEl, v => { if (v && mqWide.matches && dock.dataset.state === 'docked') { activeCard = null; go('/', {}); } });
  onScreen($('#top'), v => {
    if (!v || heroPointed) return;
    const tryPoint = () => { if (D.app && dock.dataset.state === 'docked' && !activeCard) { heroPointed = true; setTimeout(() => go('/', { point: 'label:Live', say: 'the real app, running' }), 900); } else if (!heroPointed) setTimeout(tryPoint, 600); };
    tryPoint();
  });

  /* ==========================================================================
     04 · SYSTEM
     ========================================================================== */
  const wght = $('#wght'), wOut = $('#wghtOut'), wSample = $('#wghtSample');
  const W_NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
  wght && wght.addEventListener('input', () => {
    const v = +wght.value; wSample.style.fontWeight = v;
    const near = Math.round(v / 100) * 100; wOut.textContent = v + ' · ' + (Math.abs(v - near) < 15 ? W_NAMES[near] : '');
  });
  // the spectrum cards tick on, a minute at a time, like the live list
  const specs = $$('#specs .spec');
  if (specs.length) {
    let on = false;
    onScreen($('#specs'), v => { on = v; });
    setInterval(() => {
      if (!on || paused() || reduce() || document.hidden) return;
      const s = specs[Math.floor(Math.random() * specs.length)], m = $('.min', s), n = +m.textContent;
      if (n >= 89) return;
      m.textContent = n + 1;
      s.style.setProperty('--p', ((n + 1) / 90).toFixed(3));
      s.style.setProperty('--h', Math.min(100, parseFloat(s.style.getPropertyValue('--h')) + .6).toFixed(1) + '%');
    }, 1600);
  }

  /* glass: the hover light under the cursor, the press dip (the app's values, materials.css) */
  $$('[data-glass]').forEach(g => {
    g.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = g.getBoundingClientRect(); g.style.setProperty('--hx', (e.clientX - r.left) + 'px'); g.style.setProperty('--hy', (e.clientY - r.top) + 'px');
    });
    g.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse' || !mqFine.matches) return; g.classList.add('hov'); g.style.setProperty('--hl', '1'); });
    g.addEventListener('pointerleave', () => { g.classList.remove('hov'); g.style.setProperty('--hl', '0'); });
    if (!g.hasAttribute('data-dip')) return;
    let down = 0;
    g.addEventListener('pointerdown', () => { down = performance.now(); g.classList.add('dip'); });
    const up = () => { if (!down) return; const left = Math.max(0, 120 - (performance.now() - down)); down = 0; setTimeout(() => g.classList.remove('dip'), left); };
    g.addEventListener('pointerup', up); g.addEventListener('pointerleave', up); g.addEventListener('pointercancel', up);
  });

  /* ==========================================================================
     05 · CURVES — each one drawn against the default, with a dot running on it
     ========================================================================== */
  const SPEC3 = ['#6b58f5', '#a58fe6', '#e7c1d6', '#fff0e6'];
  function plot(canvas, v, opts = {}) {
    const r = canvas.getBoundingClientRect(), d = dpr();
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const x = canvas.getContext('2d'); x.clearRect(0, 0, w, h);
    const pad = opts.mini ? 3 * d : Math.round(w * .13);
    const X = t => pad + t * (w - 2 * pad), Y = t => h - pad - t * (h - 2 * pad);
    const prog = opts.draw == null ? 1 : opts.draw;
    if (!opts.mini) {
      x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 1 * d;
      for (let i = 0; i <= 4; i++) { const t = i / 4; x.beginPath(); x.moveTo(X(t), Y(0)); x.lineTo(X(t), Y(1)); x.stroke(); x.beginPath(); x.moveTo(X(0), Y(t)); x.lineTo(X(1), Y(t)); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.moveTo(X(0), Y(0)); x.lineTo(X(1), Y(0)); x.moveTo(X(0), Y(0)); x.lineTo(X(0), Y(1)); x.stroke();
      // the default, dashed and grey
      x.setLineDash([4 * d, 4 * d]); x.strokeStyle = 'rgba(133,132,127,.55)'; x.lineWidth = 1.4 * d;
      x.beginPath(); x.moveTo(X(0), Y(0)); x.bezierCurveTo(X(DEFAULT[0]), Y(DEFAULT[1]), X(DEFAULT[2]), Y(DEFAULT[3]), X(1), Y(1)); x.stroke(); x.setLineDash([]);
      // handles
      x.globalAlpha = prog; x.strokeStyle = 'rgba(243,242,239,.35)'; x.lineWidth = 1 * d;
      x.beginPath(); x.moveTo(X(0), Y(0)); x.lineTo(X(v[0]), Y(v[1])); x.moveTo(X(1), Y(1)); x.lineTo(X(v[2]), Y(v[3])); x.stroke();
      [[v[0], v[1]], [v[2], v[3]]].forEach(([a, b]) => { x.fillStyle = '#000'; x.beginPath(); x.arc(X(a), Y(b), 4.5 * d, 0, 7); x.fill(); x.strokeStyle = '#F3F2EF'; x.lineWidth = 1.5 * d; x.stroke(); });
      x.globalAlpha = 1;
    }
    // the curve, in the accent spectrum, drawn on as far as `prog`
    const g = x.createLinearGradient(X(0), 0, X(1), 0); SPEC3.forEach((c, i) => g.addColorStop(i / 3, c));
    x.strokeStyle = opts.mini ? (opts.on ? '#F3F2EF' : 'rgba(243,242,239,.55)') : g; x.lineWidth = (opts.mini ? 1.6 : 2.6) * d; x.lineCap = 'round';
    const f = bezier(...v), N = 80;
    // trace the parametric curve so the drawing follows the real shape
    const P = t => { const mt = 1 - t; return [X(3 * mt * mt * t * v[0] + 3 * mt * t * t * v[2] + t * t * t), Y(3 * mt * mt * t * v[1] + 3 * mt * t * t * v[3] + t * t * t)]; };
    x.beginPath(); for (let i = 0; i <= N * prog; i++) { const [px, py] = P(i / N); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    if (opts.dot != null && !opts.mini) {
      const t = clamp(opts.dot, 0, 1), y = f(t), yd = bezier(...DEFAULT)(t);
      x.fillStyle = 'rgba(133,132,127,.9)'; x.beginPath(); x.arc(X(t), Y(yd), 3 * d, 0, 7); x.fill();
      x.fillStyle = '#F3F2EF'; x.shadowColor = 'rgba(255,255,255,.6)'; x.shadowBlur = 10 * d; x.beginPath(); x.arc(X(t), Y(y), 5 * d, 0, 7); x.fill(); x.shadowBlur = 0;
      x.strokeStyle = 'rgba(243,242,239,.18)'; x.lineWidth = 1 * d; x.beginPath(); x.moveTo(X(t), Y(0)); x.lineTo(X(t), Y(y)); x.stroke();
    }
  }
  const curveCards = $$('.cv').map(el => ({ el, v: parseV(el.dataset.v), dur: +el.dataset.dur || 700, canvas: $('canvas', el), dot: $('.cv-track i', el), ghost: $('.cv-track u', el), track: $('.cv-track', el), on: false, t0: 0, drawn: 0 }));
  const defaultF = bezier(...DEFAULT);
  function curveFrame(now) {
    let any = false;
    curveCards.forEach(c => {
      if (!c.on) return; any = true;
      if (c.drawn < 1) { c.drawn = reduce() ? 1 : clamp((now - c.d0) / 900, 0, 1); }
      const cyc = c.dur + 900, el = paused() || reduce() ? c.dur : (now - c.t0) % cyc;
      const p = clamp(el / c.dur, 0, 1);
      const travel = c.track.clientWidth - 30;
      c.dot.style.transform = `translateX(${(bezier(...c.v)(p) * travel).toFixed(1)}px)`;
      c.ghost.style.transform = `translateX(${(defaultF(p) * travel).toFixed(1)}px)`;
      plot(c.canvas, c.v, { draw: bezier(.16, 1, .3, 1)(c.drawn), dot: p });
    });
    if (any) requestAnimationFrame(curveFrame); else curveRun = false;
  }
  let curveRun = false;
  curveCards.forEach(c => {
    c.f = bezier(...c.v);
    onScreen(c.el, v => {
      c.on = v;
      if (v) { const now = performance.now(); if (!c.d0) c.d0 = now + 200; c.t0 = now; if (!curveRun) { curveRun = true; requestAnimationFrame(curveFrame); } }
    }, '60px');
    c.el.addEventListener('pointerenter', () => { c.t0 = performance.now(); });
    plot(c.canvas, c.v, { draw: 0 });
  });
  addEventListener('resize', () => curveCards.forEach(c => !c.on && plot(c.canvas, c.v, { draw: c.drawn })));

  /* ==========================================================================
     05 · THE TIMING STAGE — a section's exact numbers, played
     ========================================================================== */
  const rows = $$('.tr[data-k]'), stageBox = $('#stageBox'), stageTl = $('#stageTl'), stageRead = $('#stageRead'), stageName = $('#stageName');
  const slowBtn = $('#stageSlow');
  let slow = false, curRow = null, stageAnims = [], tlRaf = 0;
  rows.forEach(r => plot($('canvas', r), parseV(r.dataset.v), { mini: true }));
  const SP = ['var(--sp2)', 'var(--sp5)', 'var(--sp1)', 'var(--sp3)', 'var(--sp4)'];
  function mk(css, html2) { const d = document.createElement('div'); d.className = 'item'; d.style.cssText = css; if (html2) d.innerHTML = html2; stageBox.appendChild(d); return d; }
  function playRow(r) {
    curRow = r; rows.forEach(x => { x.classList.toggle('on', x === r); x.setAttribute('aria-selected', String(x === r)); plot($('canvas', x), parseV(x.dataset.v), { mini: true, on: x === r }); });
    stageAnims.forEach(a => a.cancel()); stageAnims = []; stageBox.innerHTML = ''; cancelAnimationFrame(tlRaf);
    const k = slow ? 4 : 1, dur = +r.dataset.dur * k, delay = +r.dataset.delay * k, stag = +r.dataset.stagger * k, v = parseV(r.dataset.v), ease = cb(v), L = r.dataset.l, n = +r.dataset.n;
    stageName.textContent = $('.nm', r).firstChild.textContent;
    const W = stageBox.clientWidth - 36, H = stageBox.clientHeight - 36;
    const segs = [];                                  // [start, length] per item for the timeline
    const anim = (el, kf, d0, len = dur, e = ease) => { const a = el.animate(kf, { duration: Math.max(1, len), delay: d0, easing: e, fill: 'both' }); stageAnims.push(a); segs.push([d0, len]); return a; };
    if (L === 'bars' || L === 'fade') {
      const bw = (W - 4 * 8) / 5;
      for (let i = 0; i < 5; i++) {
        const hh = H * [0.62, .7, .86, .54, .76][i];
        const el = mk(`left:${18 + i * (bw + 8)}px;bottom:18px;width:${bw}px;height:${hh}px;background:linear-gradient(180deg,${SP[i]});border-radius:14px`);
        if (L === 'bars') anim(el, [{ transform: `translateY(${H + 40}px)` }, { transform: 'translateY(0)' }], delay + i * stag);
        else anim(el, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(28px)', opacity: 0 }], delay + i * stag);
      }
    } else if (L === 'rows' || L === 'drop') {
      for (let i = 0; i < n; i++) {
        const el = mk(`left:18px;right:18px;top:${18 + i * (H / n)}px;height:${H / n - 8}px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);display:flex;align-items:center;gap:10px;padding:0 12px`,
          `<i style="width:10px;height:10px;border-radius:50%;background:${i % 3 ? '#43423F' : '#34E39A'}"></i><i style="height:6px;width:${40 + (i * 37) % 50}%;border-radius:3px;background:rgba(243,242,239,.4)"></i>`);
        const from = L === 'rows' ? 'translate(18px,6px)' : 'translate(0,-12px)';
        anim(el, [{ transform: from, opacity: 0 }, { transform: 'translate(0,0)', opacity: 1 }], delay + Math.min(i, L === 'rows' ? 24 : 12) * stag);
      }
    } else if (L === 'blocks') {
      const bl = [[0, 30, .5], [1, 70, 1], [1, 70, 1], [3, 34, 1], [4, 90, 1]]; let y = 18;
      bl.forEach(([idx, hh, wf], i) => { const el = mk(`left:18px;width:${W * wf}px;top:${y}px;height:${hh * H / 300}px;background:rgba(255,255,255,${i === 3 ? .1 : .06})`); y += hh * H / 300 + 8; anim(el, [{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }], delay + idx * stag); });
    } else if (L === 'tabs') {
      const tw = W / 4;
      ['Facts', 'Stats', 'Lineup', 'Table'].forEach((t, i) => mk(`left:${18 + i * tw}px;top:18px;width:${tw}px;height:34px;display:grid;place-items:center;font:600 10.5px/1 var(--app);letter-spacing:.16em;text-transform:uppercase;color:${i === 1 ? '#F3F2EF' : '#43423F'}`, t));
      const ind = mk(`left:${18 + tw * .2}px;top:52px;width:${tw * .6}px;height:2px;border-radius:2px;background:var(--accent)`);
      anim(ind, [{ transform: 'translateX(0)' }, { transform: `translateX(${tw}px)` }], delay);
      const pane = mk(`left:18px;right:18px;top:72px;bottom:18px;background:rgba(255,255,255,.05)`, '');
      anim(pane, [{ transform: 'translateX(24px)' }, { transform: 'none' }], delay + stag);
    } else if (L === 'wave') {
      const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push(`${(t * W).toFixed(1)},${(H / 2 - Math.sin(t * 9) * Math.sin(t * 3.1 + 1) * H * .32).toFixed(1)}`); }
      const el = mk(`left:18px;top:18px;width:${W}px;height:${H}px`, `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="rgba(255,255,255,.12)"/><polyline points="${pts.join(' ')}" fill="none" stroke="#6aaef0" stroke-width="2"/></svg>`);
      anim(el, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], delay);
      [.28, .62].forEach((t, i) => { const b = mk(`left:${18 + t * W - 9}px;top:${18 + H * .12}px;width:18px;height:18px;border-radius:50%;background:#F3F2EF`); anim(b, [{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], delay + (i + 1) * stag); });
    } else if (L === 'split') {
      for (let i = 0; i < n; i++) {
        const share = [.58, .63, .44, .7, .38, .55][i], y = 18 + i * (H / n);
        const track = mk(`left:18px;right:18px;top:${y + H / n / 2 - 3}px;height:6px;border-radius:3px;background:#8DB0FF;overflow:hidden`, '<u style="position:absolute;left:0;top:0;bottom:0;width:100%;background:#1E5AD6;transform-origin:0 50%;text-decoration:none"></u>');
        anim($('u', track), [{ transform: 'scaleX(.5)' }, { transform: `scaleX(${share})` }], delay + i * stag);
      }
    } else if (L === 'lines') {
      const lines = [1, 3, 2, 4, 1]; let idx = 0;
      lines.forEach((cnt, li) => { for (let j = 0; j < cnt; j++) { const x0 = 18 + (W / (cnt + 1)) * (j + 1) - 14, y0 = 18 + li * (H / 5) + 6; const el = mk(`left:${x0}px;top:${y0}px;width:28px;height:28px;border-radius:50%;background:linear-gradient(180deg,${SP[li % 5]})`); anim(el, [{ transform: 'translateY(26px)', opacity: 0 }, { transform: 'none', opacity: 1 }], delay + (li + j * .25) * stag); idx++; } });
    } else if (L === 'zoom') {
      const bust = mk(`left:${18 + W / 2 - 60}px;top:22px;width:120px;height:140px;border-radius:60px 60px 18px 18px;background:linear-gradient(180deg,#a8c3ea,#6aaef0 70%,#1E3A6E)`);
      anim(bust, [{ transform: 'scale(.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 0);
      for (let i = 0; i < 3; i++) { const el = mk(`left:18px;right:18px;top:${180 + i * 34}px;height:26px;background:rgba(255,255,255,.06)`); anim(el, [{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], delay + i * stag); }
    } else if (L === 'toast') {
      const t = mk(`left:18px;right:18px;top:24px;height:62px;border-radius:16px;background:rgba(18,18,18,.96);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)`);
      anim(t, [{ transform: 'translateY(-120px)' }, { transform: 'none' }], 0);
      const ph = mk(`left:34px;top:34px;width:42px;height:42px;border-radius:50%;background:linear-gradient(180deg,#0055a4,#ef4135)`); anim(ph, [{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], delay);
      const nm = mk(`left:90px;top:44px;font:600 15px/1 var(--app);color:#F3F2EF`, 'Mbappé · 58’'); anim(nm, [{ transform: 'translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], delay + stag);
    } else if (L === 'word') {
      const letters = 'GOAAAL'.split(''), fs = Math.min(64, W / 5.2), lw = fs * .72, x0 = 18 + (W - lw * 6) / 2;
      const LAND = cb([.12, 1, .3, 1]);
      letters.forEach((ch, i) => { const el = mk(`left:${x0 + i * lw}px;top:${18 + H * .2}px;font:700 ${fs}px/1 var(--app);color:#F3F2EF;letter-spacing:-.02em`, ch); anim(el, [{ transform: 'scale(1.85)', opacity: 0, filter: 'blur(7px)' }, { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }], delay + i * dur * .1, dur * .72, LAND); });
      const up = delay + 5 * dur * .1 + dur * .72 + 1.2 * dur;
      const pl = mk(`left:${18 + W / 2 - 50}px;top:${18 + H * .52}px;width:100px;height:${H * .3}px;border-radius:50px 50px 10px 10px;background:linear-gradient(180deg,#0055a4,#ef4135)`); anim(pl, [{ transform: 'translateY(60px)', opacity: 0 }, { transform: 'none', opacity: 1 }], up);
      const cm = mk(`left:18px;right:18px;bottom:18px;height:10px;border-radius:5px;background:rgba(243,242,239,.4)`); anim(cm, [{ transform: 'translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], up + stag);
    } else if (L === 'tiles') {
      const tw = (W - 3 * 8) / 4;
      for (let i = 0; i < 4; i++) { const el = mk(`left:${18 + i * (tw + 8)}px;top:${18 + H * .35}px;width:${tw}px;height:${H * .3}px;background:rgba(255,255,255,.06);display:grid;place-items:center;font:500 22px/1 var(--app);color:#F3F2EF`, ['7.7', '34', '17/21', '2'][i]); anim(el, [{ opacity: .35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], delay + i * stag); }
    }
    // the timeline: every item's own span, to scale, with a playhead
    const total = Math.max(...segs.map(([a, l]) => a + l)) || 1;
    const lanes = segs.slice(0, 8);
    stageTl.style.height = (lanes.length * 9 + 8) + 'px';
    stageTl.innerHTML = lanes.map(([a, l], i) => `<span class="row" style="top:${i * 9}px"></span><span class="seg" style="top:${i * 9}px;left:${a / total * 100}%;width:${l / total * 100}%"></span>`).join('') + '<span class="ph"></span>';
    const ph = $('.ph', stageTl), t0 = performance.now();
    const tick = now => { const p = clamp((now - t0) / total, 0, 1); ph.style.left = (p * 100) + '%'; if (p < 1) tlRaf = requestAnimationFrame(tick); };
    tlRaf = requestAnimationFrame(tick);
    stageRead.innerHTML = [`dur ${r.dataset.dur} ms`, `delay ${r.dataset.delay} ms`, `stagger ${r.dataset.stagger} ms`, `cubic-bezier(${fmtV(v)})`, `whole section ${Math.round(total / k).toLocaleString('en-US')} ms`].map(t => `<span class="tag">${t}</span>`).join('');
    if (reduce()) stageAnims.forEach(a => a.finish());
  }
  rows.forEach(r => r.addEventListener('click', () => playRow(r)));
  $('#stagePlay').addEventListener('click', () => curRow && playRow(curRow));
  slowBtn.addEventListener('click', () => { slow = !slow; slowBtn.setAttribute('aria-pressed', String(slow)); curRow && playRow(curRow); });
  let stagePlayed = false;
  onScreen($('#stage'), v => { if (v && !stagePlayed) { stagePlayed = true; playRow(rows[0]); } });
  addEventListener('resize', () => { if (curRow) { stageAnims.forEach(a => a.finish()); } });

  /* ==========================================================================
     05 · TOUCH — the day tabs: letters roll on a press, the line follows
     ========================================================================== */
  const daytabs = $('#daytabs');
  if (daytabs) {
    const tabs = $$('button', daytabs), ul = $('.ul', daytabs);
    tabs.forEach(b => {
      const txt = b.textContent; b.textContent = ''; b.setAttribute('aria-label', txt);
      const wrap = document.createElement('span'); wrap.className = 'rolltxt'; wrap.setAttribute('aria-hidden', 'true');
      [...txt].forEach(ch => { const c = document.createElement('span'); c.className = 'ch'; c.innerHTML = `<span style="display:block;line-height:1.15em">${ch === ' ' ? '&nbsp;' : ch}</span><span style="display:block;line-height:1.15em">${ch === ' ' ? '&nbsp;' : ch}</span>`; c.style.cssText = 'height:1.15em;overflow:hidden;vertical-align:top'; wrap.appendChild(c); });
      b.appendChild(wrap);
    });
    const place = (b, instant) => { ul.style.transition = instant ? 'none' : ''; ul.style.left = (b.offsetLeft + 13) + 'px'; ul.style.width = (b.offsetWidth - 26) + 'px'; };
    const onTab = () => tabs.find(b => b.classList.contains('on'));
    requestAnimationFrame(() => place(onTab(), true));
    addEventListener('resize', () => place(onTab(), true));
    tabs.forEach(b => b.addEventListener('click', () => {
      if (b.classList.contains('on')) return;           // SL-11: the chosen tab doesn't roll again
      tabs.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      place(b);
      if (reduce()) return;
      $$('.ch', b).forEach((c, i) => {
        const inner = c.children;
        [...inner].forEach(s => s.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-1.15em)' }], { duration: 420, delay: i * 11, easing: EASE.roll }));
      });
    }));
  }

  /* ==========================================================================
     05 · RACE — mine against the browser's default
     ========================================================================== */
  const race = $('#race');
  if (race) {
    const def = $('.lane.def .ln-t i', race), mine = $('#raceMine .ln-t i', race), set = $$('#raceSet button', race), slowR = $('#raceSlow');
    let v = parseV(set[0].dataset.v), slowRace = false, raced = false;
    const run = () => {
      const travel = $('.ln-t', race).clientWidth - 34, d = (slowRace ? 4 : 1) * 1000;
      [[def, cb(DEFAULT)], [mine, cb(v)]].forEach(([el, e]) => el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${travel}px)` }], { duration: reduce() ? 1 : d, easing: e, fill: 'both' }));
    };
    set.forEach(b => b.addEventListener('click', () => {
      set.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      v = parseV(b.dataset.v); $('#raceName').firstChild.textContent = b.textContent; $('#raceVal').textContent = fmtV(v); run();
    }));
    slowR.addEventListener('click', () => { slowRace = !slowRace; slowR.setAttribute('aria-pressed', String(slowRace)); run(); });
    $('#raceGo').addEventListener('click', run);
    onScreen(race, vv => { if (vv && !raced) { raced = true; setTimeout(run, 400); } });
  }

  /* ==========================================================================
     06 · RIVE — the two files, live, on the portfolio's shared runtime
     ========================================================================== */
  let riveP = null;
  const riveRuntime = () => riveP || (riveP = new Promise((ok, bad) => {
    // (the page has a #rive section, so window.rive is that element until the runtime replaces it)
    if (window.rive && window.rive.Rive) return ok(window.rive);
    const s = document.createElement('script'); s.src = '../rive/vendor/rive.js'; s.async = true;
    s.onload = () => {
      if (!window.rive || !window.rive.Rive) return bad(new Error('no runtime'));
      rive.RuntimeLoader.setWasmUrl('../rive/vendor/rive.wasm');
      rive.RuntimeLoader.setWasmFallbackUrl('../rive/vendor/rive_fallback.wasm');
      ok(window.rive);
    };
    s.onerror = () => bad(new Error('runtime failed'));
    document.head.appendChild(s);
  }));
  const hasGL2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (_) { return false; } })();
  const sizeCanvas = (c, r) => { const b = c.getBoundingClientRect(), d = dpr(); c.width = Math.max(1, Math.round(b.width * d)); c.height = Math.max(1, Math.round(b.height * d)); r && r.resizeDrawingSurfaceToCanvas(); };
  const argb = hex => (0xff000000 | parseInt(hex.slice(1), 16)) >>> 0;

  /* the Live switch: islive and count, the measured capsule beside it */
  const LIVE_OPENING = [[0, 0], [17, -0.0263], [33, -0.0373], [83, -0.0537], [133, -0.0603], [183, -0.0614], [200, -0.049], [217, -0.0208], [233, 0.0293], [267, 0.2168], [283, 0.3575], [317, 0.6738], [333, 0.806], [350, 0.9079], [367, 0.9803], [383, 1.0307], [400, 1.0604], [417, 1.0757], [433, 1.0789], [450, 1.0757], [483, 1.0636], [567, 1.0175], [600, 1.0055], [633, 1]];
  const LIVE_CLOSING = [[0, 1], [50, 1.0077], [183, 1.0735], [217, 1.0789], [233, 1.0746], [250, 1.0636], [267, 1.0428], [283, 1.0132], [300, 0.9715], [333, 0.8454], [367, 0.6522], [400, 0.4134], [433, 0.1996], [467, 0.0538], [500, -0.0263], [517, -0.0471], [533, -0.0592], [583, -0.0592], [633, -0.0449], [717, -0.011], [783, 0]];
  const trackC = $('#rTrack'), trackLbl = $('#rTrackLbl');
  let trackLive = true, trackT0 = 0, trackRaf = 0;
  function drawTrack(p) {
    const c = trackC; if (!c) return;
    const b = c.getBoundingClientRect(), d = dpr(); const w = Math.round(b.width * d), h = Math.round(b.height * d);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d'); x.clearRect(0, 0, w, h);
    const tr = trackLive ? LIVE_OPENING : LIVE_CLOSING, T = tr[tr.length - 1][0], pad = 14 * d, lo = -0.15, hi = 1.15;
    const X = ms => pad + ms / 800 * (w - 2 * pad), Y = v => h - pad - (v - lo) / (hi - lo) * (h - 2 * pad);
    x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = d;
    [0, 1].forEach(v => { x.beginPath(); x.moveTo(X(0), Y(v)); x.lineTo(X(800), Y(v)); x.stroke(); });
    x.fillStyle = 'rgba(133,132,127,.9)'; x.font = `${10 * d}px "JB Mono", monospace`;
    x.fillText('on', X(800) - 16 * d, Y(1) - 5 * d); x.fillText('off', X(800) - 20 * d, Y(0) - 5 * d);
    const g = x.createLinearGradient(X(0), 0, X(T), 0); ['#34E39A', '#a8c3ea', '#e7c1d6'].forEach((s, i) => g.addColorStop(i / 2, s));
    x.strokeStyle = g; x.lineWidth = 2.4 * d; x.lineJoin = 'round'; x.beginPath();
    tr.forEach(([ms, v], i) => (i ? x.lineTo(X(ms), Y(v)) : x.moveTo(X(ms), Y(v)))); x.stroke();
    const peak = tr.reduce((a, b2) => (trackLive ? (b2[1] > a[1] ? b2 : a) : (b2[1] < a[1] ? b2 : a)));
    x.fillStyle = '#F3F2EF'; x.beginPath(); x.arc(X(peak[0]), Y(peak[1]), 3 * d, 0, 7); x.fill();
    x.fillText((peak[1] * 100).toFixed(1) + '%', X(peak[0]) + 6 * d, Y(peak[1]) + (trackLive ? -6 : 14) * d);
    if (p != null) {
      const ms = p * T; let v = tr[0][1];
      for (let i = 1; i < tr.length; i++) if (tr[i][0] >= ms) { const [a, va] = tr[i - 1], [b2, vb] = tr[i]; v = lerp(va, vb, (ms - a) / (b2 - a)); break; }
      x.strokeStyle = 'rgba(243,242,239,.3)'; x.lineWidth = d; x.beginPath(); x.moveTo(X(ms), pad); x.lineTo(X(ms), h - pad); x.stroke();
      x.fillStyle = '#34E39A'; x.shadowColor = 'rgba(52,227,154,.7)'; x.shadowBlur = 10 * d; x.beginPath(); x.arc(X(ms), Y(v), 5 * d, 0, 7); x.fill(); x.shadowBlur = 0;
    }
  }
  function runTrack() {
    cancelAnimationFrame(trackRaf); trackLbl.textContent = trackLive ? 'opening · 633 ms' : 'closing · 783 ms';
    const T = trackLive ? 633 : 783; trackT0 = performance.now();
    const tick = now => { const p = clamp((now - trackT0) / T, 0, 1); drawTrack(p); if (p < 1) trackRaf = requestAnimationFrame(tick); };
    trackRaf = requestAnimationFrame(tick);
  }
  drawTrack(null); addEventListener('resize', () => drawTrack(null));

  const RL = { r: null, vm: null, live: true, count: 5, visible: false };
  const liveToggle = $('#rLiveToggle'), countOut = $('#rCount'), liveState = $('#rLiveState');
  function liveWrite() {
    liveToggle.setAttribute('aria-pressed', String(RL.live)); liveToggle.lastChild.textContent = RL.live ? 'Live on' : 'Live off';
    countOut.textContent = RL.count + ' live'; liveState.textContent = `islive = ${RL.live} · count = "${RL.count}"`;
    if (!RL.vm) return;
    try { RL.vm.boolean('islive').value = RL.live; RL.vm.string('count').value = String(RL.count); } catch (_) {}
  }
  liveToggle.addEventListener('click', () => { RL.live = !RL.live; liveWrite(); trackLive = RL.live; runTrack(); });
  $('#rCountUp').addEventListener('click', () => { RL.count = Math.min(99, RL.count + 1); liveWrite(); });
  $('#rCountDown').addEventListener('click', () => { RL.count = Math.max(0, RL.count - 1); liveWrite(); });

  /* moments: kind, the team's two colours, play; phase comes back */
  const RW = { r: null, vm: null, colors: ['#0055a4', '#ef4135'], kind: 'goal', visible: false, t0: 0, raf: 0, played: false };
  const wordState = $('#rWordState'), phaseEl = $('#rPhase');
  const marks = $$('.mk', phaseEl);
  const phaseNote = $('#rPhaseNote');
  function setMarks(kind) {
    const T = kind === 'goal' ? 1.6772 : 1.12;
    const spec = kind === 'goal' ? [[0, 'play<br>0 s'], [0.854, 'last letter lands<br>0.854 s · phase 1'], [1.6772, 'flare and glint done<br>1.677 s · phase 2']]
      : [[0, 'play<br>0 s'], [1.12, 'last letter lands<br>1.12 s · phases 1 and 2'], null];
    marks.forEach((m, i) => {
      const s = spec[i]; m.hidden = !s; m.classList.remove('hit'); if (!s) return;
      m.dataset.at = s[0]; m.style.left = (s[0] / T * 100) + '%'; $('span', m).innerHTML = s[1];
    });
    phaseNote.textContent = kind === 'goal' ? 'Six letters, 70 ms apart, each landing in 504 ms on Land.' : 'Eight letters, 60 ms apart, each slamming in from 1.4× in 700 ms. No flare, no glint.';
    phaseEl.style.setProperty('--p', 0);
    return T;
  }
  function playWord(kind) {
    RW.kind = kind;
    const T = setMarks(kind);
    if (!RW.vm) { RW.pending = kind; wordState.textContent = 'Rive is starting…'; return; }
    try {
      RW.vm.string('kind').value = kind;
      RW.vm.color('color1').value = argb(RW.colors[0]); RW.vm.color('color2').value = argb(RW.colors[1]);
      RW.vm.number('phase').value = 0;
      RW.vm.trigger('play').trigger();
    } catch (_) { return; }
    RW.played = true; cancelAnimationFrame(RW.raf); RW.t0 = performance.now();
    const tick = now => {
      const s = (now - RW.t0) / 1000, p = clamp(s / T, 0, 1);
      phaseEl.style.setProperty('--p', p.toFixed(4));
      marks.forEach(m => m.classList.toggle('hit', !m.hidden && s >= +m.dataset.at));
      if (p < 1) RW.raf = requestAnimationFrame(tick);
    };
    RW.raf = requestAnimationFrame(tick);
  }
  $('#rGoal').addEventListener('click', () => playWord('goal'));
  $('#rRed').addEventListener('click', () => playWord('red'));
  $$('#rTeams button').forEach(b => b.addEventListener('click', () => {
    $$('#rTeams button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    RW.colors = b.dataset.c.split(','); playWord('goal');
  }));

  function mountRive() {
    if (!hasGL2) { $('#rLiveStage').classList.add('failed'); $('#rWordStage').classList.add('failed'); return; }
    riveRuntime().then(rv => {
      const lc = $('#rLiveCanvas'), wc = $('#rWordCanvas');
      sizeCanvas(lc); sizeCanvas(wc);
      RL.r = new rv.Rive({
        src: APP + 'rive/live-icon.riv', canvas: lc, artboard: 'aniamtion', stateMachine: 'State Machine 1', autoplay: true, autoBind: true,
        layout: new rv.Layout({ fit: rv.Fit.Contain, alignment: rv.Alignment.Center }), shouldDisableRiveListeners: true,
        onLoad: () => { RL.vm = RL.r.viewModelInstance; RL.r.resizeDrawingSurfaceToCanvas(); liveWrite(); if (!RL.visible) RL.r.pause(); },
        onLoadError: () => $('#rLiveStage').classList.add('failed'),
      });
      RW.r = new rv.Rive({
        src: APP + 'rive/moments.riv', canvas: wc, stateMachine: 'State Machine 1', autoplay: true, autoBind: true,
        layout: new rv.Layout({ fit: rv.Fit.Contain, alignment: rv.Alignment.Center }), shouldDisableRiveListeners: true,
        onLoad: () => {
          RW.vm = RW.r.viewModelInstance; RW.r.resizeDrawingSurfaceToCanvas();
          try { const ph = RW.vm.number('phase'); ph.on(() => { wordState.textContent = 'phase ' + ph.value; }); } catch (_) {}
          if (RW.pending || RW.visible) setTimeout(() => playWord(RW.pending || 'goal'), 400);
        },
        onLoadError: () => $('#rWordStage').classList.add('failed'),
      });
      addEventListener('resize', () => { sizeCanvas(lc, RL.r); sizeCanvas(wc, RW.r); });
    }, () => { $('#rLiveStage').classList.add('failed'); $('#rWordStage').classList.add('failed'); });
  }
  let riveAsked = false;
  onScreen($('#rive'), v => { if (v && !riveAsked) { riveAsked = true; mountRive(); } }, '600px');
  onScreen($('#rLiveStage'), v => { RL.visible = v; if (!RL.r) return; if (v) { RL.r.play(); runTrack(); } else RL.r.pause(); });
  onScreen($('#rWordStage'), v => { RW.visible = v; if (!RW.r) return; if (v) { RW.r.play(); if (!RW.played && RW.vm) playWord('goal'); } else RW.r.pause(); });
  document.addEventListener('visibilitychange', () => {
    [[RL, document.hidden], [RW, document.hidden]].forEach(([o, h]) => { if (!o.r) return; if (h) o.r.pause(); else if (o.visible) o.r.play(); });
  });

  /* ==========================================================================
     07 · PROCESS — vertical scroll walks the cards sideways
     ========================================================================== */
  const hz = $('#hz'), hzTrack = $('#hzTrack'), hzN = $('#hzN'), hzBar = $('.hz-bar u');
  if (hz && hzTrack) {
    const cardsH = $$('.hz-card', hzTrack);
    const size = () => {
      const over = Math.max(0, hzTrack.scrollWidth - innerWidth + 64);
      hz.style.setProperty('--hz-h', `calc(100vh + ${over}px)`);
      return over;
    };
    let over = size();
    addEventListener('resize', () => { over = size(); });
    scrollers.push(() => {
      const r = hz.getBoundingClientRect(), top = nav.offsetHeight;
      const p = over ? clamp((top - r.top) / over, 0, 1) : 0;
      hzTrack.style.transform = `translate3d(${(-p * over).toFixed(1)}px,0,0)`;
      hzBar.style.setProperty('--hp', p.toFixed(4));
      const k = Math.min(cardsH.length, 1 + Math.floor(p * cardsH.length * .999));
      hzN.textContent = String(k).padStart(2, '0');
    });
  }

  /* ==========================================================================
     08 · THE TERMINAL — its lines arrive one by one
     ========================================================================== */
  const term = $('#term');
  if (term) onScreen(term, v => {
    if (!v || term.dataset.done) return; term.dataset.done = '1';
    $$('.term-body .ln', term).forEach((l, i) => setTimeout(() => l.classList.add('on'), reduce() ? 0 : 120 + i * 110));
  });

  /* ---------- first paint ---------- */
  onScroll();
  setTimeout(() => $('.h1').classList.add('in'), 60);
})();
