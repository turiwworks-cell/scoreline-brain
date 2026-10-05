import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * index.html carries the first frame (the list header and day tabs, drawn before any script runs).
 * Its sheet is inline and cannot import the tokens, so these tests hold what it copies to the source
 * of truth, and hold the frame to what must be true of something that is only a picture. Whether its
 * boxes are the React header's is e2e/handoff.spec.ts.
 */

const read = (...path: string[]) => readFileSync(join(__dirname, ...path), 'utf8');
const html = read('..', '..', 'index.html');
const tokens = read('..', 'styles', 'tokens.css');
const list = read('..', 'features', 'matchList', 'MatchList.tsx');

const sheet = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
const root = new DOMParser().parseFromString(html, 'text/html').getElementById('root')!;
const frame = root.querySelector<HTMLElement>('[data-static-frame]')!;

/** `--name: value` pairs of a rule body, with the whitespace and the comments of the stylesheet normalised away. */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, name, value] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) out.set(name!, value!.trim().replace(/\s+/g, ' '));
  return out;
}

describe('the inline sheet’s copies of the design tokens', () => {
  const copied = declarations(/:root\{([^}]*)\}/.exec(sheet)?.[1] ?? '');
  const source = declarations(/:root\s*\{([\s\S]*?)\n\}/.exec(tokens)?.[1] ?? '');

  it('copies some, so the check below is not vacuous', () => {
    expect(copied.size).toBeGreaterThan(8);
  });

  it.each([...copied])('%s is the token’s value', (name, value) => {
    expect(source.get(name), `${name} is not a token`).toBeDefined();
    // the tokens write 0.1 and the stylesheet may write the same colour with the same notation; compare as written
    expect(value).toBe(source.get(name));
  });
});

describe('the first frame', () => {
  it('is inside #root, which React replaces when it first commits', () => {
    expect(root.children.length).toBe(1);
    expect(frame).not.toBeNull();
  });

  it('is only a picture: hidden from assistive technology, with nothing that can take focus or be pressed', () => {
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(frame.querySelectorAll('a, button, input, select, textarea, summary, [tabindex], [role], [contenteditable]').length).toBe(0);
  });

  it('has the wordmark as its one heading, as the list header does', () => {
    const headings = frame.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBe(1);
    expect(headings[0]!.tagName).toBe('H1');
    expect(headings[0]!.textContent).toBe('scoreline');
  });

  it('shows the day tabs the list shows before it has a feed', () => {
    const fallback = /const FALLBACK_DAYS = \[([^\]]*)\]/.exec(list)?.[1] ?? '';
    const days = [...fallback.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(days.length).toBe(5);
    expect([...frame.querySelectorAll('.sf-tab')].map((t) => t.textContent)).toEqual(days);
    // Today is the chosen one, in the middle
    expect(frame.querySelector('.sf-on')!.textContent).toBe('Today');
  });

  it('loads nothing: no image, no script, no request of its own', () => {
    expect(frame.querySelectorAll('img, picture, video, iframe, script, link, [src], [href], [style*="url("]').length).toBe(0);
    expect(sheet).not.toMatch(/url\(|@import|@font-face/);
  });

  it('is small: the sheet and the markup together stay under 8 KB', () => {
    expect(sheet.length + frame.outerHTML.length).toBeLessThan(8 * 1024);
  });

  it('keeps the font preload and does not touch the font strategy', () => {
    expect(html).toMatch(/<link rel="preload" href="\/fonts\/hanken-grotesk-latin-wght-normal\.woff2" as="font" type="font\/woff2" crossorigin \/>/);
    expect(sheet).not.toMatch(/font-display/);
  });
});
