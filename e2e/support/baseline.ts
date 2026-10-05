import type { Page } from '@playwright/test';

/*
 * Issue #10: where the Lua puts text. Its txt() takes a baseline; bc(cy, size) = cy + 0.3485 × size
 * is the baseline of text centred on cy (luau:1630). These helpers read the baseline the browser
 * actually drew, so a port can be checked against the Lua's numbers whatever CSS convention placed it.
 *
 * Measuring: a zero-size inline-block inserted before the text sits on the baseline. Inside a flex or
 * grid container that marker would be an item of its own, so there the text's box top plus the
 * ascent is used instead (Hanken Grotesk: ascent 1000, descent 303; Chromium rounds both to whole
 * pixels, which is why a line box shorter than 1.303 em can sit up to 1 px higher than the
 * arithmetic says: 15 px text in a 19.6 px line has its baseline at 14, not 15.03).
 */

export const bc = (cy: number, size: number) => cy + 0.3485 * size;

/**
 * Baseline offsets from `origin`'s top (`origin` defaults to the row) minus what the Lua says, per row.
 * A check is [selector, baseline] or [selector, cy, 'bc']: centred on cy at the element's own size, for
 * text the Lua shrinks to fit (fit(), then bc(cy, fitted size)).
 */
export async function baselines(page: Page, rowSel: string, checks: ReadonlyArray<readonly [selector: string, want: number, mode?: 'bc']>, opts: { origin?: string; rows?: number } = {}) {
  return page.evaluate(
    ({ rowSel, checks, origin, rows }) => {
      const sizeOf = (el: Element) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent!.trim() ? 1 : 3) });
        const tn = walker.nextNode();
        return tn ? parseFloat(getComputedStyle(tn.parentElement!).fontSize) : 0;
      };
      const base = (el: Element) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent!.trim() ? 1 : 3) });
        const tn = walker.nextNode() as Text | null;
        if (!tn) return null;
        const parent = tn.parentElement!;
        if (/flex|grid/.test(getComputedStyle(parent).display)) {
          const r = document.createRange();
          r.selectNodeContents(tn);
          return r.getBoundingClientRect().top + Math.round(parseFloat(getComputedStyle(parent).fontSize));
        }
        const mark = document.createElement('i');
        mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
        parent.insertBefore(mark, tn);
        const y = mark.getBoundingClientRect().top;
        mark.remove();
        return y;
      };
      return [...document.querySelectorAll(rowSel)].slice(0, rows).map((row) => {
        const top = (origin ? row.querySelector(origin)! : row).getBoundingClientRect().top;
        return Object.fromEntries(
          checks.map(([sel, want, mode]) => {
            const el = row.querySelector(sel);
            const y = el ? base(el) : null;
            const at = mode === 'bc' && el ? want + 0.3485 * sizeOf(el) : want;
            return [sel, y === null ? null : +(y - top - at).toFixed(2)];
          }),
        );
      });
    },
    { rowSel, checks, origin: opts.origin, rows: opts.rows ?? 3 },
  );
}

/** Every measured offset, flattened, for one tolerance check; a check that found nothing is reported, not skipped. */
export const offsets = (rows: Array<Record<string, number | null>>) => rows.flatMap((r) => Object.entries(r));
