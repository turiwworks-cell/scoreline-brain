import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { feel } from './feel';
import { RollLabel } from './RollLabel';
import styles from './Tabs.module.css';

/*
 * Tabs with a sliding indicator. Three looks from the Lua, one structure:
 *   line     equal tabs, uppercase labels that roll on click, a 48.5 px spectrum bar
 *            centred under the chosen one (match tabs, luau:5791-5804, motion: tabs)
 *   day      tabs as wide as their words (+13 px each side), the bar as wide as the
 *            word (day tabs, luau:4656-4687, 3705-3727, motion: list)
 *   segment  a glass track whose chosen segment is a spectrum thumb, labels that
 *            roll on click (the desktop pane switch, luau:6798-6825, motion: tabs)
 *
 * The indicator is placed by writing a transform straight to its element, so the
 * slide is a CSS transition on transform only. Nothing about placement is React state.
 */
export type TabItem = { id: string; label: string };

export type TabsProps = {
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'line' | 'day' | 'segment';
  'aria-label': string;
  /** prefix for tab and panel ids: tab `${idBase}-tab-${id}`, panel `${idBase}-panel-${id}` */
  idBase?: string;
  className?: string;
};

// the bar under the chosen line tab (luau:5804)
const LINE_BAR = 48.5;
// side padding of a day tab: the bar spans the word only (luau:3709, 3724)
const DAY_PAD = 13;
// base width the indicator is drawn at before scaleX; keeps the gradient smooth
const BAR_BASE = 100;

export function Tabs({ items, value, onChange, variant = 'line', idBase, className, ...aria }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);

  // widths can change without the list resizing (the font swaps in, a label changes), so
  // the indicator is re-placed on any change to a tab as well as to the list
  const itemsKey = items.map((t) => `${t.id}:${t.label}`).join('|');
  useLayoutEffect(() => {
    const list = listRef.current;
    const ind = indRef.current;
    if (!list || !ind) return;
    const place = () => {
      const tab = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!tab) return;
      let x = tab.offsetLeft;
      let w = tab.offsetWidth;
      if (variant === 'line') {
        x += (w - LINE_BAR) / 2;
        w = LINE_BAR;
      } else if (variant === 'day') {
        x += DAY_PAD;
        w -= DAY_PAD * 2;
      }
      ind.style.transform =
        variant === 'segment' ? `translateX(${x}px)` : `translateX(${x}px) scaleX(${w / BAR_BASE})`;
      if (variant === 'segment') ind.style.width = `${w}px`;
    };
    place();
    // first placement doesn't slide; later ones do
    const raf = requestAnimationFrame(() => ind.setAttribute('data-ready', ''));
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (ro) {
      ro.observe(list);
      list.querySelectorAll('[role="tab"]').forEach((t) => ro.observe(t));
    }
    // the face may load after first layout; measure again once it has
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    let live = true;
    void fonts?.ready.then(() => live && place());
    fonts?.addEventListener?.('loadingdone', place);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      fonts?.removeEventListener?.('loadingdone', place);
    };
    // items is read through itemsKey so an inline array doesn't re-run this every render
  }, [value, variant, itemsKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    const item = items[next];
    if (!item) return;
    e.preventDefault();
    onChange(item.id);
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []).find((el) => el.dataset.tab === item.id)?.focus();
  };

  const rolls = variant !== 'day';
  return (
    <div
      ref={listRef}
      role="tablist"
      className={[styles.tabs, styles[variant], variant === 'segment' && 'm-glass', className].filter(Boolean).join(' ')}
      onKeyDown={onKeyDown}
      {...aria}
    >
      <span ref={indRef} className={styles.indicator} aria-hidden="true" />
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab={t.id}
            id={idBase ? `${idBase}-tab-${t.id}` : undefined}
            aria-controls={idBase ? `${idBase}-panel-${t.id}` : undefined}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={`m-feel ${styles.tab}`}
            onClick={() => onChange(t.id)}
            {...feel}
          >
            {rolls ? <RollLabel text={t.label} className={styles.label} /> : <span className={styles.label}>{t.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
